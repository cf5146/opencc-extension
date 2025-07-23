import { getConverter, debounce, throttle, isEmptyText, isSameConversion } from "../shared/utils.js";

const $originSelect = document.getElementById("origin");
const $targetSelect = document.getElementById("target");
const $swapButton = document.getElementById("swap");
const $resetButton = document.getElementById("reset");
const $textbox = document.getElementById("textbox");
const $convertButton = document.getElementById("convert");
const $autoCheckbox = document.getElementById("auto");
const $footer = document.getElementsByTagName("footer")[0];

function textboxConvert() {
  const [origin, target] = [$originSelect.value, $targetSelect.value];
  if (isSameConversion(origin, target)) return;

  const originalText = $textbox.value;
  if (isEmptyText(originalText)) return;

  const convert = getConverter(origin, target);
  const convertedText = convert(originalText);
  if (convertedText !== originalText) {
    $textbox.value = convertedText;
  }
}

/* Retrieve values from local storage and restore options when shown. */
chrome.storage.local
  .get({
    origin: "cn",
    target: "hk",
    auto: false,
    textboxSize: {
      width: null,
      height: null,
    },
  })
  .then((settings) => {
    $originSelect.value = settings.origin;
    $targetSelect.value = settings.target;
    $autoCheckbox.checked = settings.auto;
    $convertButton.disabled = settings.origin === settings.target;
    // restore textbox size
    const { width, height } = settings.textboxSize;
    $textbox.style.width = width ? `${width}px` : "";
    $textbox.style.height = height ? `${height}px` : "";
  });

// Batch storage updates to improve performance
const pendingStorageUpdates = {};
let storageUpdateTimeout = null;

const updateStorage = (updates) => {
  Object.assign(pendingStorageUpdates, updates);
  
  if (storageUpdateTimeout) clearTimeout(storageUpdateTimeout);
  storageUpdateTimeout = setTimeout(() => {
    chrome.storage.local.set(pendingStorageUpdates);
    Object.keys(pendingStorageUpdates).forEach(key => delete pendingStorageUpdates[key]);
  }, 100);
};

/* User changes origin option. */
$originSelect.addEventListener("change", (event) => {
  const value = event.currentTarget.value;
  updateStorage({ origin: value });
  $convertButton.disabled = $targetSelect.value === value;
  if ($textbox.value) textboxConvert();
});

/* User changes target option. */
$targetSelect.addEventListener("change", (event) => {
  const value = event.currentTarget.value;
  updateStorage({ target: value });
  $convertButton.disabled = $originSelect.value === value;
  if ($textbox.value) textboxConvert();
});

/* User clicks swap button. */
$swapButton.addEventListener("click", () => {
  const newOrigin = $targetSelect.value;
  const newTarget = $originSelect.value;
  
  updateStorage({ origin: newOrigin, target: newTarget });
  $originSelect.value = newOrigin;
  $targetSelect.value = newTarget;
  if ($textbox.value) textboxConvert();
});

/* User inputs text in textbox. */
const debouncedTextboxConvert = debounce(textboxConvert, 500);

$textbox.addEventListener("input", debouncedTextboxConvert);

/* User clicks reset button. */
$resetButton.addEventListener("click", () => {
  $textbox.value = ""; // clear input
  $textbox.style.width = $textbox.style.height = ""; // reset size
});

/* User resizes textbox. */
const throttledResizeHandler = throttle(() => {
  updateStorage({
    textboxSize: {
      width: $textbox.offsetWidth,
      height: $textbox.offsetHeight,
    },
  });
}, 200);

new ResizeObserver(throttledResizeHandler).observe($textbox);

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
  updateStorage({ auto });
  chrome.action.setBadgeText({ text: auto ? "A" : "" });
});
