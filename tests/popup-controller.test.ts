import { describe, expect, it, vi } from "vitest";
import { createPopupController, type PopupElements } from "../src/application/ui/popup-controller.js";
import { DEFAULT_SETTINGS, type Settings } from "../src/application/settings/settings.js";
import type { SettingsStore } from "../src/application/settings/settings-store.js";
import { createFakePlatform, createFakeSettingsStore } from "./helpers/fakes.js";

function makePopupElements(): PopupElements {
  document.body.innerHTML = `
    <select id="origin"><option value="cn">cn</option><option value="hk">hk</option><option value="tw">tw</option></select>
    <select id="target"><option value="hk">hk</option><option value="cn">cn</option><option value="tw">tw</option></select>
    <button id="swap"></button>
    <button id="reset"></button>
    <textarea id="textbox"></textarea>
    <button id="convert"></button>
    <input id="auto" type="checkbox" />
    <span id="status"></span>
  `;
  return {
    originSelect: document.getElementById("origin") as HTMLSelectElement,
    targetSelect: document.getElementById("target") as HTMLSelectElement,
    swapButton: document.getElementById("swap") as HTMLButtonElement,
    resetButton: document.getElementById("reset") as HTMLButtonElement,
    textbox: document.getElementById("textbox") as HTMLTextAreaElement,
    convertButton: document.getElementById("convert") as HTMLButtonElement,
    autoCheckbox: document.getElementById("auto") as HTMLInputElement,
    status: document.getElementById("status") as HTMLElement,
    subtitle: null,
  };
}

