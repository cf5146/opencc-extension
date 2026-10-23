import { it, expect, vi } from "vitest";
import { createWorkerEngine } from "../public/opencc/host.mjs";
it("reuses only the active config and terminates on config changes", async () => {
  const workers: any[] = [];
  const create = () => {
    const w: any = {
      terminate: vi.fn(),
      postMessage: vi.fn((request: any) =>
        queueMicrotask(() =>
          w.onmessage({ data: { id: request.id, texts: request.texts.map((s: string) => s + "!") } }),
        ),
      ),
    };
    workers.push(w);
    return w;
  };
  const e = createWorkerEngine(create);
  expect(await e.convert("s2t_jieba", ["汉"])).toEqual(["汉!"]);
  await e.convert("s2t_jieba", ["字"]);
  expect(workers.length).toBe(1);
  await e.convert("s2t", ["汉"]);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(workers.length).toBe(2);
  e.dispose();
  expect(workers[1].terminate).toHaveBeenCalledOnce();
  await expect(e.convert("s2t", ["字"])).rejects.toThrow();
});
it("serializes callers and restarts after a worker error without switching mode", async () => {
  const workers: any[] = [];
  const requests: any[] = [];
  const e = createWorkerEngine(() => {
    const w: any = {
      terminate: vi.fn(),
      postMessage: (r: any) => {
        requests.push(r);
        queueMicrotask(() =>
          w.onmessage({ data: workers.length === 1 ? { id: r.id, error: "failed" } : { id: r.id, texts: r.texts } }),
        );
      },
    };
    workers.push(w);
    return w;
  });
  await expect(e.convert("s2t_jieba", ["汉"])).rejects.toThrow("failed");
  expect(await e.convert("s2t_jieba", ["字"])).toEqual(["字"]);
  expect(requests.map((x) => x.config)).toEqual(["s2t_jieba", "s2t_jieba"]);
  e.dispose();
});
it("ignores late events from a failed old worker after a replacement succeeds", async () => {
  const workers: any[] = [];
  const e = createWorkerEngine(() => {
    const w: any = {
      terminate: vi.fn(),
      postMessage: (r: any) =>
        queueMicrotask(() =>
          w.onmessage({
            data: workers.length === 1 ? { id: r.id, error: "old failure" } : { id: r.id, texts: r.texts },
          }),
        ),
    };
    workers.push(w);
    return w;
  });
  try {
    await expect(e.convert("s2t_jieba", ["汉"])).rejects.toThrow("old failure");
    await e.convert("s2t_jieba", ["字"]);
    workers[0].onerror({ message: "late old error" });
    expect(workers[1].terminate).not.toHaveBeenCalled();
  } finally {
    e.dispose();
  }
});
