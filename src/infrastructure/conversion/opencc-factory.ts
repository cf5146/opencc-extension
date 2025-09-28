import { Converter } from '../../lib/opencc/index.js';
import type { ConverterFunction } from '../../lib/opencc/index.js';
import type { LocaleCode } from '../../domain/conversion/locales.js';

export type ConverterFactory = (from: LocaleCode, to: LocaleCode) => ConverterFunction;

export function createOpenCCFactory(): ConverterFactory {
  const cache = new Map<string, ConverterFunction>();

  return (from, to) => {
  const key = `${from}->${to}`;
    const existing = cache.get(key);
    if (existing) {
      return existing;
    }
    const created = Converter({ from, to });
    cache.set(key, created);
    return created;
  };
}
