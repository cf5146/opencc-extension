import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { captureSelection } from "../src/application/official/selection-snapshot.js";
import { createPageController } from "../src/application/official/page-controller.js";
import { convertTexts } from "../src/application/official/engine.js";
import { loadSettings, subscribeSettings } from "../src/application/official/store.js";
export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  allFrames: false,
  registration: "manifest",
  main(ctx) {
    let alive = true,
      loadRevision = 0;
    const report = (message: string) => {
      if (!alive) return;
      let status = document.getElementById("opencc-conversion-status");
      if (!status) {
        status = document.createElement("div");
        status.id = "opencc-conversion-status";
        status.setAttribute("role", "status");
        status.setAttribute("translate", "no");
        status.style.cssText =
          "position:fixed;bottom:12px;right:12px;z-index:2147483647;background:#fff;color:#333;border:1px solid;padding:12px;max-width:360px";
        document.body?.append(status);
      }
      status.textContent = "OpenCC：" + message;
    };
    const controller = createPageController(document, convertTexts, () => location.href, report);
    const refresh = async () => {
      const revision = ++loadRevision;
      try {
        const s = await loadSettings();
        if (!alive || revision !== loadRevision) return false;
        controller.update(s);
        return true;
      } catch {
        report("無法讀取設定；請重試。");
        return false;
      }
    };
    const listener = (message: unknown) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("type" in message) ||
        (message.type !== "convert-page" && message.type !== "convert-selection")
      )
        return false;
      const captured = message.type === "convert-selection" ? captureSelection(globalThis.getSelection()) : null;
      return refresh().then((ok) =>
        ok
          ? controller.manual(message.type === "convert-selection", captured)
          : { kind: "internal-failure", message: "無法讀取設定；原文保留，請重試。" },
      );
    };
    browser.runtime.onMessage.addListener(listener);
    const unsubscribe = subscribeSettings(() => {
      controller.update({ version: 2, preset: "s2twp", mode: "jieba", sites: {}, migrationNotice: false });
      void refresh();
    });
    void refresh();
    const route = () => void refresh();
    addEventListener("popstate", route);
    addEventListener("hashchange", route);
    ctx.onInvalidated(() => {
      alive = false;
      controller.dispose();
      unsubscribe();
      browser.runtime.onMessage.removeListener(listener);
      removeEventListener("popstate", route);
      removeEventListener("hashchange", route);
    });
  },
});
