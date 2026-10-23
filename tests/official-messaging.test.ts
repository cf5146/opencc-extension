import { beforeEach, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  addListener: vi.fn(),
  removeListener: vi.fn(),
  set: vi.fn(),
  runEngine: vi.fn(),
  convertTexts: vi.fn(),
  loadSettings: vi.fn(),
  convertActiveTab: vi.fn(),
  platform: {
    contextMenus: { ensureSelectionMenu: vi.fn(async () => {}), subscribe: vi.fn() },
    tabs: { send: vi.fn() },
  },
}));
vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      getURL: (p: string) => "chrome-extension://test" + p,
      onMessage: { addListener: fake.addListener, removeListener: fake.removeListener },
    },
    storage: { local: { set: fake.set } },
  },
}));
vi.mock("wxt/utils/define-content-script", () => ({ defineContentScript: (options: unknown) => options }));
vi.mock("../src/platform/browser-platform.js", () => ({ createBrowserPlatform: () => fake.platform }));
vi.mock("../src/application/runtime/background-runtime.js", () => ({ convertActiveTab: fake.convertActiveTab }));
vi.mock("../src/application/official/engine.js", () => ({
  runEngine: fake.runEngine,
  convertTexts: fake.convertTexts,
}));
vi.mock("../src/application/official/store.js", () => ({
  loadSettings: fake.loadSettings,
  subscribeSettings: () => () => {},
}));
import { startOfficialBackground } from "../src/application/official/background.js";
import content from "../entrypoints/content.js";
beforeEach(() => {
  vi.clearAllMocks();
  document.head.innerHTML = "";
  document.body.innerHTML = "<p>汉字</p>";
  fake.loadSettings.mockImplementation(async () => ({
    version: 2,
    preset: "s2twp",
    mode: "jieba",
    sites: {},
    migrationNotice: false,
  }));
  fake.runEngine.mockResolvedValue(["漢字"]);
  fake.convertTexts.mockResolvedValue(["漢字"]);
  fake.convertActiveTab.mockResolvedValue({ kind: "success", count: 1 });
  fake.set.mockResolvedValue(undefined);
});
it.each([
  [{ type: "official-convert", config: "s2twp_jieba", texts: ["汉字"] }, { texts: ["漢字"] }],
  [{ type: "official-settings", action: "dismiss" }, { settings: expect.objectContaining({ migrationNotice: false }) }],
  [{ type: "convert-active-tab" }, { kind: "success", count: 1 }],
])("background keeps a callback-only channel open for %j", async (message, expected) => {
  startOfficialBackground();
  const listener = fake.addListener.mock.calls[0]![0],
    respond = vi.fn();
  expect(listener(message, { url: "chrome-extension://test/popup.html" }, respond)).toBe(true);
  await vi.waitFor(() => expect(respond).toHaveBeenCalledExactlyOnceWith(expected));
});
it("background returns engine failures through the callback", async () => {
  fake.runEngine.mockRejectedValueOnce(Error("init failed"));
  startOfficialBackground();
  const respond = vi.fn();
  expect(
    fake.addListener.mock.calls[0]![0](
      { type: "official-convert", config: "s2twp_jieba", texts: ["汉字"] },
      {},
      respond,
    ),
  ).toBe(true);
  await vi.waitFor(() => expect(respond).toHaveBeenCalledExactlyOnceWith({ error: "init failed" }));
});
it("background leaves offscreen and unrelated messages unanswered", () => {
  startOfficialBackground();
  const listener = fake.addListener.mock.calls[0]![0],
    respond = vi.fn();
  expect(listener({ target: "opencc-offscreen" }, {}, respond)).toBe(false);
  expect(listener({ type: "unrelated" }, {}, respond)).toBe(false);
  expect(respond).not.toHaveBeenCalled();
});
it("content returns page results through a callback-only channel and ignores unrelated messages", async () => {
  let cleanup = () => {};
  content.main!({
    onInvalidated: (fn: () => void) => {
      cleanup = fn;
    },
  } as never);
  try {
    const listener = fake.addListener.mock.calls[0]![0],
      respond = vi.fn();
    expect(listener({ type: "unrelated" }, {}, respond)).toBe(false);
    expect(respond).not.toHaveBeenCalled();
    expect(listener({ type: "convert-page" }, {}, respond)).toBe(true);
    await vi.waitFor(() =>
      expect(respond).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", count: 1 })),
    );
    expect(document.querySelector("p")!.textContent).toBe("漢字");
  } finally {
    cleanup();
  }
});
it("accepts a bounded larger batch and rejects an oversized request", async () => {
  fake.runEngine.mockImplementation(async (_config: string, texts: string[]) => texts.map((text) => text + "!"));
  startOfficialBackground();
  const listener = fake.addListener.mock.calls[0]![0];
  for (const length of [1024, 1025]) {
    const respond = vi.fn();
    listener({ type: "official-convert", config: "s2twp", texts: Array(length).fill("汉") }, {}, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledOnce());
    expect(respond.mock.calls[0]![0]).toEqual(
      length === 1024 ? { texts: Array(length).fill("汉!") } : { error: "無效的轉換要求。" },
    );
  }
});
