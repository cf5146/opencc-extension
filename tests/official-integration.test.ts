import { describe, it, expect } from "vitest";
import { normalizeOfficialSettings, effectiveOptions } from "../src/application/official/settings.js";
import { createDocumentConverter } from "../src/application/official/document-converter.js";
describe("official settings", () => {
  it("defaults to s2twp Jieba and does not inherit global/regex auto", () => {
    const s = normalizeOfficialSettings({ auto: true, siteRules: { "example.com": "always" }, whitelist: [".*"] });
    expect(s.preset).toBe("s2twp");
    expect(s.mode).toBe("jieba");
    expect(effectiveOptions(s, "https://example.com")).toBeUndefined();
  });
  it("retains exact-host options without applying them to subdomains", () => {
    const s = normalizeOfficialSettings({
      version: 2,
      preset: "s2t",
      mode: "mmseg",
      sites: { "EXAMPLE.com.": { preset: "s2hk", mode: "jieba" } },
    });
    expect(effectiveOptions(s, "https://example.com/a")).toEqual({ preset: "s2hk", mode: "jieba" });
    expect(effectiveOptions(s, "https://sub.example.com")).toBeUndefined();
  });
  it("drops invalid imported configs and prototype host tricks", () => {
    const s = normalizeOfficialSettings({
      version: 2,
      preset: "evil",
      mode: "bad",
      sites: { bad: { preset: "evil", mode: "jieba" } },
    });
    expect(s.preset).toBe("s2twp");
    expect(effectiveOptions(s, "https://bad")).toBeUndefined();
  });
});
describe("async DOM conversion", () => {
  const options = { preset: "s2twp" as const, mode: "jieba" as const };
  it("does not overwrite a changed node while awaiting conversion", async () => {
    let resolve!: (v: string[]) => void;
    const c = createDocumentConverter(() => new Promise((r) => (resolve = r)));
    document.body.innerHTML = "<p>汉字</p>";
    const pending = c.convert(document.body, options);
    await Promise.resolve();
    document.querySelector("p")!.textContent = "新內容";
    resolve(["漢字"]);
    await pending;
    expect(document.body.textContent).toBe("新內容");
  });
  it("cancels stale results after settings change", async () => {
    let resolve!: (v: string[]) => void;
    const c = createDocumentConverter(() => new Promise((r) => (resolve = r)));
    document.body.innerHTML = "<p>汉字</p>";
    const pending = c.convert(document.body, options);
    await Promise.resolve();
    c.cancel();
    resolve(["漢字"]);
    await pending;
    expect(document.body.textContent).toBe("汉字");
  });
  it("retains originals on failure and skips editable/code/translate-no text", async () => {
    document.body.innerHTML =
      '<p>汉</p><pre>汉</pre><div contenteditable="true">汉</div><span translate="no">汉</span>';
    const c = createDocumentConverter(async () => {
      throw Error("engine unavailable");
    });
    await expect(c.convert(document.body, options)).rejects.toThrow("engine unavailable");
    expect(document.querySelector("p")!.textContent).toBe("汉");
  });
  it("keeps DOM boundaries and element identity when converting a selection", async () => {
    document.body.innerHTML = "<p>前汉<b>字</b>後</p>";
    const b = document.querySelector("b")!;
    const first = document.querySelector("p")!.firstChild!;
    const last = b.firstChild!;
    const range = document.createRange();
    range.setStart(first, 1);
    range.setEnd(last, 1);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    const seen: string[][] = [];
    const c = createDocumentConverter(async (texts) => {
      seen.push(texts);
      return texts.map((x) => x.replaceAll("汉", "漢"));
    });
    await c.selection(sel, options);
    expect(document.querySelector("b")).toBe(b);
    expect(document.body.textContent).toBe("前漢字後");
    expect(seen[0]).toEqual(["汉", "字"]);
  });
});
it("converts a selection spanning multiple batches without losing later selected nodes", async () => {
  document.body.innerHTML = Array.from(
    { length: 130 },
    (_, i) => "<span>" + (i === 0 ? "前汉" : "汉") + "</span>",
  ).join("");
  const range = document.createRange();
  range.setStart(document.body.firstChild!.firstChild!, 1);
  range.setEnd(document.body.lastChild!.firstChild!, 1);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const c = createDocumentConverter(async (xs) => xs.map((x) => x.replaceAll("汉", "漢")));
  await c.selection(selection, { preset: "s2twp", mode: "jieba" });
  expect(document.body.textContent).toBe("前" + "漢".repeat(130));
});
it.each(["move-out", "insert", "reorder"])(
  "discards a selection when its text membership changes by %s",
  async (mutation) => {
    document.body.innerHTML =
      '<p><span id="a">汉甲</span><span id="m">汉中</span><span id="n">汉新</span><span id="b">汉乙</span></p>';
    const parent = document.querySelector("p")!,
      first = document.getElementById("a")!,
      middle = document.getElementById("m")!,
      next = document.getElementById("n")!,
      last = document.getElementById("b")!;
    const range = document.createRange();
    range.setStart(first.firstChild!, 0);
    range.setEnd(last.firstChild!, 2);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    let complete!: () => void;
    const c = createDocumentConverter(
      (texts) =>
        new Promise((resolve) => {
          complete = () => resolve(texts.map((text) => text.replaceAll("汉", "漢")));
        }),
    );
    const pending = c.selection(selection, { preset: "s2twp", mode: "jieba" });
    if (mutation === "move-out") parent.append(middle);
    else if (mutation === "reorder") parent.insertBefore(next, middle);
    else {
      const inserted = document.createElement("span");
      inserted.textContent = "汉加";
      parent.insertBefore(inserted, last);
    }
    const before = parent.textContent;
    complete();
    expect(await pending).toBe(0);
    expect(parent.textContent).toBe(before);
  },
);
