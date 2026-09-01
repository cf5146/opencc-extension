import { createSettingsStore } from "../../src/application/settings/settings-store.js";
import { createOptionsController } from "../../src/application/ui/options-controller.js";
import { createBrowserPlatform } from "../../src/platform/browser-platform.js";

const platform = createBrowserPlatform();
const settingsStore = createSettingsStore(platform.storage);
const controller = createOptionsController(
  platform,
  {
    whitelist: document.getElementById("whitelist") as HTMLTextAreaElement,
  },
  settingsStore,
);

try {
  await controller.initialize();
} catch {
  // Initialization failures are contained by the UI controller.
}
