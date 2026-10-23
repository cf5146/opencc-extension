import { browser } from "wxt/browser";
import { SETTINGS_KEY, normalizeOfficialSettings, type OfficialSettings } from "./settings.js";
export async function loadSettings(): Promise<OfficialSettings> {
  const raw = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeOfficialSettings(raw[SETTINGS_KEY]);
}
export async function mutateSettings(action: string, values: Record<string, unknown> = {}): Promise<OfficialSettings> {
  const r = await browser.runtime.sendMessage({ type: "official-settings", action, ...values });
  if (r?.error) throw new Error(r.error);
  return normalizeOfficialSettings(r.settings);
}
export function subscribeSettings(listener: () => void) {
  const changed = (_changes: unknown, area: string) => {
    if (area === "local") listener();
  };
  browser.storage.onChanged.addListener(changed);
  return () => browser.storage.onChanged.removeListener(changed);
}
