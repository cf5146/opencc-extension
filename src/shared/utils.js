import { Converter } from "opencc-js";

export const zeroWidthSpace = String.fromCharCode(8203);

// Cached converters to avoid repeated initialization
const converterCache = new Map();

// Pre-compiled regex for better performance
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

// Utility functions for zero-width space handling with original text preservation
export const removeZeroWidthSpaces = (text) => {
  // Remove our marking pattern: converted_text + ZWS + original_text + ZWS
  return text.replace(zeroWidthSpaceRegex, "");
};

export const addZeroWidthSpaces = (text, originalText = null) => {
  // If we have the original text, store it as a marker to prevent re-conversion
  // Format: converted_text + ZWS + original_text + ZWS
  if (originalText && originalText !== text) {
    return text + zeroWidthSpace + originalText + zeroWidthSpace;
  }
  // Fallback to simple ZWS at the end if no original text provided
  return text + zeroWidthSpace;
};

// Extract the converted text and original text from marked text
export const extractFromMarkedText = (text) => {
  const markerPattern = new RegExp(`(.+)${zeroWidthSpace}(.+)${zeroWidthSpace}$`);
  const match = text.match(markerPattern);
  if (match) {
    return {
      convertedText: match[1],
      originalText: match[2],
      wasConverted: true,
    };
  }
  return {
    convertedText: text,
    originalText: null,
    wasConverted: false,
  };
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
