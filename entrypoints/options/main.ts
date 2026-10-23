import { loadSettings, mutateSettings, subscribeSettings } from "../../src/application/official/store.js";
import { PRESETS } from "../../src/application/official/settings.js";
const list = document.getElementById("site-rules")!,
  status = document.getElementById("status")!;
let alive = true,
  revision = 0;
const render = async () => {
  const expected = ++revision;
  try {
    const s = await loadSettings();
    if (!alive || expected !== revision) return;
    list.replaceChildren();
    for (const [host, options] of Object.entries(s.sites)) {
      const li = document.createElement("li"),
        button = document.createElement("button");
      li.append(document.createTextNode(`${host} — ${PRESETS[options.preset]} / ${options.mode} `));
      button.type = "button";
      button.textContent = "移除";
      button.setAttribute("aria-label", `移除 ${host} 的自動轉換`);
      button.onclick = () => {
        button.disabled = true;
        void mutateSettings("site", { hostname: host, options: null }).then(
          () => {
            status.textContent = "網站規則已移除。";
            void render();
          },
          () => {
            button.disabled = false;
            status.textContent = "儲存失敗，請重試。";
          },
        );
      };
      li.append(button);
      list.append(li);
    }
    if (!list.childNodes.length) list.textContent = "尚未啟用任何網站的自動轉換。";
  } catch {
    status.textContent = "設定讀取失敗，請重試。";
  }
};
document.getElementById("retry")!.onclick = () => void render();
const unsubscribe = subscribeSettings(() => void render());
addEventListener(
  "pagehide",
  () => {
    alive = false;
    unsubscribe();
  },
  { once: true },
);

await render();
