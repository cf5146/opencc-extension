import type { ExtensionPlatform } from "../../platform/types.js";
import type { Settings, SettingsPatch } from "../settings/settings.js";
import { createRemoteSettingsStore, type SettingsStore } from "../settings/settings-store.js";
export interface OptionsElements {
  whitelist: HTMLTextAreaElement;
  autoCheckbox?: HTMLInputElement;
  saveButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  status: HTMLElement;
  siteRules: HTMLElement;
}
export interface OptionsController {
  initialize(): Promise<void>;
  dispose(): void;
}
export function createOptionsController(
  platform: ExtensionPlatform,
  e: OptionsElements,
  store: SettingsStore = createRemoteSettingsStore(platform),
): OptionsController {
  let disposed = false,
    ready = false,
    dirtyPatterns = false,
    dirtyAuto = false,
    busy = false;
  let initializing: Promise<void> | undefined;
  let unsubscribe: (() => void) | undefined;
  let patternRevision = 0;
  let autoRevision = 0;
  const listeners: Array<() => void> = [];
  const say = (message: string) => {
    if (!disposed) e.status.textContent = message;
  };
  const gate = () => {
    e.whitelist.disabled = !ready;
    if (e.autoCheckbox) e.autoCheckbox.disabled = !ready;
    e.saveButton.disabled = !ready || busy;
  };
  const renderRules = (settings: Settings) => {
    e.siteRules.replaceChildren();
    for (const [hostname, rule] of Object.entries(settings.siteRules)) {
      const li = document.createElement("li"),
        button = document.createElement("button");
      li.append(document.createTextNode(`${hostname} — ${rule === "always" ? "一律自動轉換" : "不要自動轉換"} `));
      button.type = "button";
      button.textContent = "移除";
      button.setAttribute("aria-label", `移除 ${hostname} 的規則`);
      button.addEventListener("click", () => {
        if (disposed || busy) return;
        busy = true;
        gate();
        button.disabled = true;
        void (async () => {
          try {
            if (!store.setSiteRule) throw new Error("Unavailable");
            const settings = await store.setSiteRule(hostname, null);
            if (!disposed) {
              renderRules(settings);
              say("已移除網站規則。");
            }
          } catch {
            say("無法移除網站規則，請再按一次「移除」。");
          } finally {
            busy = false;
            if (!disposed) {
              button.disabled = false;
              gate();
            }
          }
        })();
      });
      li.append(button);
      e.siteRules.append(li);
    }
    if (!e.siteRules.childNodes.length) {
      const li = document.createElement("li");
      li.textContent = "尚無網站規則，所有網站使用預設設定。";
      e.siteRules.append(li);
    }
  };
  const apply = (settings: Settings) => {
    if (disposed) return;
    renderRules(settings);
    if (!dirtyPatterns) e.whitelist.value = settings.whitelist.join("\n");
    if (!dirtyAuto && e.autoCheckbox) e.autoCheckbox.checked = settings.auto;
  };
  const edit = () => {
    if (!ready || disposed) return;
    e.saveButton.textContent = "儲存變更";
    say("有尚未儲存的變更。");
  };
  const save = async () => {
    if (!ready || disposed || busy) return;
    if (!dirtyAuto && !dirtyPatterns) {
      say("沒有需要儲存的變更。");
      return;
    }
    const whitelist = e.whitelist.value.split(/\r?\n/).filter((line) => line.trim().length > 0);
    for (let i = 0; dirtyPatterns && i < whitelist.length; i++)
      try {
        new RegExp(whitelist[i]!);
      } catch {
        say(`第 ${i + 1} 行的正規表示式無效，已儲存的排除規則未變更。`);
        return;
      }
    const savedPatternRevision = patternRevision;
    const savedAutoRevision = autoRevision;
    const patch: SettingsPatch = {};
    if (dirtyPatterns) patch.whitelist = whitelist;
    if (dirtyAuto && e.autoCheckbox) patch.auto = e.autoCheckbox.checked;
    busy = true;
    gate();
    say("正在儲存…");
    try {
      await store.set(patch);
      if (disposed) return;
      if (patch.whitelist && patternRevision === savedPatternRevision) dirtyPatterns = false;
      if (patch.auto !== undefined && autoRevision === savedAutoRevision) dirtyAuto = false;
      if (!dirtyPatterns && !dirtyAuto) {
        e.saveButton.textContent = "儲存變更";
        say("已儲存變更。");
      } else say("先前的變更已儲存，您仍有尚未儲存的變更。");
    } catch {
      if (disposed) return;
      say("無法儲存變更，您的編輯已保留；請按「儲存／重試」。");
      e.saveButton.textContent = "儲存／重試";
    } finally {
      busy = false;
      if (!disposed) gate();
    }
  };
  const on = (el: HTMLElement, event: string, fn: () => void) => {
    el.addEventListener(event, fn);
    listeners.push(() => el.removeEventListener(event, fn));
  };
  on(e.whitelist, "input", () => {
    if (!ready || disposed) return;
    dirtyPatterns = true;
    patternRevision++;
    edit();
  });
  if (e.autoCheckbox)
    on(e.autoCheckbox, "change", () => {
      if (!ready || disposed) return;
      dirtyAuto = true;
      autoRevision++;
      edit();
    });
  on(e.saveButton, "click", () => {
    void save();
  });
  on(e.retryButton, "click", () => {
    void initialize();
  });
  gate();
  e.retryButton.hidden = true;
  function initialize(): Promise<void> {
    if (disposed || ready) return Promise.resolve();
    if (initializing !== undefined) return initializing;
    initializing = (async () => {
      try {
        const settings = await store.load();
        if (disposed) return;
        ready = true;
        apply(settings);
        gate();
        e.retryButton.hidden = true;
        unsubscribe = store.subscribe(apply);
      } catch {
        if (disposed) return;
        say("無法載入設定，請重試。");
        e.retryButton.hidden = false;
      } finally {
        initializing = undefined;
      }
    })();
    return initializing;
  }
  return {
    initialize,
    dispose() {
      disposed = true;
      ready = false;
      unsubscribe?.();
      for (const remove of listeners) remove();
    },
  };
}
