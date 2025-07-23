import { Converter } from "opencc-js";

// Cached converters to avoid repeated initialization
const converterCache = new Map();

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

// Check if text is empty or whitespace-only
export const isEmptyText = (text) => !text || text.trim().length === 0;

// Check if two settings objects have the same conversion parameters
export const isSameConversion = (origin, target) => origin === target;

export const defaultSettings = { origin: "cn", target: "hk", auto: false, whitelist: [] };
