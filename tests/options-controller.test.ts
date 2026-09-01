import { expect, it, vi } from "vitest";
import { createOptionsController } from "../src/application/ui/options-controller.js";
import { DEFAULT_SETTINGS, type Settings } from "../src/application/settings/settings.js";
import type { SettingsStore } from "../src/application/settings/settings-store.js";
import { createFakePlatform, createFakeSettingsStore } from "./helpers/fakes.js";

const flushAsyncWork = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

it("keeps the whitelist gated until settings hydration finishes", async () => {
  let releaseLoad!: (settings: Settings) => void;
  const settingsStore: SettingsStore = {
    load: vi.fn(() => new Promise<Settings>((resolve) => { releaseLoad = resolve; })),
    set: vi.fn(),
    subscribe: () => () => {},
  };
  document.body.innerHTML = '<textarea id="whitelist"></textarea>';
  const whitelist = document.getElementById("whitelist") as HTMLTextAreaElement;
  const controller = createOptionsController(createFakePlatform(), { whitelist }, settingsStore);
  const initializePromise = controller.initialize();

  expect(whitelist.disabled).toBe(true);
  expect(whitelist.value).toBe("");
  releaseLoad({ ...DEFAULT_SETTINGS, whitelist: ["https://[^ ]*.example.com/[^ ]*"] });
  await initializePromise;

  expect(whitelist.disabled).toBe(false);
  expect(whitelist.value).toBe("https://*.example.com/*");
  controller.dispose();
});

it("normalizes wildcard whitelist entries and persists them", async () => {
  document.body.innerHTML = '<textarea id="whitelist"></textarea>';
  const settingsStore = createFakeSettingsStore();
  const set = vi.spyOn(settingsStore, "set");
  const elements = {
    whitelist: document.getElementById("whitelist") as HTMLTextAreaElement,
  };
  const controller = createOptionsController(createFakePlatform(), elements, settingsStore);
  await controller.initialize();

  elements.whitelist.value = "https://*.example.com/*";
  elements.whitelist.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 550));

  expect(set).toHaveBeenCalledWith({ whitelist: ["https://[^ ]*.example.com/[^ ]*"] });
  controller.dispose();
});

it("serializes rapid whitelist writes", async () => {
  let releaseFirst!: (settings: Settings) => void;
  let setCalls = 0;
  const settingsStore: SettingsStore = {
    load: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
    set: vi.fn((patch) => {
      setCalls += 1;
      if (setCalls === 1) return new Promise<Settings>((resolve) => { releaseFirst = resolve; });
      return Promise.resolve({ ...DEFAULT_SETTINGS, ...patch });
    }),
    subscribe: () => () => {},
  };
  document.body.innerHTML = '<textarea id="whitelist"></textarea>';
  const whitelist = document.getElementById("whitelist") as HTMLTextAreaElement;
  const controller = createOptionsController(createFakePlatform(), { whitelist }, settingsStore);
  await controller.initialize();

  whitelist.value = "https://*.one.example/*";
  whitelist.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 500));
  whitelist.value = "https://*.two.example/*";
  whitelist.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(setCalls).toBe(1);
  releaseFirst(DEFAULT_SETTINGS);
  await flushAsyncWork();
  await flushAsyncWork();
  expect(setCalls).toBe(2);
  controller.dispose();
});

it("loads stored patterns as wildcard text and cancels pending persistence on dispose", async () => {
  vi.useFakeTimers();
  try {
    const settingsStore = createFakeSettingsStore({ whitelist: ["https://[^ ]*.example.com/[^ ]*"] });
    const set = vi.spyOn(settingsStore, "set");
    document.body.innerHTML = '<textarea id="whitelist"></textarea>';
    const elements = {
      whitelist: document.getElementById("whitelist") as HTMLTextAreaElement,
    };
    const controller = createOptionsController(createFakePlatform(), elements, settingsStore);

    await controller.initialize();
    expect(elements.whitelist.value).toBe("https://*.example.com/*");

    elements.whitelist.value = "https://*.other.example/*";
    elements.whitelist.dispatchEvent(new Event("input"));
    controller.dispose();
    await vi.advanceTimersByTimeAsync(500);

    expect(set).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
