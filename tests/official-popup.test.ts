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
  expect(document.querySelectorAll("#preset option")).toHaveLength(5);
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
it.each([
  { preset: "s2twp", mode: "mmseg", config: "s2twp" },
  { preset: "s2hk", mode: "jieba", config: "s2hk_jieba" },
])("a delayed migration dismissal cannot overwrite $preset/$mode", async (selected) => {
  document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
  let state = { version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: true };
  let release!: () => void;
  const dismissed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes: Promise<unknown> = Promise.resolve();
  fake.storage.local.get.mockImplementation(async () => ({ officialOpenCC: structuredClone(state) }));
  fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
  fake.storage.onChanged.addListener.mockClear();
  fake.runtime.sendMessage.mockClear();
  fake.runtime.sendMessage.mockImplementation((message: any) => {
    if (message.type === "official-convert")
      return Promise.resolve({ texts: [message.config + ":" + message.texts[0]] });
    const job = writes.then(async () => {
      if (message.action === "dismiss") {
        await dismissed;
        state = { ...state, migrationNotice: false };
      } else state = { ...state, ...message.options };
      for (const [notify] of fake.storage.onChanged.addListener.mock.calls) notify({ officialOpenCC: {} }, "local");
      return { settings: structuredClone(state) };
    });
    writes = job;
    return job;
  });
  await startPopup();
  try {
    const input = document.getElementById("textbox") as HTMLTextAreaElement,
      preset = document.getElementById("preset") as HTMLSelectElement,
      mode = document.getElementById("mode") as HTMLSelectElement;
    input.value = "汉";
    expect(document.getElementById("migration")!.hidden).toBe(false);
    document.getElementById("dismiss")!.click();
    if (selected.preset !== preset.value) {
      preset.value = selected.preset;
      preset.dispatchEvent(new Event("change"));
    }
    if (selected.mode !== mode.value) {
      mode.value = selected.mode;
      mode.dispatchEvent(new Event("change"));
    }
    release();
    await vi.waitFor(() =>
      expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe(selected.config + ":汉"),
    );
    expect(state.preset).toBe(selected.preset);
    expect(state.mode).toBe(selected.mode);
    expect(preset.value).toBe(selected.preset);
    expect(mode.value).toBe(selected.mode);
    expect(document.getElementById("migration")!.hidden).toBe(true);
  } finally {
    release();
    window.dispatchEvent(new Event("pagehide"));
  }
});

