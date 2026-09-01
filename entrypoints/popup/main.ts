import { createSettingsStore } from "../../src/application/settings/settings-store.js";
import { createPopupController } from "../../src/application/ui/popup-controller.js";
import { createBrowserPlatform } from "../../src/platform/browser-platform.js";

const platform = createBrowserPlatform();
const settingsStore = createSettingsStore(platform.storage);
const controller = createPopupController(
  platform,
  {
    originSelect: document.getElementById("origin") as HTMLSelectElement,
    targetSelect: document.getElementById("target") as HTMLSelectElement,
    swapButton: document.getElementById("swap") as HTMLButtonElement,
    resetButton: document.getElementById("reset") as HTMLButtonElement,
    textbox: document.getElementById("textbox") as HTMLTextAreaElement,
    convertButton: document.getElementById("convert") as HTMLButtonElement,
    autoCheckbox: document.getElementById("auto") as HTMLInputElement,
    status: document.getElementById("status") as HTMLElement,
    subtitle: document.getElementById("subtitle"),
  },
  settingsStore,
);

try {
  await controller.initialize();
} catch {
  // Initialization failures are contained by the UI controller.
}
