import { Converter } from "opencc-js";

export const zeroWidthSpace = String.fromCharCode(8203);

// Cached converters to avoid repeated initialization
const converterCache = new Map();

// Pre-compiled regex for better performance
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

// Utility functions for zero-width space handling
export const removeZeroWidthSpaces = (text) => {
  return text.replace(zeroWidthSpaceRegex, "");
};

export const addZeroWidthSpaces = (text) => {
  // Insert zero-width spaces at word boundaries instead of between every character
  // This is more performance-friendly and less intrusive
  return text.replace(/(\S+)/g, `$1${zeroWidthSpace}`);
};

// Get or create cached converter
export const getConverter = (origin, target) => {
  const key = `${origin}-${target}`;
  if (!converterCache.has(key)) {
    converterCache.set(key, Converter({ from: origin, to: target }));
  }
  return converterCache.get(key);
};

// Debounce utility function
export const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

// Throttle utility function
export const throttle = (func, delay) => {
  let timeout;
  let lastExecTime = 0;
  return (...args) => {
    const currentTime = Date.now();
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          func.apply(this, args);
          lastExecTime = Date.now();
        },
        delay - (currentTime - lastExecTime),
      );
    }
  };
};

export const defaultSettings = { origin: "cn", target: "hk", auto: false, once: true, whitelist: [] };
