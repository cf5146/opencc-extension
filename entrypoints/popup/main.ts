import { createRemoteSettingsStore } from "../../src/application/settings/settings-store.js";
import { createPopupController } from "../../src/application/ui/popup-controller.js";
import { createBrowserPlatform } from "../../src/platform/browser-platform.js";
const platform = createBrowserPlatform();
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const controller = createPopupController(
  platform,
  {
    originSelect: get("origin"),
    targetSelect: get("target"),
    swapButton: get("swap"),
    resetButton: get("reset"),
    textbox: get("textbox"),
    result: get("result"),
    convertButton: get("convert"),
    autoCheckbox: get("auto"),
    status: get("status"),
    subtitle: get("subtitle"),
    retryButton: get("retry"),
    copyButton: get("copy"),
    siteSelect: get("site-rule"),
    hostname: get("hostname"),
    policy: get("policy"),
  },
  createRemoteSettingsStore(platform),
);
await controller.initialize();
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
