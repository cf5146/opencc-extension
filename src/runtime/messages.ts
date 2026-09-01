import type { LocaleCode } from '../domain/conversion/locales.js';

export type BackgroundRequest = { type: 'convert-active-tab' };
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

export interface LocalePair {
  origin: LocaleCode;
  target: LocaleCode;
}
