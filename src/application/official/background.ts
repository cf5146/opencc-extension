import { browser } from "wxt/browser";
import { createBrowserPlatform } from "../../platform/browser-platform.js";
import { convertActiveTab } from "../runtime/background-runtime.js";
import { loadSettings } from "./store.js";
import { SETTINGS_KEY, isRecord, isOptions, normalizeSiteHostname } from "./settings.js";
import { runEngine } from "./engine.js";
export function startOfficialBackground() {
  const platform = createBrowserPlatform();
  let writes: Promise<unknown> = Promise.resolve();
  void platform.contextMenus.ensureSelectionMenu().catch(() => {});
  platform.contextMenus.subscribe((info) => {
    if (info.menuItemId === "convert-selection" && info.tabId !== undefined)
      void platform.tabs.send(info.tabId, { type: "convert-selection" }).catch(() => {});
  });
  const handleMessage = (message: unknown, sender: { url?: string; tab?: { id?: number } }) => {
    if (!isRecord(message) || message.target === "opencc-offscreen") return false;
    if (message.type === "convert-active-tab") return convertActiveTab(platform);
    if (message.type === "official-convert") {
      const cfg = message.config;
      const preset = typeof cfg === "string" ? cfg.replace(/_jieba$/, "") : "";
      if (
        !isOptions({ preset, mode: typeof cfg === "string" && cfg.endsWith("_jieba") ? "jieba" : "mmseg" }) ||
        !Array.isArray(message.texts) ||
        message.texts.length > 128 ||
        message.texts.some((v) => typeof v !== "string")
      )
        return Promise.resolve({ error: "無效的轉換要求。" });
      return runEngine(cfg as string, message.texts as string[]).then(
        (texts) => ({ texts }),
        (e) => ({ error: e instanceof Error ? e.message : "轉換失敗；原文保留。" }),
      );
    }
    if (message.type !== "official-settings") return false;
    const expected = new URL(browser.runtime.getURL("/"));
    let permitted = false;
    try {
      const url = new URL(sender.url ?? "");
      permitted = url.protocol === expected.protocol && url.host === expected.host;
    } catch {
      /* Untrusted sender. */
    }
    if (!permitted) return Promise.resolve({ error: "只有擴充功能設定頁可修改設定。" });
    const job = writes
      .catch(() => {})
      .then(async () => {
        const settings = await loadSettings();
        if (message.action === "defaults") {
          if (!isOptions(message.options)) throw Error("無效的官方設定。");
          settings.preset = message.options.preset;
          settings.mode = message.options.mode;
          if (message.hostname !== undefined) {
            const host = typeof message.hostname === "string" ? normalizeSiteHostname(message.hostname) : undefined;
            if (!host) throw Error("無效的網站名稱。");
            settings.sites[host] = { preset: settings.preset, mode: settings.mode };
          }
        } else if (message.action === "site") {
          const host = typeof message.hostname === "string" ? normalizeSiteHostname(message.hostname) : undefined;
          if (!host) throw Error("無效的網站名稱。");
          if (message.options === null) delete settings.sites[host];
          else if (isOptions(message.options))
            settings.sites[host] = { preset: message.options.preset, mode: message.options.mode };
          else throw Error("無效的網站設定。");
        } else if (message.action === "dismiss") settings.migrationNotice = false;
        else throw Error("未知的設定要求。");
        await browser.storage.local.set({ [SETTINGS_KEY]: settings });
        return { settings };
      });
    writes = job;
    return job.catch((e) => ({ error: e.message }));
  };
  browser.runtime.onMessage.addListener(
    (message: unknown, sender: { url?: string; tab?: { id?: number } }, sendResponse: (response: unknown) => void) => {
      const response = handleMessage(message, sender);
      if (response === false) return false;
      // Callback responses also work on Chromium versions without Promise listeners.
      void response.then(sendResponse, (e) =>
        sendResponse({ error: e instanceof Error ? e.message : "轉換失敗；原文保留。" }),
      );
      return true;
    },
  );
}