it.each([false, true])(
  "reconciles a failed site toggle followed by a successful defaults save (initial enabled=%s)",
  async (enabled) => {
    document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
    let state: any = {
      version: 2,
      preset: "s2twp",
      mode: "jieba",
      sites: enabled ? { "example.com": { preset: "s2twp", mode: "jieba" } } : {},
      migrationNotice: false,
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes: Promise<unknown> = Promise.resolve();
    fake.storage.local.get.mockImplementation(async () => ({ officialOpenCC: structuredClone(state) }));
    fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
    fake.storage.onChanged.addListener.mockClear();
    fake.runtime.sendMessage.mockClear();
    fake.runtime.sendMessage.mockImplementation((message: any) => {
      if (message.type === "official-convert")
        return Promise.resolve({ texts: [message.config + ":" + message.texts[0]] });
      const job = writes.then(async () => {
        if (message.action === "site") {
          await gate;
          return { error: "storage unavailable" };
        }
        state = { ...state, ...message.options, sites: { ...state.sites } };
        if (message.hostname) state.sites[message.hostname] = { ...message.options };
        for (const [notify] of fake.storage.onChanged.addListener.mock.calls) notify({ officialOpenCC: {} }, "local");
        return { settings: structuredClone(state) };
      });
      writes = job;
      return job;
    });
    await startPopup();
    try {
      const site = document.getElementById("site-auto") as HTMLInputElement,
        preset = document.getElementById("preset") as HTMLSelectElement;
      (document.getElementById("textbox") as HTMLTextAreaElement).value = "汉";
      site.click();
      preset.value = "s2hk";
      preset.dispatchEvent(new Event("change"));
      release();
      await vi.waitFor(() => expect(state.preset).toBe("s2hk"));
      const effective = state.sites["example.com"] ?? state;
      await vi.waitFor(() =>
        expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe(effective.preset + "_jieba:汉"),
      );
      expect(site.checked).toBe(Object.hasOwn(state.sites, "example.com"));
      expect(site.disabled).toBe(false);
      expect(preset.value).toBe(effective.preset);
    } finally {
      release();
      window.dispatchEvent(new Event("pagehide"));
    }
  },
);
it("manual page conversion waits for settings queued while an earlier save is pending", async () => {
  document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
  let state: any = { version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: false };
  let firstRelease!: () => void,
    secondRelease!: () => void,
    count = 0,
    secondStarted = false;
  const firstGate = new Promise<void>((r) => {
      firstRelease = r;
    }),
    secondGate = new Promise<void>((r) => {
      secondRelease = r;
    });
  let writes: Promise<unknown> = Promise.resolve();
  const pageConfigs: any[] = [];
  fake.storage.local.get.mockImplementation(async () => ({ officialOpenCC: structuredClone(state) }));
  fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
  fake.storage.onChanged.addListener.mockClear();
  fake.runtime.sendMessage.mockClear();
  fake.runtime.sendMessage.mockImplementation((message: any) => {
    if (message.type === "convert-active-tab") {
      pageConfigs.push({ preset: state.preset, mode: state.mode });
      return Promise.resolve({ kind: "success", count: 1 });
    }
    const job = writes.then(async () => {
      if (++count === 1) await firstGate;
      else {
        secondStarted = true;
        await secondGate;
      }
      state = { ...state, ...message.options };
      for (const [notify] of fake.storage.onChanged.addListener.mock.calls) notify({ officialOpenCC: {} }, "local");
      return { settings: structuredClone(state) };
    });
    writes = job;
    return job;
  });
  await startPopup();
  try {
    const preset = document.getElementById("preset") as HTMLSelectElement,
      mode = document.getElementById("mode") as HTMLSelectElement;
    preset.value = "s2hk";
    preset.dispatchEvent(new Event("change"));
    document.getElementById("convert")!.click();
    mode.value = "mmseg";
    mode.dispatchEvent(new Event("change"));
    firstRelease();
    await vi.waitFor(() => expect(secondStarted).toBe(true));
    expect(pageConfigs).toEqual([]);
    secondRelease();
    await vi.waitFor(() => expect(pageConfigs).toEqual([{ preset: "s2hk", mode: "mmseg" }]));
  } finally {
    firstRelease();
    secondRelease();
    window.dispatchEvent(new Event("pagehide"));
  }
});

it.each(["external", "local", "error"])("ignores a stale settings read after a newer %s update", async (source) => {
  document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
  let state: any = { version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: false };
  let hold = false,
    release!: () => void;
  fake.storage.local.get.mockImplementation(() => {
    const snapshot = structuredClone(state);
    if (hold) {
      hold = false;
      return new Promise((resolve, reject) => {
        release = () =>
          source === "error" ? reject(Error("obsolete read failure")) : resolve({ officialOpenCC: snapshot });
      });
    }
    return Promise.resolve({ officialOpenCC: snapshot });
  });
  fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
  fake.storage.onChanged.addListener.mockClear();
  fake.runtime.sendMessage.mockClear();
  const notify = () => {
    for (const [listener] of fake.storage.onChanged.addListener.mock.calls) listener({ officialOpenCC: {} }, "local");
  };
  fake.runtime.sendMessage.mockImplementation(async (message: any) => {
    if (message.type === "official-convert") return { texts: [message.config + ":" + message.texts[0]] };
    state = { ...state, ...message.options };
    notify();
    return { settings: structuredClone(state) };
  });
  await startPopup();
  try {
    (document.getElementById("textbox") as HTMLTextAreaElement).value = "汉";
    state = { ...state, mode: "mmseg" };
    hold = true;
    notify();
    if (source === "local") {
      const preset = document.getElementById("preset") as HTMLSelectElement;
      preset.value = "s2hk";
      preset.dispatchEvent(new Event("change"));
    } else {
      state = { ...state, preset: "s2hk", mode: "jieba" };
      notify();
    }
    await vi.waitFor(() =>
      expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe("s2hk_jieba:汉"),
    );
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((document.getElementById("preset") as HTMLSelectElement).value).toBe("s2hk");
    expect((document.getElementById("mode") as HTMLSelectElement).value).toBe("jieba");
    expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe("s2hk_jieba:汉");
    expect(document.getElementById("status")!.textContent).toBe("文字轉換完成");
  } finally {
    release?.();
    window.dispatchEvent(new Event("pagehide"));
  }
});
it.each([false, true])(
  "recovers preview after a failed write when fresh persisted settings arrive (same choices=%s)",
  async (same) => {
    document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
    let state: any = { version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: false };
    fake.storage.local.get.mockImplementation(async () => ({ officialOpenCC: structuredClone(state) }));
    fake.tabs.query.mockResolvedValue([{ url: "https://example.com" }]);
    fake.storage.onChanged.addListener.mockClear();
    fake.runtime.sendMessage.mockClear();
    fake.runtime.sendMessage.mockImplementation(async (message: any) =>
      message.type === "official-convert"
        ? { texts: [message.config + ":" + message.texts[0]] }
        : { error: "storage unavailable" },
    );
    await startPopup();
    try {
      (document.getElementById("textbox") as HTMLTextAreaElement).value = "汉";
      const mode = document.getElementById("mode") as HTMLSelectElement;
      mode.value = "mmseg";
      mode.dispatchEvent(new Event("change"));
      await vi.waitFor(() => expect(document.getElementById("status")!.textContent).toContain("儲存失敗"));
      state = { ...state, preset: same ? "s2twp" : "s2hk", mode: same ? "mmseg" : "jieba" };
      for (const [notify] of fake.storage.onChanged.addListener.mock.calls) notify({ officialOpenCC: {} }, "local");
      await vi.waitFor(() =>
        expect((document.getElementById("result") as HTMLTextAreaElement).value).toBe(
          same ? "s2twp:汉" : "s2hk_jieba:汉",
        ),
      );
    } finally {
      window.dispatchEvent(new Event("pagehide"));
    }
  },
);

it("refreshes settings changed while the popup was still initializing", async () => {
  document.documentElement.innerHTML = fs.readFileSync("entrypoints/popup/index.html", "utf8");
  let state: any = { version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: false };
  fake.storage.local.get.mockImplementation(async () => ({ officialOpenCC: structuredClone(state) }));
  let release!: (tabs: unknown) => void;
  fake.tabs.query.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  fake.storage.onChanged.addListener.mockClear();
  const opening = startPopup();
  state = { ...state, preset: "s2hk", mode: "mmseg" };
  for (const [notify] of fake.storage.onChanged.addListener.mock.calls) notify({ officialOpenCC: {} }, "local");
  release([{ url: "https://example.com" }]);
  await opening;
  try {
    await vi.waitFor(() => expect((document.getElementById("preset") as HTMLSelectElement).value).toBe("s2hk"));
    expect((document.getElementById("mode") as HTMLSelectElement).value).toBe("mmseg");
  } finally {
    window.dispatchEvent(new Event("pagehide"));
  }
});
