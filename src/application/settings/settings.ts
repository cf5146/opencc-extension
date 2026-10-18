import { isLocaleCode, type LocaleCode } from '../../domain/conversion/locales.js';

export interface TextboxSize {
  width: number | null;
  height: number | null;
}

export interface Settings {
  origin: LocaleCode;
  target: LocaleCode;
  auto: boolean;
  siteRules: Record<string, SiteRule>;
  whitelist: string[];
  textboxSize: TextboxSize;
}

export type SiteRule = 'always' | 'never';

export function normalizeHostname(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.hostname.toLowerCase().replace(/\.+$/, '') || undefined;
  } catch {
    return undefined;
  }
}

export function normalizeSiteHostname(hostname: string): string | undefined {
  if (!hostname || /[\s/?#@\\:]/.test(hostname.replace(/^\[[\da-f:]+\]$/i, 'ipv6'))) return undefined;
  return normalizeHostname(`https://${hostname}`);
}

export function isAutoEnabled(settings: Settings, url: string): boolean {
  const hostname = normalizeHostname(url);
  if (!hostname) return false;
  const rule = Object.hasOwn(settings.siteRules, hostname) ? settings.siteRules[hostname] : undefined;
  return rule === 'always' || (rule !== 'never' && settings.auto);
}

export type SettingsPatch = Partial<Omit<Settings, 'textboxSize'>> & {
  textboxSize?: Partial<TextboxSize> | null;
};

export const DEFAULT_SETTINGS: Settings = {
  origin: 'cn',
  target: 'hk',
  auto: false,
  siteRules: {},
  whitelist: [],
  textboxSize: { width: null, height: null },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function normalizeSettings(raw: unknown): Settings {
  const source = isRecord(raw) ? raw : {};
  const textboxSize = isRecord(source.textboxSize) ? source.textboxSize : {};
  const whitelist = Array.isArray(source.whitelist)
    ? source.whitelist.filter((value): value is string => typeof value === 'string')
    : [];
  const siteRules: Record<string, SiteRule> = {};
  if (isRecord(source.siteRules)) {
    for (const [key, value] of Object.entries(source.siteRules)) {
      const hostname = normalizeSiteHostname(key);
      if (hostname && (value === 'always' || value === 'never')) {
        Object.defineProperty(siteRules, hostname, { value, enumerable: true, configurable: true, writable: true });
      }
    }
  }

  return {
    origin: isLocaleCode(source.origin) ? source.origin : DEFAULT_SETTINGS.origin,
    target: isLocaleCode(source.target) ? source.target : DEFAULT_SETTINGS.target,
    auto: typeof source.auto === 'boolean' ? source.auto : DEFAULT_SETTINGS.auto,
    siteRules,
    whitelist,
    textboxSize: {
      width: normalizeDimension(textboxSize.width),
      height: normalizeDimension(textboxSize.height),
    },
  };
}

export function mergeSettings(current: Settings, patch: unknown): Settings {
  const normalizedCurrent = normalizeSettings(current);
  const patchRecord = isRecord(patch) ? patch : {};
  const textboxPatch = isRecord(patchRecord.textboxSize) ? patchRecord.textboxSize : {};

  return normalizeSettings({
    ...normalizedCurrent,
    ...patchRecord,
    textboxSize: {
      ...normalizedCurrent.textboxSize,
      ...textboxPatch,
    },
  });
}