describe("popup controller", () => {
  it("keeps controls gated until settings hydration finishes", async () => {
    let releaseLoad!: (settings: Settings) => void;
    const settingsStore: SettingsStore = {
      load: vi.fn(() => new Promise<Settings>((resolve) => { releaseLoad = resolve; })),
      set: vi.fn(),
      subscribe: () => () => {},
    };
    const elements = makePopupElements();
    const controller = createPopupController(createFakePlatform(), elements, settingsStore);
    const initializePromise = controller.initialize();

    expect(elements.originSelect.disabled).toBe(true);
    expect(elements.targetSelect.disabled).toBe(true);
    expect(elements.textbox.disabled).toBe(true);
    elements.originSelect.value = "hk";
    elements.originSelect.dispatchEvent(new Event("change"));
    expect(settingsStore.set).not.toHaveBeenCalled();

    releaseLoad({ ...DEFAULT_SETTINGS, origin: "tw" });
    await initializePromise;

    expect(elements.originSelect.value).toBe("tw");
    expect(elements.originSelect.disabled).toBe(false);
    controller.dispose();
  });

  it("sends active-tab conversion through runtime and renders a text-only result", async () => {
    const send = vi.fn().mockResolvedValue({ kind: "success", count: 2, time: 8 });
    const getActive = vi.fn();
    const platform = createFakePlatform({ runtime: { send }, tabs: { getActive } });
    const elements = makePopupElements();
    const controller = createPopupController(platform, elements);

    await controller.initialize();
    elements.convertButton.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(send).toHaveBeenCalledWith({ type: "convert-active-tab" });
    expect(getActive).not.toHaveBeenCalled();
    expect(elements.status.textContent).toBe("2 nodes changed in 8ms");
    expect(elements.status.innerHTML).toBe("2 nodes changed in 8ms");
    controller.dispose();
  });

  it("renders unavailable results without HTML injection", async () => {
    const platform = createFakePlatform({
      runtime: { send: vi.fn().mockResolvedValue({ kind: "unavailable", reason: "protected-page" }) },
    });
    const elements = makePopupElements();
    const controller = createPopupController(platform, elements);

    await controller.initialize();
    elements.convertButton.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(elements.status.textContent).toContain("PROTECTED");
    expect(elements.status.textContent).toBe("NO ACCESS / PROTECTED PAGE");
    expect(elements.status.querySelector("span")).toBeNull();
    controller.dispose();
  });

  it("loads settings into controls and persists popup setting changes", async () => {
    const settingsStore = createFakeSettingsStore({
      origin: "tw",
      target: "cn",
      auto: true,
      textboxSize: { width: 420, height: 180 },
    });
    const set = vi.spyOn(settingsStore, "set");
    const elements = makePopupElements();
    const controller = createPopupController(createFakePlatform(), elements, settingsStore);

    await controller.initialize();

    expect(elements.originSelect.value).toBe("tw");
    expect(elements.targetSelect.value).toBe("cn");
    expect(elements.autoCheckbox.checked).toBe(true);
    expect(elements.textbox.style.width).toBe("420px");
    expect(elements.textbox.style.height).toBe("180px");

    elements.originSelect.value = "hk";
    elements.originSelect.dispatchEvent(new Event("change"));
    elements.targetSelect.value = "tw";
    elements.targetSelect.dispatchEvent(new Event("change"));
    elements.swapButton.click();
    elements.autoCheckbox.checked = false;
    elements.autoCheckbox.dispatchEvent(new Event("change"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(set).toHaveBeenCalledWith({ origin: "hk" });
    expect(set).toHaveBeenCalledWith({ target: "tw" });
    expect(set).toHaveBeenCalledWith({ origin: "tw", target: "hk" });
    expect(set).toHaveBeenCalledWith({ auto: false });
    controller.dispose();
  });

  it("converts textbox input locally after the debounce and cancels work on dispose", async () => {
    vi.useFakeTimers();
    try {
      const send = vi.fn();
      const elements = makePopupElements();
      const controller = createPopupController(createFakePlatform({ runtime: { send } }), elements);

      await controller.initialize();
      elements.textbox.value = "汉字";
      elements.textbox.dispatchEvent(new Event("input"));
      await vi.advanceTimersByTimeAsync(250);

      expect(elements.textbox.value).not.toBe("汉字");
      expect(send).not.toHaveBeenCalled();

      elements.textbox.value = "繁體";
      elements.textbox.dispatchEvent(new Event("input"));
      controller.dispose();
      await vi.advanceTimersByTimeAsync(250);
      expect(elements.textbox.value).toBe("繁體");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a pending textbox conversion when direction changes immediately", async () => {
    vi.useFakeTimers();
    try {
      const elements = makePopupElements();
      const controller = createPopupController(createFakePlatform(), elements);
      await controller.initialize();

      elements.textbox.value = "汉字";
      elements.textbox.dispatchEvent(new Event("input"));
      elements.originSelect.value = "hk";
      elements.originSelect.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(250);

      expect(elements.textbox.value).toBe("汉字");
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("serializes rapid settings writes", async () => {
    let releaseFirst!: (settings: Settings) => void;
    let setCalls = 0;
    const settingsStore: SettingsStore = {
      load: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      set: vi.fn((patch) => {
        setCalls += 1;
        if (setCalls === 1) {
          return new Promise<Settings>((resolve) => { releaseFirst = resolve; });
        }
        return Promise.resolve({ ...DEFAULT_SETTINGS, ...patch });
      }),
      subscribe: () => () => {},
    };
    const elements = makePopupElements();
    const controller = createPopupController(createFakePlatform(), elements, settingsStore);
    await controller.initialize();

    elements.originSelect.value = "tw";
    elements.originSelect.dispatchEvent(new Event("change"));
    elements.targetSelect.value = "cn";
    elements.targetSelect.dispatchEvent(new Event("change"));

    expect(setCalls).toBe(1);
    releaseFirst(DEFAULT_SETTINGS);
    await vi.waitFor(() => expect(setCalls).toBe(2));
    controller.dispose();
  });

  it("uses ResizeObserver for size persistence and disconnects it", async () => {
    const observers: Array<{ observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    class FakeResizeObserver {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor() {
        observers.push(this);
      }
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    try {
      const settingsStore = createFakeSettingsStore();
      const set = vi.spyOn(settingsStore, "set");
      const controller = createPopupController(createFakePlatform(), makePopupElements(), settingsStore);
      await controller.initialize();

      expect(observers).toHaveLength(1);
      expect(observers[0]?.observe).toHaveBeenCalledOnce();
      controller.dispose();
      expect(observers[0]?.disconnect).toHaveBeenCalledOnce();
      expect(set).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("renders every conversion response with a text-only status", async () => {
    const responses = [
      { kind: "success" as const, count: 1, time: 2 },
      { kind: "no-op" as const, count: 0 as const, time: 0 },
      { kind: "reload-required" as const },
      { kind: "unavailable" as const, reason: "unsupported-scheme" as const },
      { kind: "invalid-settings" as const },
      { kind: "internal-failure" as const },
    ];
    const send = vi.fn();
    for (const response of responses) send.mockResolvedValueOnce(response);
    const elements = makePopupElements();
    const controller = createPopupController(createFakePlatform({ runtime: { send } }), elements);
    await controller.initialize();

    for (const response of responses) {
      elements.convertButton.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(elements.status.innerHTML).not.toContain("<");
      expect(elements.status.textContent).toBeTruthy();
      expect(elements.status.className).toContain("status-");
      if (response.kind === "success") expect(elements.status.textContent).toBe("1 nodes changed in 2ms");
    }
    controller.dispose();
  });
});
