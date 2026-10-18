import { createRemoteSettingsStore } from "../../src/application/settings/settings-store.js";
import { createPopupController } from "../../src/application/ui/popup-controller.js";
import { createOptionsController } from "../../src/application/ui/options-controller.js";
import { createBrowserPlatform } from "../../src/platform/browser-platform.js";
const platform = createBrowserPlatform();
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const store = createRemoteSettingsStore(platform);
const settingsButton = get<HTMLButtonElement>("show-settings");
const showSettings = () => {
  const settings = get<HTMLDetailsElement>("settings");
  settings.open = true;
  settings.scrollIntoView({ block: "start" });
  settings.querySelector("summary")?.focus();
};
settingsButton.addEventListener("click", showSettings);
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
  store,
);
const settingsController = createOptionsController(
  platform,
  {
    whitelist: get("whitelist"),
    saveButton: get("save-settings"),
    retryButton: get("retry-settings"),
    status: get("settings-status"),
    siteRules: get("site-rules"),
  },
  store,
);
await Promise.all([controller.initialize(), settingsController.initialize()]);
window.addEventListener(
  "pagehide",
  () => {
    controller.dispose();
    settingsController.dispose();
    settingsButton.removeEventListener("click", showSettings);
  },
  { once: true },
);
