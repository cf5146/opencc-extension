import { convertAllTextNodes, convertSelection, convertTitle } from '../utils/conversion';
import { matchesWhitelist } from '../utils/whitelist';
import { setupAutoObserver } from '../utils/observer';
import { originSetting, targetSetting, autoSetting, whitelistSetting } from '../utils/storage';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',

  async main() {
    const [origin, target, auto, whitelist] = await Promise.all([
      originSetting.getValue(),
      targetSetting.getValue(),
      autoSetting.getValue(),
      whitelistSetting.getValue(),
    ]);

    setupAutoObserver();

    if (auto) {
      if (!matchesWhitelist(globalThis.location.href, whitelist)) {
        convertTitle(origin, target);
        convertAllTextNodes(origin, target);
      }
    }

    browser.runtime.onMessage.addListener(
      ({ action }: { action: 'click' | 'select' }, _sender, sendResponse) => {
        (async () => {
          const [o, t] = await Promise.all([originSetting.getValue(), targetSetting.getValue()]);
          if (o !== t) {
            if (action === 'click') {
              const start = Date.now();
              convertTitle(o, t);
              const count = convertAllTextNodes(o, t);
              sendResponse({ count, time: Date.now() - start });
            } else if (action === 'select') {
              convertSelection(globalThis.getSelection(), o, t);
            }
          }
        })();
        return true; // keep message channel alive
      },
    );
  },
});
