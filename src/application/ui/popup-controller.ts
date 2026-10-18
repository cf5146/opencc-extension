import { convertPlainText } from "../../core/conversion.js";
import type { LocaleCode } from "../../domain/conversion/locales.js";
import type { ExtensionPlatform } from "../../platform/types.js";
import type { ConversionResponse, UnavailableReason } from "../../runtime/messages.js";
import { normalizeHostname, type Settings } from "../settings/settings.js";
import { createRemoteSettingsStore, type SettingsStore } from "../settings/settings-store.js";

export interface PopupElements {
  originSelect: HTMLSelectElement;
  targetSelect: HTMLSelectElement;
  swapButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  textbox: HTMLTextAreaElement;
  result: HTMLTextAreaElement;
  convertButton: HTMLButtonElement;
  autoCheckbox: HTMLInputElement;
  status: HTMLElement;
  subtitle: HTMLElement | null;
  retryButton: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  siteSelect: HTMLSelectElement;
  hostname: HTMLElement;
  policy: HTMLElement;
}
export interface PopupController {
  initialize(): Promise<void>;
  dispose(): void;
}
export interface PopupPorts {
  copy(text: string): Promise<void>;
}
const unavailableMessages: Record<UnavailableReason, string> = {
  "no-active-tab": "目前沒有可轉換的網頁。",
  "unsupported-scheme": "此網頁網址不支援轉換。",
  "missing-content-script": "請重新整理網頁後再試一次。",
  "injection-denied": "瀏覽器拒絕存取此網頁。",
  "protected-page": "瀏覽器不允許擴充功能存取此網頁。",
  "unsupported-capability": "此瀏覽器無法轉換此網頁。",
};
export function createPopupController(
  platform: ExtensionPlatform,
  e: PopupElements,
  store: SettingsStore = createRemoteSettingsStore(platform),
  ports: PopupPorts = { copy: (text) => navigator.clipboard.writeText(text) },
): PopupController {
  let disposed = false,
    ready = false,
    busy = false,
    composing = false;
  let initializing: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let hostname: string | undefined;
  let pending = 0;
  type PopupPatch = Partial<Pick<Settings, "origin" | "target" | "auto">>;
  const intent: PopupPatch = {};
  const revisions = { origin: 0, target: 0, auto: 0 };
  let siteDirty = false;
  let siteRevision = 0;
  let queue: Promise<void> = Promise.resolve();
  const failed: Array<() => Promise<unknown>> = [];
  const listeners: Array<() => void> = [];
  const status = (text: string, kind = "success") => {
    if (disposed) return;
    e.status.textContent = text;
    e.status.className = `status-${kind}`;
  };
  const updateButtons = () => {
    e.convertButton.disabled = !ready || busy || e.originSelect.value === e.targetSelect.value;
    e.siteSelect.disabled = !ready || !hostname;
    e.copyButton.disabled = !ready || !e.result.value;
  };
  const interactive = () => {
    for (const el of [e.originSelect, e.targetSelect, e.swapButton, e.resetButton, e.textbox, e.autoCheckbox])
      el.disabled = !ready;
    updateButtons();
  };
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const preview = () => {
    cancel();
    if (!ready || disposed || composing) return;
    try {
      e.result.value = convertPlainText(
        e.textbox.value,
        e.originSelect.value as LocaleCode,
        e.targetSelect.value as LocaleCode,
      );
    } catch {
      status("文字轉換失敗，原文已保留。", "error");
    }
    updateButtons();
  };
  const schedule = () => {
    cancel();
    if (ready && !disposed && !composing) timer = setTimeout(preview, 250);
  };
  const renderPolicy = () => {
    const rule = e.siteSelect.value;
    if (!hostname) {
      e.policy.textContent = "網站規則僅適用於 HTTP 與 HTTPS 網頁。";
      return;
    }
    const policies: Record<string, string> = {
      never: "不要自動轉換",
      always: "一律自動轉換",
      default: e.autoCheckbox.checked ? "使用預設設定（已開啟）" : "使用預設設定（已關閉）",
    };
    e.policy.textContent = `目前設定：${policies[rule]}。排除規則仍會生效；明確標示為非中文的網頁將略過自動轉換。`;
  };
  const apply = (settings: Settings) => {
    if (disposed) return;
    for (const select of [e.originSelect, e.targetSelect]) {
      if ((settings.origin === "jp" || settings.target === "jp") && !select.querySelector('option[value="jp"]')) {
        const option = document.createElement("option");
        option.value = "jp";
        option.textContent = "日文漢字（舊版設定）";
        select.append(option);
      }
    }
    if (intent.origin === undefined) e.originSelect.value = settings.origin;
    if (intent.target === undefined) e.targetSelect.value = settings.target;
    if (intent.auto === undefined) e.autoCheckbox.checked = settings.auto;
    if (!siteDirty) e.siteSelect.value = hostname ? (settings.siteRules[hostname] ?? "default") : "default";
    renderPolicy();
    preview();
    updateButtons();
  };
  const enqueue = (operation: () => Promise<unknown>) => {
    pending++;
    const run = async () => {
      if (disposed) {
        pending--;
        return;
      }
      try {
        await operation();
        if (disposed) return;
        if (!failed.length) {
          status("設定已儲存。");
          e.retryButton.hidden = true;
        }
      } catch {
        if (disposed) return;
        failed.push(operation);
        status("無法儲存設定，請重試以套用變更。", "error");
        e.retryButton.hidden = false;
      } finally {
        pending--;
      }
    };
    // Start the first write immediately and serialize subsequent writes.
    queue = pending === 1 ? run() : queue.then(run);
  };
  const persist = (patch: PopupPatch) => {
    const keys = Object.keys(patch) as Array<keyof PopupPatch>;
    Object.assign(intent, patch);
    for (const key of keys) revisions[key]++;
    const snapshot = { ...revisions };
    enqueue(async () => {
      const settings = await store.set(patch);
      for (const key of keys) if (revisions[key] === snapshot[key]) delete intent[key];
      apply(settings);
    });
  };
  const persistSite = () => {
    if (!hostname) return;
    const host = hostname,
      rule = e.siteSelect.value;
    siteDirty = true;
    const revision = ++siteRevision;
    enqueue(async () => {
      if (!store.setSiteRule) throw new Error("Site rules unavailable");
      const settings = await store.setSiteRule(host, rule === "default" ? null : (rule as "always" | "never"));
      if (siteRevision === revision) siteDirty = false;
      apply(settings);
    });
  };
  const directionChanged = (patch: PopupPatch) => {
    if (!ready || disposed) return;
    persist(patch);
    preview();
    updateButtons();
  };
  const convert = async () => {
    if (!ready || disposed || busy || e.originSelect.value === e.targetSelect.value) return;
    busy = true;
    updateButtons();
    try {
      // A new edit can append a save while a previous save is pending.
      while (pending) await queue;
      if (disposed) return;
      if (failed.length) {
        status("無法儲存設定，請先重試再轉換網頁。", "error");
        return;
      }
      status("正在轉換網頁…");
      const response = await platform.runtime.send<ConversionResponse>({ type: "convert-active-tab" });
      switch (response.kind) {
        case "success":
          status(`已轉換 ${response.count} 個節點，耗時 ${response.time} 毫秒`);
          break;
        case "no-op":
          status("此網頁不需要轉換。", "no-op");
          break;
        case "reload-required":
          status("請重新整理網頁以套用新的轉換方向。", "reload-required");
          break;
        case "unavailable":
          status(unavailableMessages[response.reason], "unavailable");
          break;
        case "invalid-settings":
          status("已儲存的語言設定無效。", "error");
          break;
        case "internal-failure":
          status("網頁轉換失敗，請再試一次。", "error");
          break;
      }
    } catch {
      status("網頁轉換失敗，請再試一次。", "error");
    } finally {
      busy = false;
      if (!disposed) updateButtons();
    }
  };
  const on = (el: HTMLElement, name: string, handler: () => void) => {
    el.addEventListener(name, handler);
    listeners.push(() => el.removeEventListener(name, handler));
  };
  on(e.originSelect, "change", () => directionChanged({ origin: e.originSelect.value as LocaleCode }));
  on(e.targetSelect, "change", () => directionChanged({ target: e.targetSelect.value as LocaleCode }));
  on(e.swapButton, "click", () => {
    if (!ready || disposed) return;
    const origin = e.originSelect.value as LocaleCode,
      target = e.targetSelect.value as LocaleCode;
    e.originSelect.value = target;
    e.targetSelect.value = origin;
    directionChanged({ origin: target, target: origin });
  });
  on(e.textbox, "input", schedule);
  on(e.textbox, "compositionstart", () => {
    composing = true;
    cancel();
  });
  on(e.textbox, "compositionend", () => {
    composing = false;
    schedule();
  });
  on(e.resetButton, "click", () => {
    if (!ready || disposed) return;
    cancel();
    e.textbox.value = "";
    e.result.value = "";
    updateButtons();
  });
  on(e.autoCheckbox, "change", () => {
    if (!ready || disposed) return;
    persist({ auto: e.autoCheckbox.checked });
    renderPolicy();
  });
  on(e.siteSelect, "change", () => {
    if (!ready || disposed || !hostname) return;
    persistSite();
    renderPolicy();
  });
  on(e.convertButton, "click", () => {
    void convert();
  });
  on(e.copyButton, "click", () => {
    if (!ready || disposed) return;
    void (async () => {
      try {
        await ports.copy(e.result.value);
        status("已複製轉換結果。");
      } catch {
        status("無法複製，請選取轉換結果並手動複製。", "error");
      }
    })();
  });
  on(e.retryButton, "click", () => {
    if (disposed) return;
    if (!ready) {
      void initialize();
      return;
    }
    if (pending || !failed.length) return;
    failed.length = 0;
    // Retry only unsaved fields; newer successful writes supersede failed patches.
    if (Object.keys(intent).length) persist({ ...intent });
    if (siteDirty) persistSite();
    if (!pending) {
      status("設定已儲存。");
      e.retryButton.hidden = true;
    }
  });
  interactive();
  e.result.readOnly = true;
  e.retryButton.hidden = true;
  function initialize(): Promise<void> {
    if (disposed || ready) return Promise.resolve();
    if (initializing !== undefined) return initializing;
    initializing = (async () => {
      try {
        const settings = await store.load();
        let url: string | undefined;
        try {
          url = (await platform.tabs.getActive())?.url;
        } catch {
          /* Site controls stay unavailable. */
        }
        if (disposed) return;
        hostname = url ? normalizeHostname(url) : undefined;
        e.hostname.textContent = hostname ?? "無法取得目前網頁";
        ready = true;
        apply(settings);
        interactive();
        e.retryButton.hidden = true;
        unsubscribe = store.subscribe(apply);
        try {
          if (e.subtitle) {
            const version = platform.getManifest().version;
            e.subtitle.textContent = version ? `v${version}` : "";
          }
        } catch {
          /* Version is optional. */
        }
      } catch {
        if (disposed) return;
        status("無法載入設定，請重試。", "error");
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
      cancel();
      unsubscribe?.();
      for (const remove of listeners) remove();
    },
  };
}
