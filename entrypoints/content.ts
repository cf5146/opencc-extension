import { defineContentScript } from 'wxt/utils/define-content-script';
import { createContentRuntime } from '../src/application/runtime/content-runtime.js';
import { createSettingsStore } from '../src/application/settings/settings-store.js';
import {
  convertAllNewTextNodes,
  convertSelection,
  convertTextNode,
  convertTitle,
  hasConverted,
  resetConversionCache,
} from '../src/core/conversion.js';
import { createBrowserPlatform } from '../src/platform/browser-platform.js';

const httpPageMatch = ['http', '://*/*'].join('');

export default defineContentScript({
  matches: [httpPageMatch, 'https://*/*'],
  runAt: 'document_idle',
  allFrames: false,
  registration: 'manifest',
  main(ctx) {
    const platform = createBrowserPlatform();
    const settingsStore = createSettingsStore(platform.storage);
    const runtime = createContentRuntime({
      platform,
      settingsStore,
      operations: {
        convertTextNode,
        convertDocument: convertAllNewTextNodes,
        convertTitle,
        convertSelection,
        hasConverted,
        resetCaches: resetConversionCache,
      },
      document,
      getSelection: () => globalThis.getSelection(),
    });

    let invalidated = false;
    ctx.onInvalidated(() => {
      invalidated = true;
      runtime.dispose();
    });
    void runtime.start().then((cleanup) => {
      if (invalidated) cleanup();
    }, () => runtime.dispose());
  },
});
