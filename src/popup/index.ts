import { Converter } from 'opencc-js';
import type { OpenCCLocale } from '../core/conversion.js';

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
  const convert = Converter({ from: origin as any, to: target as any });
  const originalText = $textbox.value;
  const convertedText = convert(originalText);
  if (convertedText !== originalText) $textbox.value = convertedText;
}

chrome.storage.local.get({
  origin: 'cn',
  target: 'hk',
  auto: false,
  textboxSize: { width: null, height: null },
}).then((settings: any) => {
  const s = settings as PopupSettings;
  $originSelect.value = s.origin;
  $targetSelect.value = s.target;
  $autoCheckbox.checked = s.auto;
  $convertButton.disabled = s.origin === s.target;
  const { width, height } = s.textboxSize;
  $textbox.style.width = width ? `${width}px` : '';
  $textbox.style.height = height ? `${height}px` : '';
});

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

let timeout: number | undefined;
$textbox.addEventListener('input', () => {
  if (timeout) window.clearTimeout(timeout);
  timeout = window.setTimeout(textboxConvert, 750);
});

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

async function sendPageConvert(): Promise<PageConvertResponse | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const tabId = tab?.id;
  const url = (tab as any)?.url as string | undefined;
  if (tabId == null) return undefined;
  if (!url || !/^https?:/i.test(url)) return undefined;

  const attempt = async (): Promise<PageConvertResponse> => chrome.tabs.sendMessage(tabId, { action: 'click' });

  try {
    return await attempt();
  } catch (e: unknown) {
    if (e && typeof e === 'object' && (e as any).message && !/receiving end/i.test((e as any).message)) {
      // eslint-disable-next-line no-console
      console.debug('OpenCC popup: initial sendMessage failed, attempting recovery:', (e as any).message);
    }
    try { await chrome.runtime.sendMessage({ action: 'ensure-script' }); } catch { /* ignore */ }
    try {
      if ((chrome as any).scripting?.executeScript) {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      }
    } catch { /* ignore injection errors */ }
    await new Promise(r => setTimeout(r, 120));
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
