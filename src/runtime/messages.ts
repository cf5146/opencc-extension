import type { LocaleCode } from '../domain/conversion/locales.js';
import type { Settings, SettingsPatch, SiteRule } from '../application/settings/settings.js';

export type SettingsRequest =
  | { type: 'settings-patch'; patch: SettingsPatch }
  | { type: 'settings-site-rule'; hostname: string; rule: SiteRule | null };
export type BackgroundRequest = { type: 'convert-active-tab' } | SettingsRequest;
export type ContentRequest = { type: 'convert-page' } | { type: 'convert-selection' };
export type RuntimeMessage = BackgroundRequest | ContentRequest;

export type UnavailableReason =
  | 'no-active-tab'
  | 'unsupported-scheme'
  | 'missing-content-script'
  | 'injection-denied'
  | 'protected-page'
  | 'unsupported-capability';

export type ConversionResponse =
  | { kind: 'success'; count: number; time: number }
  | { kind: 'no-op'; count: 0; time: number }
  | { kind: 'reload-required' }
  | { kind: 'unavailable'; reason: UnavailableReason }
  | { kind: 'invalid-settings' }
  | { kind: 'internal-failure' };

export type SettingsResponse =
  | { kind: 'settings-success'; settings: Settings }
  | { kind: 'settings-failure'; reason: 'invalid-request' | 'forbidden' | 'write-failed' };

export type RuntimeResponse = ConversionResponse | SettingsResponse;

export interface LocalePair {
  origin: LocaleCode;
  target: LocaleCode;
}
