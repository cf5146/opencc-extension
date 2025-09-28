import {
  convertAllNewTextNodes,
  convertSelection,
  convertTitle,
  resetConversionCache,
} from "./core/conversion.js";
import { matchesWhitelist } from "./core/whitelist.js";

const defaultSettings = { origin: "cn", target: "hk", auto: false, whitelist: [] };

const getSettings = () => chrome.storage.local.get(defaultSettings);

/* Mount trigger to auto convert when DOM changes. */
let currentURL = "";
let pendingScan = false;
const lang = document.documentElement.lang;
if (!lang || lang.startsWith("zh")) {
  const observer = new MutationObserver(async () => {
    const settings = await getSettings();
    if (!settings.auto || settings.origin === settings.target) return;
    if (matchesWhitelist(window.location.href, settings.whitelist)) return;
    if (currentURL !== window.location.href) {
      currentURL = window.location.href;
    convertTitle(settings.origin, settings.target);
    // reset processed set on navigation
    resetConversionCache();
    }
    if (!pendingScan) {
      pendingScan = true;
      setTimeout(() => {
        pendingScan = false;
        convertAllNewTextNodes(settings.origin, settings.target);
      }, 120); // debounce to allow phrase contexts to settle
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/* Run convert once DOM ready when in auto mode. */
getSettings().then((settings) => {
  if (!settings.auto) return;
  if (matchesWhitelist(window.location.href, settings.whitelist)) return;
  convertTitle(settings.origin, settings.target);
  convertAllNewTextNodes(settings.origin, settings.target);
});

/* Run convert on all nodes when triggered by button click in popup. */
// NOTE: listener itself cannot be async function, see https://stackoverflow.com/questions/48107746.
chrome.runtime.onMessage.addListener(({ action }, _, sendResponse) => {
  (async () => {
    const settings = await getSettings();
    if (settings.origin !== settings.target) {
      if (action === "click") {
        const start = Date.now();
        convertTitle(settings.origin, settings.target);
  const count = convertAllNewTextNodes(settings.origin, settings.target);
        sendResponse({ count, time: Date.now() - start });
      } else if (action === "select") {
        convertSelection(settings.origin, settings.target, window.getSelection());
      }
    }
  })();
  return true; // eliminate error: 'the message port closed before a response was received'
});
