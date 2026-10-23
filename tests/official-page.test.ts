import { it, expect } from "vitest";
import { createPageController } from "../src/application/official/page-controller.js";
import { normalizeOfficialSettings } from "../src/application/official/settings.js";
it("stops a pending automatic conversion when a site is disabled", async () => {
  document.body.innerHTML = "<p>汉字</p>";
  let resolve!: (x: string[]) => void;
  const c = createPageController(
    document,
    () => new Promise((r) => (resolve = r)),
    () => "https://example.com",
  );
  c.update(normalizeOfficialSettings({ version: 2, sites: { "example.com": { preset: "s2twp", mode: "jieba" } } }));
  await new Promise((r) => setTimeout(r, 20));
  c.update(normalizeOfficialSettings({ version: 2, sites: {} }));
  resolve(["漢字"]);
  await new Promise((r) => setTimeout(r, 20));
  expect(document.querySelector("p")!.textContent).toBe("汉字");
  c.dispose();
});
it("reports reload instead of applying another config to already converted DOM", async () => {
  document.body.innerHTML = "<p>汉字</p>";
  const c = createPageController(
    document,
    async (xs) => xs.map((x) => x.replace("汉", "漢")),
    () => "https://example.com",
  );
  c.update(normalizeOfficialSettings({ version: 2, preset: "s2twp", mode: "jieba" }));
  expect((await c.manual(false)).kind).toBe("success");
  c.update(normalizeOfficialSettings({ version: 2, preset: "s2hk", mode: "jieba" }));
  expect((await c.manual(false)).kind).toBe("reload-required");
  c.dispose();
});
it("does not continue from title to body using old settings after an await", async () => {
  document.head.innerHTML = "<title>汉</title>";
  document.body.innerHTML = "<p>汉字</p>";
  let resolve!: (x: string[]) => void;
  let calls = 0;
  const c = createPageController(
    document,
    async (xs) => {
      calls++;
      if (calls === 1) return new Promise((r) => (resolve = r));
      return xs.map((x) => x.replace("汉", "漢"));
    },
    () => "https://example.com",
  );
  c.update(normalizeOfficialSettings({ version: 2, preset: "s2twp", mode: "jieba" }));
  const pending = c.manual(false);
  await Promise.resolve();
  await Promise.resolve();
  c.update(normalizeOfficialSettings({ version: 2, preset: "s2hk", mode: "jieba" }));
  resolve(["漢"]);
  await pending;
  expect(document.querySelector("p")!.textContent).toBe("汉字");
  expect(calls).toBe(1);
  c.dispose();
});
it("does not convert a later selection while the requested selection waits in the queue", async () => {
  document.head.innerHTML = "";
  document.body.innerHTML = '<p id="a">汉甲</p><p id="b">汉乙</p>';
  let resolve!: (v: string[]) => void;
  let calls = 0;
  const c = createPageController(
    document,
    async (xs) => {
      if (++calls === 1) return new Promise((r) => (resolve = r));
      return xs.map((x) => x.replace("汉", "漢"));
    },
    () => "https://example.com",
  );
  c.update(normalizeOfficialSettings({ version: 2 }));
  const first = c.manual(false);
  await Promise.resolve();
  await Promise.resolve();
  const select = (id: string) => {
    const r = document.createRange();
    r.selectNodeContents(document.getElementById(id)!);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  };
  select("a");
  const queued = c.manual(true);
  select("b");
  resolve(["汉甲", "汉乙"]);
  await first;
  await queued;
  expect(document.getElementById("b")!.textContent).toBe("汉乙");
  expect(calls).toBe(1);
  c.dispose();
});

it.each(["init-failure", "no-op", "stale-result"])(
  "allows another mode after %s without any DOM write",
  async (scenario) => {
    document.head.innerHTML = "";
    document.body.innerHTML = scenario === "no-op" ? "<p>English</p>" : "<p>汉字</p>";
    let calls = 0,
      resolve!: (xs: string[]) => void;
    const c = createPageController(document, async (xs) => {
      calls++;
      if (calls === 1 && scenario === "init-failure") throw Error("Jieba init failed");
      if (calls === 1 && scenario === "stale-result")
        return new Promise((r) => {
          resolve = r;
        });
      return xs.map((x) => x.replaceAll("汉", "漢"));
    });
    const initial = normalizeOfficialSettings({ version: 2, preset: "s2twp", mode: "jieba" });
    try {
      c.update(initial);
      const first = c.manual(false);
      if (scenario === "stale-result") {
        await Promise.resolve();
        await Promise.resolve();
        document.querySelector("p")!.firstChild!.nodeValue = "汉新";
        resolve(["漢字"]);
      }
      await first;
      c.update({ ...initial, mode: "mmseg" });
      const retry = await c.manual(false);
      expect(retry.kind).toBe(scenario === "no-op" ? "no-op" : "success");
      expect(document.body.textContent).toBe(
        scenario === "no-op" ? "English" : scenario === "stale-result" ? "漢新" : "漢字",
      );
    } finally {
      c.dispose();
    }
  },
);
it("retains reload protection when an earlier batch wrote before a later failure", async () => {
  document.head.innerHTML = "";
  document.body.innerHTML = "<span>汉</span>".repeat(129);
  let calls = 0;
  const c = createPageController(document, async (xs) => {
    if (++calls === 2) throw Error("later batch failed");
    return xs.map((x) => x.replaceAll("汉", "漢"));
  });
  const initial = normalizeOfficialSettings({ version: 2, preset: "s2twp", mode: "jieba" });
  try {
    c.update(initial);
    expect((await c.manual(false)).kind).toBe("internal-failure");
    expect(document.body.firstChild!.textContent).toBe("漢");
    expect(document.body.lastChild!.textContent).toBe("汉");
    c.update({ ...initial, mode: "mmseg" });
    expect((await c.manual(false)).kind).toBe("reload-required");
    expect(calls).toBe(2);
  } finally {
    c.dispose();
  }
});
