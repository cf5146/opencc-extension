import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  normalizeSettings,
  type Settings,
} from '../src/application/settings/settings.js';

describe('settings', () => {
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
      whitelist: ['code'],
      textboxSize: { width: 400, height: null },
    });
  });
});
