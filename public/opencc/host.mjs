// One serialized worker, one active configuration; termination reclaims WASM memory.
export function createWorkerEngine(
  create = () => new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" }),
) {
  let worker,
    config,
    waiting,
    id = 0,
    closed = false,
    idle,
    queue = Promise.resolve();
  const reset = () => {
    clearTimeout(idle);
    worker?.terminate();
    worker = undefined;
    config = undefined;
  };
  const convert = (next, texts) => {
    const job = queue
      .catch(() => {})
      .then(() => {
        if (closed) throw new Error("OpenCC engine closed");
        clearTimeout(idle);
        if (config !== next) {
          reset();
          worker = create();
          config = next;
        }
        return new Promise((resolve, reject) => {
          let settled = false;
          const key = ++id,
            timer = setTimeout(() => fail(new Error("轉換逾時；原文保留。")), 120000);
          const fail = (e) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            waiting = undefined;
            reset();
            reject(e);
          };
          waiting = fail;
          worker.onerror = (e) => fail(new Error(e.message || "Worker failed"));
          worker.onmessage = ({ data }) => {
            if (settled || data.id !== key) return;
            if (data.error) {
              fail(new Error(data.error));
              return;
            }
            settled = true;
            clearTimeout(timer);
            waiting = undefined;
            idle = setTimeout(reset, 60000);
            resolve(data.texts);
          };
          try {
            worker.postMessage({ id: key, config: next, texts });
          } catch (e) {
            fail(e);
          }
        });
      });
    queue = job;
    return job;
  };
  return {
    convert,
    dispose() {
      closed = true;
      waiting?.(new Error("OpenCC engine closed"));
      reset();
    },
  };
}
