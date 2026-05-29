export const VARIANTS = {
  cn: { code: 'cn', label: '简体中文', langTag: 'zh-CN' },
  tw: { code: 'tw', label: '正體中文（臺灣）', langTag: 'zh-TW' },
  twp: { code: 'twp', label: '正體中文（臺灣，含慣用語）', langTag: 'zh-TW' },
  hk: { code: 'hk', label: '繁體中文（香港）', langTag: 'zh-HK' },
  jp: { code: 'jp', label: '日本新字体', langTag: 'ja' },
  t: { code: 't', label: 'Traditional (OpenCC)', langTag: 'zh-Hant' },
} as const;

export const VARIANT_CODES = Object.keys(VARIANTS) as VariantCode[];

export type VariantCode = keyof typeof VARIANTS;
export type ThemeMode = 'light' | 'dark' | 'system';

export const DEFAULT_ORIGIN: VariantCode = 'cn';
export const DEFAULT_TARGET: VariantCode = 'tw';
export const DEFAULT_THEME: ThemeMode = 'system';

export function isVariantCode(value: unknown): value is VariantCode {
  return typeof value === 'string' && value in VARIANTS;
}
