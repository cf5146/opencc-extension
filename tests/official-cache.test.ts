import { describe, expect, it } from "vitest";
import { createDocumentConverter } from "../src/application/official/document-converter.js";
const options = { preset: "s2twp" as const, mode: "jieba" as const };
function fixture() {
  const requests: string[][] = [];
  const converter = createDocumentConverter(async (texts) => {
    requests.push(texts);
    return texts.map((text) => text.replaceAll("汉", "漢"));
  });
  const render = (texts: string[]) => {
    document.body.replaceChildren(
      ...texts.map((text) => {
        const p = document.createElement("p");
        p.textContent = text;
        return p;
      }),
    );
  };
  return { converter, requests, render };
}
describe("page-local conversion reuse", () => {
  it("converts duplicate inputs once without joining node boundaries", async () => {
    const { converter, requests, render } = fixture();
    render(["汉甲", "汉乙", "汉甲"]);
    await converter.convert(document.body, options);
    expect(requests).toEqual([["汉甲", "汉乙"]]);
    expect([...document.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["漢甲", "漢乙", "漢甲"]);
  });
  it("reuses a result for new nodes on this page but not another converter", async () => {
    const { converter, requests, render } = fixture();
    render(["汉"]);
    await converter.convert(document.body, options);
    render(["汉"]);
    await converter.convert(document.body, options);
    expect(requests).toEqual([["汉"]]);
    const other = fixture();
    await other.converter.convert(document.body, options);
    expect(other.requests).toEqual([["漢"]]);
  });
  it("partitions results by preset and segmentation mode", async () => {
    const { converter, requests, render } = fixture();
    for (const next of [options, { ...options, mode: "mmseg" as const }, { ...options, preset: "s2hk" as const }]) {
      render(["汉"]);
      await converter.convert(document.body, next);
    }
    expect(requests).toEqual([["汉"], ["汉"], ["汉"]]);
  });
  it("evicts least recently used results at the 2048-entry limit", async () => {
    const { converter, requests, render } = fixture();
    render(Array.from({ length: 2048 }, (_, i) => "汉" + i));
    await converter.convert(document.body, options);
    render(["汉0"]);
    await converter.convert(document.body, options);
    render(["汉2048"]);
    await converter.convert(document.body, options);
    requests.length = 0;
    render(["汉0", "汉1"]);
    await converter.convert(document.body, options);
    expect(requests).toEqual([["汉1"]]);
    expect(document.body.textContent).toBe("漢0漢1");
  });
  it("evicts by accounted UTF16 bytes before reaching the entry limit", async () => {
    const { converter, requests, render } = fixture();
    const a = "汉" + "a".repeat(80000),
      b = "汉" + "b".repeat(80000);
    render([a]);
    await converter.convert(document.body, options);
    render([b]);
    await converter.convert(document.body, options);
    requests.length = 0;
    render([a]);
    await converter.convert(document.body, options);
    expect(requests).toEqual([[a]]);
  });
  it("does not retain a result larger than the entire cache", async () => {
    const { converter, requests, render } = fixture();
    const text = "汉".repeat(140000);
    render([text]);
    await converter.convert(document.body, options);
    render([text]);
    await converter.convert(document.body, options);
    expect(requests).toHaveLength(2);
  });
  it("does not cache malformed batch responses", async () => {
    let calls = 0;
    const converter = createDocumentConverter(async () => (++calls === 1 ? [] : ["漢"]));
    document.body.innerHTML = "<p>汉</p>";
    await expect(converter.convert(document.body, options)).rejects.toThrow();
    await converter.convert(document.body, options);
    expect(calls).toBe(2);
    expect(document.body.textContent).toBe("漢");
  });
  it("does not commit a cached result after cancellation", async () => {
    const { converter, render } = fixture();
    render(["汉"]);
    await converter.convert(document.body, options);
    render(["汉"]);
    const pending = converter.convert(document.body, options);
    converter.cancel();
    await pending;
    expect(document.body.textContent).toBe("汉");
  });
});
it("does not repopulate a cleared page cache with a canceled in-flight response", async () => {
  let resolve!: (texts: string[]) => void;
  let calls = 0;
  const converter = createDocumentConverter(async () => {
    if (++calls === 1)
      return new Promise<string[]>((done) => {
        resolve = done;
      });
    return ["漢"];
  });
  document.body.innerHTML = "<p>汉</p>";
  const pending = converter.convert(document.body, options);
  converter.cancel();
  converter.clearCache();
  resolve(["漢"]);
  await pending;
  expect(document.body.textContent).toBe("汉");
  await converter.convert(document.body, options);
  expect(document.body.textContent).toBe("漢");
  expect(calls).toBe(2);
});
