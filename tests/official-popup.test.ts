import { it, expect, vi } from "vitest";
import fs from "node:fs";
const fake = vi.hoisted(() => ({
  storage: { local: { get: vi.fn() }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  tabs: { query: vi.fn() },
  runtime: { sendMessage: vi.fn(), openOptionsPage: vi.fn() },
}));
vi.mock("wxt/browser", () => ({ browser: fake }));
import { startPopup } from "../src/application/official/popup.js";
it("shows five presets, initializes Jieba and never replaces a newer preview with an old response", async () => {
  document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
  const s = { version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: false };
  fake.storage.local.get.mockResolvedValue({ officialOpenCC: s });
  fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
  let resolve!: (v: unknown) => void;
  fake.runtime.sendMessage.mockImplementation((m: any) =>
    m.type === "official-convert" ? new Promise((r) => (resolve = r)) : Promise.resolve({ settings: s }),
  );
  await startPopup();
  expect(document.querySelectorAll("#preset option").length).toBe(5);
  expect((document.getElementById("mode") as HTMLSelectElement).value).toBe("jieba");
  const input = document.getElementById("textbox") as HTMLTextAreaElement;
  input.value = "汉";
  input.dispatchEvent(new Event("input"));
  await vi.waitFor(() => expect(fake.runtime.sendMessage).toHaveBeenCalled(), { timeout: 2000 });
  expect(fake.runtime.sendMessage.mock.calls.at(-1)![0].config).toBe("s2twp_jieba");
  input.value = "新内容";
  input.dispatchEvent(new Event("input"));
  resolve({ texts: ["漢"] });
  await Promise.resolve();
  await Promise.resolve();
  expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe("");
  window.dispatchEvent(new Event("pagehide"));
});
it("previews the latest rapidly saved config and waits for IME composition to finish", async () => {
  document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
  let state = { version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: false };
  fake.storage.local.get.mockResolvedValue({ officialOpenCC: state });
  fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
  fake.runtime.sendMessage.mockClear();
  fake.runtime.sendMessage.mockImplementation(async (m: any) => {
    if (m.type === "official-convert") return { texts: [m.config + ":" + m.texts[0]] };
    state = { ...state, ...m.options };
    return { settings: state };
  });
  await startPopup();
  const input = document.getElementById("textbox") as HTMLTextAreaElement,
    preset = document.getElementById("preset") as HTMLSelectElement,
    mode = document.getElementById("mode") as HTMLSelectElement;
  input.dispatchEvent(new Event("compositionstart"));
  input.value = "汉";
  input.dispatchEvent(new Event("input"));
  await new Promise((r) => setTimeout(r, 300));
  expect(fake.runtime.sendMessage).not.toHaveBeenCalled();
  input.dispatchEvent(new Event("compositionend"));
  preset.value = "s2hk";
  preset.dispatchEvent(new Event("change"));
  mode.value = "mmseg";
  mode.dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe("s2hk:汉"), {
    timeout: 2000,
  });
  window.dispatchEvent(new Event("pagehide"));
});
it("removing a site override renders and previews the effective default settings", async () => {
  document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
  let state: any = {
    version: 2,
    preset: "s2twp",
    mode: "jieba",
    sites: { "example.com": { preset: "s2hk", mode: "mmseg" } },
    migrationNotice: false,
  };
  fake.storage.local.get.mockImplementation(async () => ({ officialOpenCC: state }));
  fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
  fake.storage.onChanged.addListener.mockClear();
  fake.runtime.sendMessage.mockImplementation(async (m: any) => {
    if (m.type === "official-convert") return { texts: [m.config + ":" + m.texts[0]] };
    if (m.action === "site") {
      state = { ...state, sites: {} };
      fake.storage.onChanged.addListener.mock.calls[0]![0]({ officialOpenCC: {} }, "local");
    }
    return { settings: state };
  });
  await startPopup();
  const input = document.getElementById("textbox") as HTMLTextAreaElement;
  input.value = "汉";
  input.dispatchEvent(new Event("input"));
  await vi.waitFor(() => expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe("s2hk:汉"));
  (document.getElementById("site-auto") as HTMLInputElement).click();
  await vi.waitFor(() => expect((document.getElementById("preset") as HTMLSelectElement).value).toBe("s2twp"));
  await vi.waitFor(() =>
    expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe("s2twp_jieba:汉"),
  );
  window.dispatchEvent(new Event("pagehide"));
});
