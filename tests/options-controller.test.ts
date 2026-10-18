import { expect, it, vi } from "vitest";
import { createOptionsController, type OptionsElements } from "../src/application/ui/options-controller.js";
import { DEFAULT_SETTINGS } from "../src/application/settings/settings.js";
import { createFakePlatform, createFakeSettingsStore } from "./helpers/fakes.js";
function elements(): OptionsElements {
  document.body.innerHTML =
    '<textarea id="patterns"></textarea><input id="auto" type="checkbox"><button id="save"></button><button id="retry"></button><output id="status"></output><ul id="rules"></ul>';
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  return {
    whitelist: get("patterns"),
    autoCheckbox: get<HTMLInputElement>("auto"),
    saveButton: get("save"),
    retryButton: get("retry"),
    status: get("status"),
    siteRules: get("rules"),
  };
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
it("edits exclusions inline without owning the popup auto-convert checkbox", async () => {
  const store = createFakeSettingsStore({ auto: true, siteRules: { "example.com": "never" } });
  store.setSiteRule = async () => store.set({ siteRules: {} });
  const e = elements();
  const { autoCheckbox: _autoCheckbox, ...inlineElements } = e;
  const c = createOptionsController(createFakePlatform(), inlineElements, store);
  await c.initialize();
  e.whitelist.value = "example";
  e.whitelist.dispatchEvent(new Event("input"));
  e.saveButton.click();
  await flush();
  expect((await store.load()).whitelist).toEqual(["example"]);
  expect((await store.load()).auto).toBe(true);
  e.siteRules.querySelector("button")!.click();
  await flush();
  expect((await store.load()).siteRules).toEqual({});
  c.dispose();
});
it("loads legacy regular expressions verbatim and saves explicitly", async () => {
  const store = createFakeSettingsStore({ whitelist: ["https://[^ ]*.example.com/[^ ]*"] });
  const set = vi.spyOn(store, "set");
  const e = elements();
  const c = createOptionsController(createFakePlatform(), e, store);
  expect(e.whitelist.disabled).toBe(true);
  await c.initialize();
  expect(e.whitelist.value).toBe("https://[^ ]*.example.com/[^ ]*");
  e.whitelist.value = "https://example\\.com/.*";
  e.whitelist.dispatchEvent(new Event("input"));
  await flush();
  expect(set).not.toHaveBeenCalled();
  e.saveButton.click();
  await flush();
  expect(set).toHaveBeenCalledWith({ whitelist: ["https://example\\.com/.*"] });
  expect(e.status.textContent).toContain("已儲存");
  c.dispose();
});
it("rejects invalid regex and preserves saved patterns", async () => {
  const store = createFakeSettingsStore({ whitelist: ["good"] });
  const set = vi.spyOn(store, "set");
  const e = elements();
  const c = createOptionsController(createFakePlatform(), e, store);
  await c.initialize();
  e.whitelist.value = "[";
  e.whitelist.dispatchEvent(new Event("input"));
  e.saveButton.click();
  await flush();
  expect(set).not.toHaveBeenCalled();
  expect(e.status.textContent).toContain("正規表示式");
  expect((await store.load()).whitelist).toEqual(["good"]);
  c.dispose();
});
it("retains dirty edits during subscription and failed save, then retries", async () => {
  const store = createFakeSettingsStore();
  const set = vi.spyOn(store, "set").mockRejectedValueOnce(new Error("offline"));
  const e = elements();
  const c = createOptionsController(createFakePlatform(), e, store);
  await c.initialize();
  e.whitelist.value = "edited";
  e.whitelist.dispatchEvent(new Event("input"));
  await store.emit({ whitelist: ["remote"] });
  expect(e.whitelist.value).toBe("edited");
  e.saveButton.click();
  await flush();
  expect(e.status.textContent).toContain("儲存");
  expect(e.whitelist.value).toBe("edited");
  e.saveButton.click();
  await flush();
  expect(set).toHaveBeenCalledTimes(2);
  expect(e.status.textContent).toContain("已儲存");
  c.dispose();
});
it("gates after load failure and retries, removes site rule, and detaches on disposal", async () => {
  const store = createFakeSettingsStore({ siteRules: { "example.com": "never" } });
  vi.spyOn(store, "load").mockRejectedValueOnce(new Error("offline"));
  const remove = vi.fn().mockResolvedValue({ ...DEFAULT_SETTINGS, siteRules: {} });
  store.setSiteRule = remove;
  const e = elements();
  const c = createOptionsController(createFakePlatform(), e, store);
  await c.initialize();
  expect(e.whitelist.disabled).toBe(true);
  e.retryButton.click();
  await flush();
  expect(e.whitelist.disabled).toBe(false);
  e.siteRules.querySelector("button")?.click();
  await flush();
  expect(remove).toHaveBeenCalledWith("example.com", null);
  c.dispose();
  e.saveButton.click();
});
it("saves only edited patterns while applying an external default change", async () => {
  const store = createFakeSettingsStore();
  const set = vi.spyOn(store, "set");
  const e = elements();
  const c = createOptionsController(createFakePlatform(), e, store);
  await c.initialize();
  e.whitelist.value = "edited";
  e.whitelist.dispatchEvent(new Event("input"));
  await store.emit({ auto: true, whitelist: ["remote"] });
  expect(e.autoCheckbox!.checked).toBe(true);
  expect(e.whitelist.value).toBe("edited");
  e.saveButton.click();
  await flush();
  expect(set).toHaveBeenCalledWith({ whitelist: ["edited"] });
  expect((await store.load()).auto).toBe(true);
  c.dispose();
});
it("saves only the edited default while applying external patterns", async () => {
  const store = createFakeSettingsStore();
  const set = vi.spyOn(store, "set");
  const e = elements();
  const c = createOptionsController(createFakePlatform(), e, store);
  await c.initialize();
  e.autoCheckbox!.checked = true;
  e.autoCheckbox!.dispatchEvent(new Event("change"));
  await store.emit({ auto: false, whitelist: ["remote"] });
  expect(e.autoCheckbox!.checked).toBe(true);
  expect(e.whitelist.value).toBe("remote");
  e.saveButton.click();
  await flush();
  expect(set).toHaveBeenCalledWith({ auto: true });
  expect((await store.load()).whitelist).toEqual(["remote"]);
  c.dispose();
});
