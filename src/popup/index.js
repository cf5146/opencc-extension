import { Converter } from "opencc-js";

const zeroWidthSpace = String.fromCharCode(8203);

// Utility functions for zero-width space handling
const removeZeroWidthSpaces = (text) => {
  return text.replace(new RegExp(zeroWidthSpace, 'g'), "");
};

const addZeroWidthSpaces = (text) => {
  // Insert zero-width spaces at word boundaries instead of between every character
  return text.replace(/(\S+)/g, `$1${zeroWidthSpace}`);
};

const $originSelect = document.getElementById("origin");
const $targetSelect = document.getElementById("target");
const $swapButton = document.getElementById("swap");
const $resetButton = document.getElementById("reset");
const $textbox = document.getElementById("textbox");
const $convertButton = document.getElementById("convert");
const $autoCheckbox = document.getElementById("auto");
const $onceCheckbox = document.getElementById("once");
const $footer = document.getElementsByTagName("footer")[0];

function textboxConvert() {
  const [origin, target, once] = [$originSelect.value, $targetSelect.value, $onceCheckbox.checked];
  if (origin === target) return;
  
  const originalText = $textbox.value;
  if (!originalText || originalText.trim().length === 0) return;
  
  const convert = Converter({ from: origin, to: target });
  
  // Remove existing zero-width spaces before conversion to avoid interference
  const cleanText = once ? removeZeroWidthSpaces(originalText) : originalText;
  let convertedText = convert(cleanText);
  
  // Only proceed if conversion actually occurred
  if (convertedText === cleanText) return;
  
  // Add zero-width spaces if once mode is enabled and conversion occurred
  if (once) {
    convertedText = addZeroWidthSpaces(convertedText);
  }
  
  $textbox.value = convertedText;
}

/* Retrieve values from local storage and restore options when shown. */
chrome.storage.local
  .get({
    origin: "cn",
    target: "hk",
    auto: false,
    once: true,
    textboxSize: {
      width: null,
      height: null,
    },
  })
  .then((settings) => {
    $originSelect.value = settings.origin;
    $targetSelect.value = settings.target;
    $autoCheckbox.checked = settings.auto;
    $onceCheckbox.checked = settings.once;
    $convertButton.disabled = settings.origin === settings.target;
    // restore textbox size
    const { width, height } = settings.textboxSize;
    $textbox.style.width = width ? `${width}px` : "";
    $textbox.style.height = height ? `${height}px` : "";
  });

/* User changes origin option. */
$originSelect.addEventListener("change", (event) => {
  chrome.storage.local.set({ origin: event.currentTarget.value });
  $convertButton.disabled = $targetSelect.value === event.currentTarget.value;
  if ($textbox.value) textboxConvert();
});

/* User changes target option. */
$targetSelect.addEventListener("change", (event) => {
  chrome.storage.local.set({ target: event.currentTarget.value });
  $convertButton.disabled = $originSelect.value === event.currentTarget.value;
  if ($textbox.value) textboxConvert();
});

/* User clicks swap button. */
$swapButton.addEventListener("click", () => {
  chrome.storage.local.set({ origin: $targetSelect.value, target: $originSelect.value });
  const originValue = $originSelect.value;
  $originSelect.value = $targetSelect.value;
  $targetSelect.value = originValue;
  if ($textbox.value) textboxConvert();
});

/* User inputs text in textbox. */
let timeout;
$textbox.addEventListener("input", () => {
  // debounce 750ms: wait for typing to stop
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(textboxConvert, 750);
});

/* User clicks reset button. */
$resetButton.addEventListener("click", () => {
  $textbox.value = ""; // clear input
  $textbox.style.width = $textbox.style.height = ""; // reset size
});

/* User resizes textbox. */
new ResizeObserver(() => {
  chrome.storage.local.set({
    textboxSize: {
      width: $textbox.offsetWidth,
      height: $textbox.offsetHeight,
    },
  });
}).observe($textbox);

/* User clicks convert button. */
$convertButton.addEventListener("click", async () => {
  $convertButton.disabled = true;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.tabs.sendMessage(tabs[0].id, { action: "click" });
  $convertButton.disabled = false;
  if (response !== undefined) $footer.innerText = `${response.count} nodes changed in ${response.time}ms`;
  else $footer.innerHTML = `<span style="color: red; font-weight: bold;">BROWSER PROTECTED PAGE</span>`;
});

/* User checks auto convert mode. */
$autoCheckbox.addEventListener("change", (event) => {
  const auto = event.currentTarget.checked;
  chrome.storage.local.set({ auto });
  chrome.action.setBadgeText({ text: auto ? "A" : "" });
});

/* User checks once convert mode. */
$onceCheckbox.addEventListener("change", (event) => {
  const once = event.currentTarget.checked;
  chrome.storage.local.set({ once });
  // Re-convert textbox content if there's any, to show immediate effect
  if ($textbox.value) textboxConvert();
});
