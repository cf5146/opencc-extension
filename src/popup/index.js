import { getConverter, debounce, throttle, isEmptyText, isSameConversion } from "../shared/utils.js";

// Cache DOM elements for better performance
const elements = {
  originSelect: document.getElementById("origin"),
  targetSelect: document.getElementById("target"),
  swapButton: document.getElementById("swap"),
  resetButton: document.getElementById("reset"),
  textbox: document.getElementById("textbox"),
  convertButton: document.getElementById("convert"),
  autoCheckbox: document.getElementById("auto"),
  footer: document.getElementsByTagName("footer")[0],
};

const { originSelect, targetSelect, swapButton, resetButton, textbox, convertButton, autoCheckbox, footer } = elements;

function textboxConvert() {
  const [origin, target] = [originSelect.value, targetSelect.value];
  if (isSameConversion(origin, target)) return;

  const originalText = textbox.value;
  if (isEmptyText(originalText)) return;

  const convert = getConverter(origin, target);
  const convertedText = convert(originalText);
  if (convertedText !== originalText) {
    textbox.value = convertedText;
  }
}

// Optimize button state updates
const updateConvertButtonState = () => {
  convertButton.disabled = isSameConversion(originSelect.value, targetSelect.value);
};

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
    originSelect.value = settings.origin;
    targetSelect.value = settings.target;
    autoCheckbox.checked = settings.auto;
    updateConvertButtonState();

    // restore textbox size
    const { width, height } = settings.textboxSize;
    if (width) textbox.style.width = `${width}px`;
    if (height) textbox.style.height = `${height}px`;
  });

// Batch storage updates to improve performance
const pendingStorageUpdates = {};
let storageUpdateTimeout = null;

const updateStorage = (updates) => {
  Object.assign(pendingStorageUpdates, updates);

  if (storageUpdateTimeout) clearTimeout(storageUpdateTimeout);
  storageUpdateTimeout = setTimeout(() => {
    chrome.storage.local.set(pendingStorageUpdates);
    Object.keys(pendingStorageUpdates).forEach((key) => delete pendingStorageUpdates[key]);
  }, 100);
};

/* User changes origin option. */
originSelect.addEventListener("change", (event) => {
  const value = event.currentTarget.value;
  updateStorage({ origin: value });
  updateConvertButtonState();
  if (textbox.value) textboxConvert();
});

/* User changes target option. */
targetSelect.addEventListener("change", (event) => {
  const value = event.currentTarget.value;
  updateStorage({ target: value });
  updateConvertButtonState();
  if (textbox.value) textboxConvert();
});

/* User clicks swap button. */
swapButton.addEventListener("click", () => {
  const newOrigin = targetSelect.value;
  const newTarget = originSelect.value;

  updateStorage({ origin: newOrigin, target: newTarget });
  originSelect.value = newOrigin;
  targetSelect.value = newTarget;
  updateConvertButtonState();
  if (textbox.value) textboxConvert();
});

/* User inputs text in textbox. */
const debouncedTextboxConvert = debounce(textboxConvert, 300); // Reduced from 500ms for better UX

textbox.addEventListener("input", debouncedTextboxConvert);

/* User clicks reset button. */
resetButton.addEventListener("click", () => {
  textbox.value = ""; // clear input
  textbox.style.width = textbox.style.height = ""; // reset size
});

/* User resizes textbox. */
const throttledResizeHandler = throttle(() => {
  updateStorage({
    textboxSize: {
      width: textbox.offsetWidth,
      height: textbox.offsetHeight,
    },
  });
}, 200);

new ResizeObserver(throttledResizeHandler).observe(textbox);

/* User clicks convert button. */
convertButton.addEventListener("click", async () => {
  convertButton.disabled = true;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, { action: "click" });

    if (response !== undefined) {
      footer.innerText = `${response.count} nodes changed in ${response.time}ms`;
    } else {
      footer.innerHTML = `<span style="color: red; font-weight: bold;">BROWSER PROTECTED PAGE</span>`;
    }
  } catch (error) {
    footer.innerHTML = `<span style="color: red; font-weight: bold;">ERROR: ${error.message}</span>`;
  } finally {
    convertButton.disabled = false;
  }
});

/* User checks auto convert mode. */
autoCheckbox.addEventListener("change", (event) => {
  const auto = event.currentTarget.checked;
  updateStorage({ auto });
  chrome.action.setBadgeText({ text: auto ? "A" : "" });
});
