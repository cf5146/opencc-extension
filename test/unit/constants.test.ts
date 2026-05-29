import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ORIGIN,
  DEFAULT_TARGET,
  VARIANT_CODES,
  VARIANTS,
  isVariantCode,
} from '@/lib/constants';

describe('constants', () => {
  it('defines all supported OpenCC variants', () => {
    expect(VARIANT_CODES).toEqual(['cn', 'tw', 'twp', 'hk', 'jp', 't']);
  });

  it('defines valid language tags for each variant', () => {
    for (const code of VARIANT_CODES) {
      expect(VARIANTS[code].langTag).toMatch(/^[a-z]{2}/i);
    }
  });

  it('uses Simplified to Taiwan Traditional defaults', () => {
    expect(DEFAULT_ORIGIN).toBe('cn');
    expect(DEFAULT_TARGET).toBe('tw');
  });

  it('checks variant codes', () => {
    expect(isVariantCode('twp')).toBe(true);
    expect(isVariantCode('en')).toBe(false);
  });
});
