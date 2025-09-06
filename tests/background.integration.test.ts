import { describe, it, expect } from 'vitest';

// Simple event helper
function createEvent<T extends (...args: any[]) => any>() {
  const listeners: T[] = [];
  return {
    addListener(fn: T) { listeners.push(fn); },
    removeListener(fn: T) {
      const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
    },
    dispatch: (...args: Parameters<T>) => { for (const l of [...listeners]) l(...args as any); },
  };
}

const registered: { id: string }[] = [];

// Loose chrome mock (typed as any) to bypass TS structural requirements for integration test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).chrome = {
  contextMenus: { create: () => {}, onClicked: createEvent() },
  runtime: { onInstalled: createEvent(), onMessage: createEvent(), sendMessage: () => Promise.resolve() },
  action: { setBadgeBackgroundColor: () => {}, setBadgeText: () => {} },
  storage: {
    local: { get: async () => ({ auto: false }), set: async () => {} },
    onChanged: createEvent(),
  },
  scripting: {
    getRegisteredContentScripts: async (opts?: any) => {
      if (opts?.ids) return registered.filter(r => opts.ids.includes(r.id));
      return registered;
    },
    registerContentScripts: async (list: any[]) => {
      for (const l of list) if (!registered.some(r => r.id === l.id)) registered.push({ id: l.id });
    },
    unregisterContentScripts: async (opts: any) => {
      for (const id of opts.ids) {
        const idx = registered.findIndex(r => r.id === id);
        if (idx >= 0) registered.splice(idx, 1);
      }
    },
  },
  tabs: { query: async () => [{ id: 1 }], sendMessage: async () => {} },
};

async function importBackground() {
  // Import TypeScript source (Vite handles TS). Use ts-ignore to satisfy node16 moduleResolution rule.
  // @ts-ignore
  await import('../src/background.ts');
  // allow async registration to settle
  await new Promise(r => setTimeout(r, 0));
}

describe('background dynamic content script registration', () => {
  it('registers then unregisters and re-registers on auto toggle', async () => {
    await importBackground();
  // Directly invoke registration through test hook (auto mode initially false so background won't auto-register)
  (globalThis as any).__opencc_test__.ensureContentScriptRegistered();
  await new Promise(r => setTimeout(r, 0));
  expect(registered.map(r => r.id)).toContain('opencc-content');

    // Toggle auto off -> should unregister (simulate change event newValue false)
    // First send a change to true (enable) to exercise register path explicitly
    // then disable to trigger unregister
    // Enable
  (globalThis as any).chrome.storage.onChanged.dispatch({ auto: { oldValue: false, newValue: true } }, 'local');
    await new Promise(r => setTimeout(r, 0));
    expect(registered.map(r => r.id)).toContain('opencc-content'); // still there
    // Disable
  (globalThis as any).chrome.storage.onChanged.dispatch({ auto: { oldValue: true, newValue: false } }, 'local');
    await new Promise(r => setTimeout(r, 0));
    expect(registered.map(r => r.id)).not.toContain('opencc-content');
    // Re-enable
  (globalThis as any).chrome.storage.onChanged.dispatch({ auto: { oldValue: false, newValue: true } }, 'local');
    await new Promise(r => setTimeout(r, 0));
    expect(registered.map(r => r.id)).toContain('opencc-content');
  });
});
