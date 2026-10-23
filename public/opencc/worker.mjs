import { loadOpenCC } from "./engine/runtime.mjs";
let session;
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue
    .catch(() => {})
    .then(async () => {
      try {
        session ??= await loadOpenCC();
        const texts = data.texts.map((text) => session.convert(data.config, text));
        self.postMessage({ id: data.id, texts });
      } catch (e) {
        self.postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) });
      }
    });
};
