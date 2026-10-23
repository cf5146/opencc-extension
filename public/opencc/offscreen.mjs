import { createWorkerEngine } from "./host.mjs";
const engine = createWorkerEngine();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== "opencc-offscreen" || sender.id !== chrome.runtime.id) return false;
  engine.convert(message.config, message.texts).then(
    (texts) => respond({ texts }),
    (e) => respond({ error: e.message }),
  );
  return true;
});
addEventListener("pagehide", () => engine.dispose(), { once: true });
