import { browser } from "wxt/browser";
import { PRESETS, isOptions, normalizeHostname, type OfficialSettings, type ConversionOptions } from "./settings.js";
import { loadSettings, mutateSettings, subscribeSettings } from "./store.js";
import { convertTexts } from "./engine.js";
export async function startPopup() {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const preset = get<HTMLSelectElement>("preset"),
    mode = get<HTMLSelectElement>("mode"),
    input = get<HTMLTextAreaElement>("textbox"),
    result = get<HTMLTextAreaElement>("result"),
    status = get<HTMLOutputElement>("status"),
    site = get<HTMLInputElement>("site-auto"),
    page = get<HTMLButtonElement>("convert"),
    copy = get<HTMLButtonElement>("copy");
  let host: string | undefined,
    revision = 0,
    disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    saving: Promise<unknown> = Promise.resolve(),
    dirty = false,
    composing = false,
    writeRevision = 0;
  const say = (s: string) => {
    if (!disposed) status.textContent = s;
  };
  const options = (): ConversionOptions => ({ preset: preset.value, mode: mode.value }) as ConversionOptions;
  for (const [value, label] of Object.entries(PRESETS)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    preset.append(option);
  }
  const preview = async () => {
    const expected = ++revision,
      text = input.value,
      selected = options();
    copy.disabled = true;
    result.value = "";
    if (!text) {
      say("就緒");
      return;
    }
    say("初始化／轉換中…");
    try {
      await saving;
      if (disposed || expected !== revision) return;
      const [output] = await convertTexts([text], selected);
      if (!disposed && expected === revision) {
        result.value = output!;
        copy.disabled = false;
        say("文字轉換完成");
      }
    } catch (e) {
      if (expected === revision) say((e instanceof Error ? e.message : "轉換失敗") + "；原文仍保留。");
    }
  };
  const schedule = () => {
    if (composing) return;
    revision++;
    clearTimeout(timer);
    copy.disabled = true;
    result.value = "";
    timer = setTimeout(() => void preview(), 250);
  };
  const render = (s: OfficialSettings) => {
    const selected = host && Object.hasOwn(s.sites, host) ? s.sites[host]! : s;
    preset.value = selected.preset;
    mode.value = selected.mode;
    site.checked = !!host && Object.hasOwn(s.sites, host);
    get("migration").hidden = !s.migrationNotice;
  };
  const save = () => {
    const selected = options();
    if (!isOptions(selected)) return;
    const write = ++writeRevision,
      enabled = site.checked;
    revision++;
    clearTimeout(timer);
    copy.disabled = true;
    result.value = "";
    dirty = true;
    say("儲存設定中…");
    saving = saving
      .catch(() => {})
      .then(async () => {
        const next = await mutateSettings("defaults", { options: selected, hostname: enabled ? host : undefined });
        if (!disposed && write === writeRevision) {
          render(next);
          dirty = false;
        }
      });
    void saving.then(
      () => {
        if (!disposed && write === writeRevision) void preview();
      },
      () => {
        if (disposed || write !== writeRevision) return;
        dirty = false;
        say("設定儲存失敗，請重試選擇。");
      },
    );
  };
  preset.disabled = true;
  mode.disabled = true;
  site.disabled = true;
  page.disabled = true;
  copy.disabled = true;
  try {
    const [settings, tabs] = await Promise.all([
      loadSettings(),
      browser.tabs.query({ active: true, currentWindow: true }),
    ]);
    host = normalizeHostname(tabs[0]?.url ?? "");
    get("hostname").textContent = host ?? "目前頁面無法自動轉換";
    render(settings);
    preset.disabled = false;
    mode.disabled = false;
    site.disabled = !host;
    page.disabled = !host;
    say("就緒");
  } catch {
    say("設定載入失敗，請重新開啟視窗。");
    return;
  }
  preset.addEventListener("change", save);
  mode.addEventListener("change", save);
  input.addEventListener("input", schedule);
  input.addEventListener("compositionstart", () => {
    composing = true;
    revision++;
    clearTimeout(timer);
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    schedule();
  });
  site.addEventListener("change", () => {
    if (!host) return;
    const write = ++writeRevision,
      enabled = site.checked,
      selected = options();
    revision++;
    clearTimeout(timer);
    copy.disabled = true;
    result.value = "";
    dirty = true;
    site.disabled = true;
    saving = saving
      .catch(() => {})
      .then(async () => {
        const next = await mutateSettings("site", { hostname: host, options: enabled ? selected : null });
        if (!disposed && write === writeRevision) {
          render(next);
          dirty = false;
        }
      });
    void saving.then(
      () => {
        site.disabled = false;
        if (write === writeRevision && !disposed) void preview();
        say(enabled ? "此網站已啟用自動轉換；設定改變後請重載已轉換頁面。" : "此網站已停用自動轉換。");
      },
      () => {
        if (disposed) return;
        site.disabled = false;
        if (write !== writeRevision) return;
        site.checked = !enabled;
        dirty = false;
        say("網站設定儲存失敗。");
      },
    );
  });
  page.addEventListener("click", () => {
    page.disabled = true;
    say("初始化／轉換網頁中…");
    void (async () => {
      try {
        let pending;
        do {
          pending = saving;
          await pending;
        } while (pending !== saving);
        const r = await browser.runtime.sendMessage({ type: "convert-active-tab" });
        if (r?.kind === "reload-required") say("設定已變更，請重新載入網頁後再轉換。");
        else if (r?.kind === "success") say(`已轉換 ${r.count} 個文字節點。`);
        else if (r?.kind === "no-op") say("沒有需要轉換的文字。");
        else say(r?.message ?? "此頁面無法轉換，請確認頁面權限後重試。");
      } catch {
        say("轉換失敗；請重試，尚未處理的原文保留。");
      } finally {
        if (!disposed) page.disabled = false;
      }
    })();
  });
  copy.addEventListener("click", () => {
    void navigator.clipboard.writeText(result.value).then(
      () => say("已複製結果"),
      () => say("複製失敗，請手動選取結果。"),
    );
  });
  get("reset").addEventListener("click", () => {
    revision++;
    clearTimeout(timer);
    input.value = "";
    result.value = "";
    copy.disabled = true;
    say("文字已清除");
  });
  get("dismiss").addEventListener("click", () => {
    void mutateSettings("dismiss").then(
      (settings) => {
        if (!disposed) get("migration").hidden = !settings.migrationNotice;
      },
      () => say("無法儲存提示狀態。"),
    );
  });
  get("show-settings").addEventListener("click", () => void browser.runtime.openOptionsPage());
  const unsubscribe = subscribeSettings(() => {
    if (dirty || disposed) return;
    void loadSettings().then(
      (s) => {
        if (disposed || dirty) return;
        const before = JSON.stringify(options());
        render(s);
        if (before !== JSON.stringify(options())) schedule();
      },
      () => say("設定更新失敗，請重新開啟視窗。"),
    );
  });
  addEventListener(
    "pagehide",
    () => {
      disposed = true;
      revision++;
      clearTimeout(timer);
      unsubscribe();
    },
    { once: true },
  );
}
