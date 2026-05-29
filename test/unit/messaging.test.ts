import { describe, expect, it } from 'vitest';

import { isContentMessage, isPopupMessage } from '@/lib/messaging';

describe('message guards', () => {
  it('accepts valid content conversion messages', () => {
    expect(isContentMessage({ type: 'CONVERT_PAGE', origin: 'cn', target: 'tw' })).toBe(true);
  });

  it('rejects content conversion messages with invalid variants', () => {
    expect(isContentMessage({ type: 'CONVERT_PAGE', origin: 'en', target: 'tw' })).toBe(false);
  });

  it('accepts status messages', () => {
    expect(isContentMessage({ type: 'GET_PAGE_STATUS' })).toBe(true);
  });

  it('accepts popup tab messages with optional variants', () => {
    expect(isPopupMessage({ type: 'CONVERT_ACTIVE_TAB' })).toBe(true);
    expect(isPopupMessage({ type: 'CONVERT_ACTIVE_TAB', origin: 'cn', target: 'hk' })).toBe(true);
  });

  it('rejects unknown messages', () => {
    expect(isContentMessage({ type: 'UNKNOWN' })).toBe(false);
    expect(isPopupMessage({ type: 'UNKNOWN' })).toBe(false);
  });
});
