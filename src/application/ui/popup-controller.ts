import { convertPlainText } from "../../core/conversion.js";
import type { LocaleCode } from "../../domain/conversion/locales.js";
import type { ExtensionPlatform } from "../../platform/types.js";
import type { ConversionResponse, UnavailableReason } from "../../runtime/messages.js";
import { DEFAULT_SETTINGS } from "../settings/settings.js";
import { createSettingsStore, type SettingsStore } from "../settings/settings-store.js";

const INPUT_DEBOUNCE_MS = 250;
const STATUS_CLASSES = [
  "status-success",
  "status-no-op",
  "status-reload-required",
  "status-unavailable",
  "status-error",
];

const unavailableMessages: Record<UnavailableReason, string> = {
  "no-active-tab": "NO ACTIVE TAB",
  "unsupported-scheme": "NO ACCESS / UNSUPPORTED PAGE",
  "missing-content-script": "NO ACCESS / MISSING CONTENT SCRIPT",
  "injection-denied": "NO ACCESS / PAGE ACCESS DENIED",
  "protected-page": "NO ACCESS / PROTECTED PAGE",
  "unsupported-capability": "NO ACCESS / UNSUPPORTED CAPABILITY",
};

export interface PopupElements {
  originSelect: HTMLSelectElement;
  targetSelect: HTMLSelectElement;
  swapButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  textbox: HTMLTextAreaElement;
  convertButton: HTMLButtonElement;
  autoCheckbox: HTMLInputElement;
  status: HTMLElement;
  subtitle: HTMLElement | null;
}

export interface PopupController {
  initialize(): Promise<void>;
  dispose(): void;
}

type PopupStatus = "success" | "no-op" | "reload-required" | "unavailable" | "error";
type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

function renderableStatus(response: ConversionResponse): { message: string; status: PopupStatus } {
  switch (response.kind) {
    case "success":
      return { message: `${response.count} nodes changed in ${response.time}ms`, status: "success" };
    case "no-op":
      return { message: "No changes needed", status: "no-op" };
    case "reload-required":
      return { message: "Reload the page to apply the new language direction", status: "reload-required" };
    case "unavailable":
      return { message: unavailableMessages[response.reason], status: "unavailable" };
    case "invalid-settings":
      return { message: "Invalid settings", status: "error" };
    case "internal-failure":
      return { message: "Conversion failed", status: "error" };
  }
}

