import { getOptimizedConverter, getOptimizedConverterSync } from "./opencc-optimized.js";

// Performance monitoring (only in development)
const isDevelopment = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

// Use optimized converter with built-in caching, preloading, and tree shaking
export const getConverterAsync = async (origin, target) => {
  try {
    return await getOptimizedConverter(origin, target);
  } catch (error) {
    console.error(`Failed to create converter ${origin}-${target}:`, error);
    throw error;
  }
};

// Synchronous version for backward compatibility
export const getConverter = (origin, target) => {
  try {
    return getOptimizedConverterSync(origin, target);
  } catch (error) {
    console.error(`Failed to create converter ${origin}-${target}:`, error);
    throw error;
  }
};

// Optimized debounce utility function with immediate option and memory cleanup
export const debounce = (func, delay, immediate = false) => {
  let timeout;

  const debounced = function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };

    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);

    if (callNow) {
      func.apply(this, args);
    }
  };

  // Add cancel method for cleanup
  debounced.cancel = () => {
    clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
};

// Optimized throttle utility function with leading and trailing options
export const throttle = (func, delay, options = {}) => {
  const { leading = true, trailing = true } = options;
  let timeout;
  let lastExecTime = 0;
  let lastArgs;

  const throttled = function executedFunction(...args) {
    const currentTime = Date.now();

    if (!lastExecTime && !leading) {
      lastExecTime = currentTime;
    }

    const remaining = delay - (currentTime - lastExecTime);
    lastArgs = args;

    if (remaining <= 0 || remaining > delay) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastExecTime = currentTime;
      func.apply(this, args);
      lastArgs = null; // Clean up reference
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        lastExecTime = leading ? Date.now() : 0;
        timeout = null;
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, remaining);
    }
  };

  // Add cancel method for cleanup
  throttled.cancel = () => {
    clearTimeout(timeout);
    timeout = null;
    lastArgs = null;
  };

  return throttled;
};

// Performance monitoring utility (only enabled in development)
export const measurePerformance = (fn, name) => {
  if (!isDevelopment) return fn; // Return original function in production

  return (...args) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    console.log(`${name} took ${end - start} milliseconds`);
    return result;
  };
};

// Async performance monitoring utility (only enabled in development)
export const measureAsyncPerformance = (fn, name) => {
  if (!isDevelopment) return fn; // Return original function in production

  return async (...args) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();
    console.log(`${name} took ${end - start} milliseconds`);
    return result;
  };
};

// Optimized text checking with early returns
export const isEmptyText = (text) => {
  // Fast path for common cases
  if (!text) return true;
  if (text.length === 0) return true;
  if (text.length > 100 && text.trim().length === 0) return true; // Early detection for long whitespace
  return text.trim().length === 0;
};

// Check if two settings objects have the same conversion parameters
export const isSameConversion = (origin, target) => origin === target;

// Memory-efficient settings object
export const defaultSettings = Object.freeze({
  origin: "cn",
  target: "hk",
  auto: false,
  whitelist: Object.freeze([]),
});

// Utility for cleaning up references to prevent memory leaks
export const cleanup = () => {
  // Use optimized module's cleanup
  import("./opencc-optimized.js").then(({ cleanupConverters }) => {
    cleanupConverters();
  });
};
