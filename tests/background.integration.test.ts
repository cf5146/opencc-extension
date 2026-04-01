import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { autoSetting } from '../src/utils/storage';

describe('background auto badge', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('autoSetting defaults to false', async () => {
    const val = await autoSetting.getValue();
    expect(val).toBe(false);
  });

  it('autoSetting persists a new value', async () => {
    await autoSetting.setValue(true);
    const val = await autoSetting.getValue();
    expect(val).toBe(true);
  });
});
