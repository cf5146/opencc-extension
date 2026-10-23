import { normalizeHostname, normalizeSiteHostname } from "../settings/settings.js";
export const PRESETS = {
  s2t: "簡體 → 繁體",
  s2tw: "簡體 → 臺灣正體",
  s2twp: "簡體 → 臺灣詞彙",
  s2hk: "簡體 → 香港繁體",
  tw2sp: "臺灣正體 → 簡體詞彙",
} as const;
export type Preset = keyof typeof PRESETS;
export type Mode = "jieba" | "mmseg";
export interface ConversionOptions {
  preset: Preset;
  mode: Mode;
}
export interface OfficialSettings extends ConversionOptions {
  version: 2;
  sites: Record<string, ConversionOptions>;
  migrationNotice: boolean;
}
export const SETTINGS_KEY = "officialOpenCC";
export const DEFAULT_OPTIONS: ConversionOptions = { preset: "s2twp", mode: "jieba" };
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function isOptions(v: unknown): v is ConversionOptions {
  return (
    isRecord(v) &&
    typeof v.preset === "string" &&
    Object.hasOwn(PRESETS, v.preset) &&
    (v.mode === "jieba" || v.mode === "mmseg")
  );
}
export const configName = (v: ConversionOptions) => v.preset + (v.mode === "jieba" ? "_jieba" : "");
export function normalizeOfficialSettings(raw: unknown): OfficialSettings {
  const r = isRecord(raw) ? raw : {},
    sites: Record<string, ConversionOptions> = Object.create(null);
  if (r.version === 2 && isRecord(r.sites))
    for (const [key, value] of Object.entries(r.sites)) {
      const host = normalizeSiteHostname(key);
      if (host && isOptions(value)) sites[host] = { preset: value.preset, mode: value.mode };
    }
  return {
    version: 2,
    ...(isOptions(r) ? { preset: r.preset, mode: r.mode } : DEFAULT_OPTIONS),
    sites,
    migrationNotice: r.version !== 2 || r.migrationNotice === true,
  };
}
export function effectiveOptions(s: OfficialSettings, url: string): ConversionOptions | undefined {
  const host = normalizeHostname(url);
  return host && Object.hasOwn(s.sites, host) ? s.sites[host] : undefined;
}
export { normalizeHostname, normalizeSiteHostname };
