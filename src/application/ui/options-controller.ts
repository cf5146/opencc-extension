import type { ExtensionPlatform } from "../../platform/types.js";
import type { Settings, SettingsPatch } from "../settings/settings.js";
import { createRemoteSettingsStore, type SettingsStore } from "../settings/settings-store.js";
export interface OptionsElements {
  whitelist: HTMLTextAreaElement;
  autoCheckbox: HTMLInputElement;
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
    e.autoCheckbox.disabled = !ready;
    e.saveButton.disabled = !ready || busy;
  };
  const renderRules = (settings: Settings) => {
    e.siteRules.replaceChildren();
    for (const [hostname, rule] of Object.entries(settings.siteRules)) {
      const li = document.createElement("li"),
        button = document.createElement("button");
      li.append(
        document.createTextNode(`${hostname} — ${rule === "always" ? "Always auto-convert" : "Never auto-convert"} `),
      );
      button.type = "button";
      button.textContent = "Remove";
      button.setAttribute("aria-label", `Remove rule for ${hostname}`);
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
              say("Site rule removed.");
            }
          } catch {
            say("Could not remove site rule. Try Remove again.");
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
      li.textContent = "No site rules. Sites use your default policy.";
      e.siteRules.append(li);
    }
  };
  const apply = (settings: Settings) => {
    if (disposed) return;
    renderRules(settings);
    if (!dirtyPatterns) e.whitelist.value = settings.whitelist.join("\n");
    if (!dirtyAuto) e.autoCheckbox.checked = settings.auto;
  };
  const edit = () => {
    if (!ready || disposed) return;
    e.saveButton.textContent = "Save changes";
    say("Unsaved changes.");
  };
  const save = async () => {
    if (!ready || disposed || busy) return;
    if (!dirtyAuto && !dirtyPatterns) {
      say("No unsaved changes.");
      return;
    }
    const whitelist = e.whitelist.value.split(/\r?\n/).filter((line) => line.trim().length > 0);
    for (let i = 0; dirtyPatterns && i < whitelist.length; i++)
      try {
        new RegExp(whitelist[i]!);
      } catch {
        say(`Invalid regular expression on line ${i + 1}. Your saved exclusions are unchanged.`);
        return;
      }
    const savedPatternRevision = patternRevision;
    const savedAutoRevision = autoRevision;
    const patch: SettingsPatch = {};
    if (dirtyPatterns) patch.whitelist = whitelist;
    if (dirtyAuto) patch.auto = e.autoCheckbox.checked;
    busy = true;
    gate();
    say("Saving…");
    try {
      await store.set(patch);
      if (disposed) return;
      if (patch.whitelist && patternRevision === savedPatternRevision) dirtyPatterns = false;
      if (patch.auto !== undefined && autoRevision === savedAutoRevision) dirtyAuto = false;
      if (!dirtyPatterns && !dirtyAuto) {
        e.saveButton.textContent = "Save changes";
        say("Saved changes.");
      } else say("Earlier changes saved. You still have unsaved changes.");
    } catch {
      if (disposed) return;
      say("Could not save changes. Your edits are kept; select Save / retry.");
      e.saveButton.textContent = "Save / retry";
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
        say("Could not load settings. Retry to continue.");
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
