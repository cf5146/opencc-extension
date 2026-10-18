import { createRemoteSettingsStore } from "../../src/application/settings/settings-store.js";
import { createOptionsController } from "../../src/application/ui/options-controller.js";
import { createBrowserPlatform } from "../../src/platform/browser-platform.js";
const platform = createBrowserPlatform();
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const controller = createOptionsController(
  platform,
  {
    whitelist: get("whitelist"),
    autoCheckbox: get("auto"),
    saveButton: get("save"),
    retryButton: get("retry"),
    status: get("status"),
    siteRules: get("site-rules"),
  },
  createRemoteSettingsStore(platform),
);
await controller.initialize();
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
