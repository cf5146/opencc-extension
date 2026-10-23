import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createPopupController, type PopupElements } from "../src/application/ui/popup-controller.js";
import { DEFAULT_SETTINGS, type Settings } from "../src/application/settings/settings.js";
import { createFakePlatform, createFakeSettingsStore } from "./helpers/fakes.js";

function makeElements(): PopupElements {
  document.body.innerHTML = `<select id="origin"><option value="cn">cn</option><option value="hk">hk</option><option value="tw">tw</option></select><select id="target"><option value="hk">hk</option><option value="cn">cn</option><option value="tw">tw</option></select><button id="swap"></button><button id="clear"></button><textarea id="original"></textarea><textarea id="result"></textarea><button id="convert"></button><input id="auto" type="checkbox"><output id="status"></output><button id="retry"></button><button id="copy"></button><select id="site"><option value="default">Default</option><option value="always">Always</option><option value="never">Never</option></select><span id="hostname"></span><p id="policy"></p>`;
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  return {
    originSelect: get("origin"),
    targetSelect: get("target"),
    swapButton: get("swap"),
    resetButton: get("clear"),
    textbox: get("original"),
    result: get("result"),
    convertButton: get("convert"),
    autoCheckbox: get("auto"),
    status: get("status"),
    subtitle: null,
    retryButton: get("retry"),
    copyButton: get("copy"),
    siteSelect: get("site"),
    hostname: get("hostname"),
    policy: get("policy"),
  };
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
afterEach(() => vi.useRealTimers());
it("keeps settings inside the Traditional Chinese popup", () => {
  const markup = readFileSync("entrypoints/popup/index.html", "utf8");
  const popup = new DOMParser().parseFromString(markup, "text/html");
  expect(popup.documentElement.lang).toBe("zh-Hant");
  expect(popup.querySelector('a[href="/options.html"]')).toBeNull();
  expect(popup.querySelector("#preset")).not.toBeNull();
  expect(popup.querySelector("#site-auto")).not.toBeNull();
  expect(popup.querySelector("#show-settings")?.textContent).toBe("網站設定");
  expect(popup.querySelector("#mode")).not.toBeNull();
});
it("gates initialization, retries load failure, and ignores completion after disposal", async () => {
  const store = createFakeSettingsStore();
  vi.spyOn(store, "load").mockRejectedValueOnce(new Error("offline"));
  const e = makeElements();
  const c = createPopupController(createFakePlatform(), e, store);
  expect(e.convertButton.disabled).toBe(true);
  await c.initialize();
  expect(e.originSelect.disabled).toBe(true);
  expect(e.status.textContent).toContain("載入");
  e.retryButton.click();
  await flush();
  expect(e.originSelect.disabled).toBe(false);
  c.dispose();
  e.swapButton.click();
});
it("keeps original intact, recomputes on swap, respects composition, clear and disposal", async () => {
  vi.useFakeTimers();
  const e = makeElements();
  const c = createPopupController(createFakePlatform(), e, createFakeSettingsStore());
  await c.initialize();
  e.textbox.value = "汉字";
  e.textbox.dispatchEvent(new Event("compositionstart"));
  e.textbox.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(300);
  expect(e.result.value).toBe("");
  e.textbox.dispatchEvent(new Event("compositionend"));
  await vi.advanceTimersByTimeAsync(250);
  expect(e.result.value).toBe("漢字");
  expect(e.textbox.value).toBe("汉字");
  e.swapButton.click();
  expect(e.result.value).toBe("汉字");
  e.textbox.dispatchEvent(new Event("input"));
  e.resetButton.click();
  await vi.advanceTimersByTimeAsync(300);
  expect(e.result.value).toBe("");
  expect(e.textbox.value).toBe("");
  e.textbox.value = "汉字";
  e.textbox.dispatchEvent(new Event("input"));
  c.dispose();
  await vi.advanceTimersByTimeAsync(300);
  expect(e.result.value).toBe("");
});
it("serializes saves, waits before conversion, blocks duplicate requests", async () => {
  let release!: (settings: Settings) => void;
  const store = createFakeSettingsStore();
  const set = vi.spyOn(store, "set").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const send = vi.fn().mockResolvedValue({ kind: "reload-required" });
  const e = makeElements();
  const c = createPopupController(createFakePlatform({ runtime: { send } }), e, store);
  await c.initialize();
  e.originSelect.value = "tw";
  e.originSelect.dispatchEvent(new Event("change"));
  e.autoCheckbox.dispatchEvent(new Event("change"));
  e.convertButton.click();
  e.convertButton.click();
  expect(set).toHaveBeenCalledTimes(1);
  expect(send).not.toHaveBeenCalled();
  release(DEFAULT_SETTINGS);
  await flush();
  await flush();
  expect(set).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledTimes(1);
  expect(e.status.textContent).toContain("重新整理");
  c.dispose();
});
it("retains failed edits for retry and does not convert with unsaved settings", async () => {
  const store = createFakeSettingsStore();
  vi.spyOn(store, "set").mockRejectedValueOnce(new Error("offline"));
  const send = vi.fn();
  const e = makeElements();
  const c = createPopupController(createFakePlatform({ runtime: { send } }), e, store);
  await c.initialize();
  e.originSelect.value = "tw";
  e.originSelect.dispatchEvent(new Event("change"));
  await flush();
  expect(e.status.textContent).toContain("儲存");
  await store.emit({ origin: "hk" });
  expect(e.originSelect.value).toBe("tw");
  e.convertButton.click();
  await flush();
  expect(send).not.toHaveBeenCalled();
  e.retryButton.click();
  await flush();
  expect((await store.load()).origin).toBe("tw");
  c.dispose();
});
it("shows configured hostname policy and handles copy failure without losing result", async () => {
  const e = makeElements();
  const c = createPopupController(
    createFakePlatform({ tabs: { getActive: async () => ({ id: 1, url: "https://EXAMPLE.com./path" }) } }),
    e,
    createFakeSettingsStore({ auto: true }),
    {
      copy: async () => {
        throw new Error("denied");
      },
    },
  );
  await c.initialize();
  expect(e.hostname.textContent).toBe("example.com");
  expect(e.policy.textContent).toContain("目前設定");
  e.textbox.value = "汉字";
  e.textbox.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 260));
  e.copyButton.click();
  await flush();
  expect(e.result.value).toBe("漢字");
  expect(e.status.textContent).toContain("選取");
  c.dispose();
});
it("retries the latest selected direction after an earlier save failed", async () => {
  const store = createFakeSettingsStore();
  vi.spyOn(store, "set").mockRejectedValueOnce(new Error("offline"));
  const e = makeElements();
  const c = createPopupController(createFakePlatform(), e, store);
  await c.initialize();
  e.originSelect.value = "tw";
  e.originSelect.dispatchEvent(new Event("change"));
  await flush();
  e.originSelect.value = "cn";
  e.originSelect.dispatchEvent(new Event("change"));
  await flush();
  e.retryButton.click();
  await flush();
  expect((await store.load()).origin).toBe("cn");
  c.dispose();
});
it("does not hydrate controls or subscribe after disposal during startup", async () => {
  let resolve!: (settings: Settings) => void;
  const store = createFakeSettingsStore();
  vi.spyOn(store, "load").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const subscribe = vi.spyOn(store, "subscribe");
  const e = makeElements();
  const c = createPopupController(createFakePlatform(), e, store);
  const loading = c.initialize();
  expect(c.initialize()).toBe(loading);
  c.dispose();
  resolve(DEFAULT_SETTINGS);
  await loading;
  expect(e.originSelect.disabled).toBe(true);
  expect(subscribe).not.toHaveBeenCalled();
});
it("uses exact normalized site rules and disables site policy on unsupported pages", async () => {
  const store = createFakeSettingsStore();
  const setSiteRule = vi.fn().mockResolvedValue(DEFAULT_SETTINGS);
  store.setSiteRule = setSiteRule;
  const e = makeElements();
  const c = createPopupController(
    createFakePlatform({ tabs: { getActive: async () => ({ id: 1, url: "https://Example.COM./x" }) } }),
    e,
    store,
  );
  await c.initialize();
  e.siteSelect.value = "never";
  e.siteSelect.dispatchEvent(new Event("change"));
  await flush();
  expect(setSiteRule).toHaveBeenCalledWith("example.com", "never");
  e.siteSelect.value = "default";
  e.siteSelect.dispatchEvent(new Event("change"));
  await flush();
  expect(setSiteRule).toHaveBeenCalledWith("example.com", null);
  c.dispose();
  const other = makeElements();
  const d = createPopupController(
    createFakePlatform({ tabs: { getActive: async () => ({ id: 1, url: "chrome://settings" }) } }),
    other,
    store,
  );
  await d.initialize();
  expect(other.siteSelect.disabled).toBe(true);
  d.dispose();
});
it("renders unavailable and no-op page results as plain text", async () => {
  const send = vi
    .fn()
    .mockResolvedValueOnce({ kind: "unavailable", reason: "protected-page" })
    .mockResolvedValueOnce({ kind: "no-op" });
  const e = makeElements();
  const c = createPopupController(createFakePlatform({ runtime: { send } }), e, createFakeSettingsStore());
  await c.initialize();
  e.convertButton.click();
  await flush();
  expect(e.status.textContent).toContain("不允許");
  expect(e.status.querySelector("span")).toBeNull();
  e.convertButton.click();
  await flush();
  expect(e.status.textContent).toContain("不需要轉換");
  c.dispose();
});
it("does not retry a clean external default when a direction save failed", async () => {
  const store = createFakeSettingsStore();
  const set = vi.spyOn(store, "set").mockRejectedValueOnce(new Error("offline"));
  const e = makeElements();
  const c = createPopupController(createFakePlatform(), e, store);
  await c.initialize();
  e.originSelect.value = "tw";
  e.originSelect.dispatchEvent(new Event("change"));
  await flush();
  await store.emit({ auto: true, target: "cn" });
  expect(e.autoCheckbox.checked).toBe(true);
  expect(e.targetSelect.value).toBe("cn");
  expect(e.originSelect.value).toBe("tw");
  e.retryButton.click();
  await flush();
  expect(set).toHaveBeenLastCalledWith({ origin: "tw" });
  expect((await store.load()).auto).toBe(true);
  c.dispose();
});
