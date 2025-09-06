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

interface PopupSettings {
  origin: OpenCCLocale; target: OpenCCLocale; auto: boolean; textboxSize: { width: number | null; height: number | null }
}

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

$convertButton.addEventListener('click', async () => {
  $convertButton.disabled = true;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = tabs[0]?.id != null ? await chrome.tabs.sendMessage(tabs[0].id, { action: 'click' }) : undefined;
  $convertButton.disabled = false;
  if (response !== undefined) $footer.innerText = `${response.count} nodes changed in ${response.time}ms`;
  else $footer.innerHTML = `<span style="color: red; font-weight: bold;">BROWSER PROTECTED PAGE</span>`;
});

$autoCheckbox.addEventListener('change', (event) => {
  const auto = (event.currentTarget as HTMLInputElement).checked;
  chrome.storage.local.set({ auto });
  chrome.action.setBadgeText({ text: auto ? 'A' : '' });
});