export function createPopupController(
  platform: ExtensionPlatform,
  elements: PopupElements,
  settingsStore: SettingsStore = createSettingsStore(platform.storage),
): PopupController {
  let disposed = false;
  let initializing: Promise<void> | undefined;
  let inputDebounce: TimerHandle | undefined;
  let pasteDeferral: TimerHandle | undefined;
  let resizeObserver: ResizeObserver | undefined;
  const removeListeners: Array<() => void> = [];
  let listenersAdded = false;
  let ready = false;
  let writeQueue: Promise<void> | undefined;

  const updateConvertButton = () => {
    elements.convertButton.disabled = elements.originSelect.value === elements.targetSelect.value;
  };

  const convertTextbox = () => {
    const origin = elements.originSelect.value as LocaleCode;
    const target = elements.targetSelect.value as LocaleCode;
    if (origin === target) return;

    const originalText = elements.textbox.value;
    const convertedText = convertPlainText(originalText, origin, target);
    if (convertedText !== originalText) elements.textbox.value = convertedText;
  };

  const convertTextboxSafely = () => {
    try {
      convertTextbox();
    } catch {
      return false;
    }
    return true;
  };

  const cancelTextboxConversion = () => {
    if (inputDebounce !== undefined) globalThis.clearTimeout(inputDebounce);
    if (pasteDeferral !== undefined) globalThis.clearTimeout(pasteDeferral);
    inputDebounce = undefined;
    pasteDeferral = undefined;
  };

  const scheduleTextboxConversion = () => {
    if (!ready || disposed) return;
    cancelTextboxConversion();
    inputDebounce = globalThis.setTimeout(() => {
      inputDebounce = undefined;
      if (disposed || elements.originSelect.value === elements.targetSelect.value || !elements.textbox.value.trim()) return;
      convertTextboxSafely();
    }, INPUT_DEBOUNCE_MS);
  };

  const onPaste = () => {
    if (!ready || disposed) return;
    if (pasteDeferral !== undefined) globalThis.clearTimeout(pasteDeferral);
    pasteDeferral = globalThis.setTimeout(() => {
      pasteDeferral = undefined;
      scheduleTextboxConversion();
    }, 0);
  };

  const persist = (patch: Parameters<SettingsStore["set"]>[0]) => {
    const write = async () => {
      if (!disposed) await settingsStore.set(patch);
    };
    writeQueue = writeQueue !== undefined ? writeQueue.catch(() => {}).then(write).catch(() => {}) : write().catch(() => {});
  };

  const onOriginChange = () => {
    if (!ready || disposed) return;
    cancelTextboxConversion();
    const origin = elements.originSelect.value as LocaleCode;
    persist({ origin });
    updateConvertButton();
    if (elements.textbox.value) {
      convertTextboxSafely();
    }
  };

  const onTargetChange = () => {
    if (!ready || disposed) return;
    cancelTextboxConversion();
    const target = elements.targetSelect.value as LocaleCode;
    persist({ target });
    updateConvertButton();
    if (elements.textbox.value) {
      convertTextboxSafely();
    }
  };

  const onSwap = () => {
    if (!ready || disposed) return;
    cancelTextboxConversion();
    const origin = elements.originSelect.value as LocaleCode;
    const target = elements.targetSelect.value as LocaleCode;
    elements.originSelect.value = target;
    elements.targetSelect.value = origin;
    persist({ origin: target, target: origin });
    updateConvertButton();
    if (elements.textbox.value) {
      convertTextboxSafely();
    }
  };

  const onReset = () => {
    if (!ready || disposed) return;
    cancelTextboxConversion();
    elements.textbox.value = "";
    elements.textbox.style.width = "";
    elements.textbox.style.height = "";
  };

  const renderStatus = (response: ConversionResponse) => {
    const rendered = renderableStatus(response);
    elements.status.textContent = rendered.message;
    elements.status.classList.remove(...STATUS_CLASSES);
    elements.status.classList.add(`status-${rendered.status}`);
  };

  const convertPage = async () => {
    elements.convertButton.disabled = true;
    try {
      const response = await platform.runtime.send<ConversionResponse>({ type: "convert-active-tab" });
      if (!disposed) renderStatus(response);
    } catch {
      if (!disposed) renderStatus({ kind: 'internal-failure' });
    } finally {
      if (!disposed) updateConvertButton();
    }
  };

  const onConvert = () => {
    if (disposed) return;
    void convertPage();
  };

  const onAutoChange = () => {
    if (!ready || disposed) return;
    persist({ auto: elements.autoCheckbox.checked });
  };

  const onResize = () => {
    if (!ready || disposed) return;
    persist({
      textboxSize: {
        width: elements.textbox.offsetWidth,
        height: elements.textbox.offsetHeight,
      },
    });
  };

  const addListeners = () => {
    if (listenersAdded) return;
    listenersAdded = true;
    elements.originSelect.addEventListener("change", onOriginChange);
    removeListeners.push(() => elements.originSelect.removeEventListener("change", onOriginChange));
    elements.targetSelect.addEventListener("change", onTargetChange);
    removeListeners.push(() => elements.targetSelect.removeEventListener("change", onTargetChange));
    elements.swapButton.addEventListener("click", onSwap);
    removeListeners.push(() => elements.swapButton.removeEventListener("click", onSwap));
    elements.resetButton.addEventListener("click", onReset);
    removeListeners.push(() => elements.resetButton.removeEventListener("click", onReset));
    elements.textbox.addEventListener("input", scheduleTextboxConversion);
    removeListeners.push(() => elements.textbox.removeEventListener("input", scheduleTextboxConversion));
    elements.textbox.addEventListener("paste", onPaste);
    removeListeners.push(() => elements.textbox.removeEventListener("paste", onPaste));
    elements.textbox.addEventListener("change", scheduleTextboxConversion);
    removeListeners.push(() => elements.textbox.removeEventListener("change", scheduleTextboxConversion));
    elements.convertButton.addEventListener("click", onConvert);
    removeListeners.push(() => elements.convertButton.removeEventListener("click", onConvert));
    elements.autoCheckbox.addEventListener("change", onAutoChange);
    removeListeners.push(() => elements.autoCheckbox.removeEventListener("change", onAutoChange));

    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (typeof ResizeObserverConstructor === "function") {
      resizeObserver = new ResizeObserverConstructor(onResize);
      resizeObserver.observe(elements.textbox);
    }
  };

  const setInteractive = (interactive: boolean) => {
    elements.originSelect.disabled = !interactive;
    elements.targetSelect.disabled = !interactive;
    elements.swapButton.disabled = !interactive;
    elements.resetButton.disabled = !interactive;
    elements.textbox.disabled = !interactive;
    elements.convertButton.disabled = !interactive || elements.originSelect.value === elements.targetSelect.value;
    elements.autoCheckbox.disabled = !interactive;
  };

  setInteractive(false);

  const initialize = (): Promise<void> => {
    if (initializing !== undefined) return initializing;
    initializing = (async () => {
      let settings;
      try {
        settings = await settingsStore.load();
      } catch {
        settings = DEFAULT_SETTINGS;
        if (!disposed) renderStatus({ kind: "invalid-settings" });
      }
      if (disposed) return;

      elements.originSelect.value = settings.origin;
      elements.targetSelect.value = settings.target;
      elements.autoCheckbox.checked = settings.auto;
      const { width, height } = settings.textboxSize;
      elements.textbox.style.width = width ? `${width}px` : "";
      elements.textbox.style.height = height ? `${height}px` : "";
      updateConvertButton();

      if (elements.subtitle) {
        try {
          const version = platform.getManifest().version;
          elements.subtitle.textContent = version ? `v${version}` : "";
        } catch {
          elements.subtitle.textContent = "";
        }
      }
      ready = true;
      setInteractive(true);
      addListeners();
    })();
    return initializing;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    ready = false;
    cancelTextboxConversion();
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    for (const removeListener of removeListeners.splice(0)) removeListener();
  };

  return { initialize, dispose };
}
