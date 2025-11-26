import { convertPlainText } from '../core/conversion.js';
import type { OpenCCLocale } from '../core/conversion.js';

const RETRY_DELAY_MS = 120;

const $originSelect = document.getElementById('origin') as HTMLSelectElement;
const $targetSelect = document.getElementById('target') as HTMLSelectElement;
const $swapButton = document.getElementById('swap') as HTMLButtonElement;
const $resetButton = document.getElementById('reset') as HTMLButtonElement;
const $textbox = document.getElementById('textbox') as HTMLTextAreaElement;
const $convertButton = document.getElementById('convert') as HTMLButtonElement;
const $autoCheckbox = document.getElementById('auto') as HTMLInputElement;
const $footer = document.getElementsByTagName('footer')[0];
const $subtitle = document.getElementById('subtitle');

// Set UI version dynamically from extension manifest
try {
  const manifestVersion = chrome.runtime.getManifest().version;
  if ($subtitle && manifestVersion) {
    $subtitle.textContent = `v${manifestVersion}`;
  }
} catch {
  // ignore if manifest not accessible
}

interface PopupSettings {
  origin: OpenCCLocale; target: OpenCCLocale; auto: boolean; textboxSize: { width: number | null; height: number | null }
}
// Added specific response type to avoid using any
interface PageConvertResponse { count: number; time: number; }

function textboxConvert() {
  const origin = $originSelect.value as OpenCCLocale;
  const target = $targetSelect.value as OpenCCLocale;
  if (origin === target) return;
  const originalText = $textbox.value;
  const convertedText = convertPlainText(originalText, origin, target);
  if (convertedText !== originalText) $textbox.value = convertedText;
}

(async () => { // NOSONAR
  const settings = await chrome.storage.local.get({
    origin: 'cn',
    target: 'hk',
    auto: false,
    textboxSize: { width: null, height: null },
  });
  const s = settings as PopupSettings;
  $originSelect.value = s.origin;
  $targetSelect.value = s.target;
  $autoCheckbox.checked = s.auto;
  $convertButton.disabled = s.origin === s.target;
  const { width, height } = s.textboxSize;
  $textbox.style.width = width ? `${width}px` : '';
  $textbox.style.height = height ? `${height}px` : '';
})();

$originSelect.addEventListener('change', (event) => {
  const value = (event.currentTarget as HTMLSelectElement).value as OpenCCLocale;
  chrome.storage.local.set({ origin: value });
  $convertButton.disabled = $targetSelect.value === value;
  if ($textbox.value) textboxConvert();
});

$targetSelect.addEventListener('change', (event) => {
  const value = (event.currentTarget as HTMLSelectElement).value as OpenCCLocale;
  chrome.storage.local.set({ target: value });
  $convertButton.disabled = $originSelect.value === value;
  if ($textbox.value) textboxConvert();
});

$swapButton.addEventListener('click', () => {
  chrome.storage.local.set({ origin: $targetSelect.value, target: $originSelect.value });
  const originValue = $originSelect.value;
  $originSelect.value = $targetSelect.value;
  $targetSelect.value = originValue;
  if ($textbox.value) textboxConvert();
});

// Auto conversion helpers for textbox
let inputDebounce: number | undefined;
const INPUT_DEBOUNCE_MS = 250;

function scheduleTextboxConvert() {
  if (inputDebounce) globalThis.clearTimeout(inputDebounce);
  inputDebounce = globalThis.setTimeout(() => {
    // Guard: only attempt when variants differ
    if ($originSelect.value !== $targetSelect.value && $textbox.value.trim()) {
      try { textboxConvert(); } catch { /* ignore transient errors */ }
    }
  }, INPUT_DEBOUNCE_MS) as unknown as number;
}

// Trigger on any input (typing, delete, undo, etc.)
$textbox.addEventListener('input', scheduleTextboxConvert);
// Explicit paste handler (paste fires before input text available so defer to next microtask)
$textbox.addEventListener('paste', () => setTimeout(scheduleTextboxConvert, 0));
// Fallback when textbox loses focus after edits without further input events
$textbox.addEventListener('change', scheduleTextboxConvert);

$resetButton.addEventListener('click', () => {
  $textbox.value = '';
  $textbox.style.width = '';
  $textbox.style.height = '';
});

new ResizeObserver(() => {
  chrome.storage.local.set({
    textboxSize: { width: $textbox.offsetWidth, height: $textbox.offsetHeight },
  });
}).observe($textbox);

function isErrorWithMessage(err: unknown): err is { message: string } {
  return typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string';
}

async function sendPageConvert(): Promise<PageConvertResponse | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const tabId = tab?.id;
  const url = tab?.url;
  if (tabId == null) return undefined;
  if (!url || !/^https?:/i.test(url)) return undefined;

  const attempt = async (): Promise<PageConvertResponse> => chrome.tabs.sendMessage(tabId, { action: 'click' });

  try {
    return await attempt();
  } catch (e: unknown) {
    if (isErrorWithMessage(e) && !/receiving end/i.test(e.message)) {
      // eslint-disable-next-line no-console
      console.debug('OpenCC popup: initial sendMessage failed, attempting recovery:', e.message);
    }
    // Ask background to ensure dynamic registration (no-op if already) before direct injection.
    try { await chrome.runtime.sendMessage({ action: 'ensure-script' }); } catch { /* ignore */ }
    // Best-effort direct injection for current tab.
    try {
      if (chrome.scripting !== undefined && typeof chrome.scripting.executeScript === 'function') {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      }
    } catch { /* ignore injection errors */ }
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    try { return await attempt(); } catch { return undefined; }
  }
}

$convertButton.addEventListener('click', async () => {
  $convertButton.disabled = true;
  const response = await sendPageConvert();
  $convertButton.disabled = false;
  if (response && typeof response.count === 'number') {
    $footer.innerText = `${response.count} nodes changed in ${response.time}ms`;
  } else {
    $footer.innerHTML = `<span style="color: red; font-weight: bold;">NO ACCESS / PROTECTED PAGE</span>`;
  }
});

$autoCheckbox.addEventListener('change', (event) => {
  const auto = (event.currentTarget as HTMLInputElement).checked;
  chrome.storage.local.set({ auto });
  chrome.action.setBadgeText({ text: auto ? 'A' : '' });
  if (auto) {
    // Ping background to ensure script registered (storage change listener should also handle this, but this is a wake-up nudge).
    chrome.runtime.sendMessage({ action: 'ensure-script' }).catch(() => {});
  }
});
