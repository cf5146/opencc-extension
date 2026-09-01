import { isLocaleCode, type LocaleCode } from '../../domain/conversion/locales.js';

export interface TextboxSize {
  width: number | null;
  height: number | null;
}

export interface Settings {
  origin: LocaleCode;
  target: LocaleCode;
  auto: boolean;
  whitelist: string[];
  textboxSize: TextboxSize;
}

export type SettingsPatch = Partial<Omit<Settings, 'textboxSize'>> & {
  textboxSize?: Partial<TextboxSize> | null;
};

export const DEFAULT_SETTINGS: Settings = {
  origin: 'cn',
  target: 'hk',
  auto: false,
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

  return {
    origin: isLocaleCode(source.origin) ? source.origin : DEFAULT_SETTINGS.origin,
    target: isLocaleCode(source.target) ? source.target : DEFAULT_SETTINGS.target,
    auto: typeof source.auto === 'boolean' ? source.auto : DEFAULT_SETTINGS.auto,
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
