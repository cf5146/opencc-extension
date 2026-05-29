import { describe, expect, it } from 'vitest';

import { convertText, createConverter } from '@/lib/converter';

describe('convertText', () => {
  it('converts Simplified Chinese to Traditional Chinese (Taiwan)', () => {
    expect(convertText('汉语', 'cn', 'tw')).toBe('漢語');
  });

  it('converts Traditional Chinese (Taiwan) to Simplified Chinese', () => {
    expect(convertText('漢語', 'tw', 'cn')).toBe('汉语');
  });

  it('converts Simplified to Traditional with Taiwan phrases', () => {
    expect(convertText('软件', 'cn', 'twp')).toBe('軟體');
  });

  it('handles Hong Kong Traditional conversions', () => {
    expect(convertText('软件', 'cn', 'hk')).toBe('軟件');
  });

  it('handles empty strings', () => {
    expect(convertText('', 'cn', 'tw')).toBe('');
  });

  it('preserves non-Chinese text', () => {
    expect(convertText('Hello World 123', 'cn', 'tw')).toBe('Hello World 123');
  });

  it('handles mixed content', () => {
    expect(convertText('Hello 汉语 World', 'cn', 'tw')).toBe('Hello 漢語 World');
  });

  it('returns identity converter for matching source and target', () => {
    const converter = createConverter('cn', 'cn');
    expect(converter('汉语')).toBe('汉语');
  });
});
