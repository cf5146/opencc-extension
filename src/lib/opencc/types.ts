import type { RawOpenCCData } from './raw-data.js';

export type OpenCCLocale = keyof RawOpenCCData['from'];
export type ConverterLocale = OpenCCLocale | 't';
export type DictionaryEntry = readonly [string, string];
export type DictionaryGroup = readonly DictionaryEntry[];
export type LocaleGroups = readonly DictionaryGroup[];

export interface LocalePreset {
  readonly from: Record<OpenCCLocale, LocaleGroups>;
  readonly to: Record<OpenCCLocale, LocaleGroups>;
}

export interface ConverterOptions {
  readonly from: ConverterLocale;
  readonly to: ConverterLocale;
}

export type { RawOpenCCData };
