import { describe, expect, it } from 'vitest';

import { isDomainBlocked, matchesDomain } from '@/lib/domain-matcher';

describe('matchesDomain', () => {
  it('matches exact domains', () => {
    expect(matchesDomain('example.com', ['example.com'])).toBe(true);
  });

  it('matches wildcard subdomains', () => {
    expect(matchesDomain('sub.example.com', ['*.example.com'])).toBe(true);
  });

  it('does not match unrelated domains', () => {
    expect(matchesDomain('other.com', ['example.com'])).toBe(false);
  });

  it('handles empty pattern lists', () => {
    expect(matchesDomain('example.com', [])).toBe(false);
  });

  it('matches localhost', () => {
    expect(matchesDomain('localhost', ['localhost'])).toBe(true);
  });
});

describe('isDomainBlocked', () => {
  it('lets allowlist rules override blocklist rules', () => {
    expect(
      isDomainBlocked('reader.example.com', {
        blocklist: ['*.example.com'],
        allowlist: ['reader.example.com'],
      }),
    ).toBe(false);
  });

  it('blocks domains matched by blocklist only', () => {
    expect(
      isDomainBlocked('ads.example.com', { blocklist: ['*.example.com'], allowlist: [] }),
    ).toBe(true);
  });
});
