import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  normalizeHostname,
  isAutoEnabled,
  type Settings,
} from '../src/application/settings/settings.js';

describe('settings', () => {
  it('normalizes exact hostname rules while preserving legacy preferences', () => {
    const settings = normalizeSettings({
      auto: true,
      whitelist: ['legacy'],
      siteRules: {
        'EXAMPLE.com.': 'never',
        'news.example.com': 'always',
        'bad/path': 'always',
        other: 'invalid',
      },
    });
    expect(settings.siteRules).toEqual({ 'example.com': 'never', 'news.example.com': 'always' });
    expect(settings.whitelist).toEqual(['legacy']);
    expect(isAutoEnabled(settings, 'https://example.com/page')).toBe(false);
    expect(isAutoEnabled(settings, 'https://child.example.com')).toBe(true);
    expect(isAutoEnabled({ ...settings, auto: false }, 'https://news.example.com')).toBe(true);
    expect(isAutoEnabled(settings, 'chrome://settings')).toBe(false);
  });

  it('normalizes only HTTP and HTTPS URL hostnames', () => {
    expect(normalizeHostname('https://EXAMPLE.com.:8443/path')).toBe('example.com');
    expect(normalizeHostname('file:///tmp/example')).toBeUndefined();
    expect(normalizeHostname('not a url')).toBeUndefined();
  });
  it('returns defaults for missing or malformed stored values', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        origin: 'invalid',
        target: 42,
        auto: 'yes',
        whitelist: [3],
        textboxSize: { width: -1, height: 'large' },
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and drops invalid whitelist entries', () => {
    expect(
      normalizeSettings({
        origin: 'tw',
        target: 'twp',
        auto: true,
        whitelist: ['example', 3, 'other'],
        textboxSize: { width: 480, height: 180 },
      }),
    ).toEqual({
      origin: 'tw',
      target: 'twp',
      auto: true,
      siteRules: {},
      whitelist: ['example', 'other'],
      textboxSize: { width: 480, height: 180 },
    });
  });

  it('merges a patch without replacing unrelated settings', () => {
    const current: Settings = {
      ...DEFAULT_SETTINGS,
      origin: 'cn',
      target: 'hk',
      whitelist: ['code'],
    };

    expect(mergeSettings(current, { auto: true, textboxSize: { width: 400 } })).toEqual({
      origin: 'cn',
      target: 'hk',
      auto: true,
      siteRules: {},
      whitelist: ['code'],
      textboxSize: { width: 400, height: null },
    });
  });
});
