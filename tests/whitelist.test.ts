import { describe, it, expect } from 'vitest';
import { matchesWhitelist, compileWhitelist } from '../src/core/whitelist.js';

describe('whitelist utilities', () => {
  it('compiles patterns once and caches', () => {
    const first = compileWhitelist(['example']);
    const second = compileWhitelist(['example']);
    expect(first).toBe(second); // same reference due to cache reuse
  });

  it('matches url against provided patterns', () => {
    const url = 'https://foo.example.com/page';
    const patterns = ['example\\.com', 'other'];
    expect(matchesWhitelist(url, patterns)).toBe(true);
    expect(matchesWhitelist(url, ['^https://bar'])).toBe(false);
  });
});
