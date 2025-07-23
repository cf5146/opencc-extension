import { Converter } from "opencc-js";

// Cached converters to avoid repeated initialization with LRU-like behavior
const converterCache = new Map();
const MAX_CACHE_SIZE = 20; // Limit cache size to prevent memory leaks

// Performance monitoring (only in development)
const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

// Get or create cached converter with optimized caching
export const getConverter = (origin, target) => {
  const key = `${origin}-${target}`;
  
  if (converterCache.has(key)) {
    // Move to end (most recently used)
    const converter = converterCache.get(key);
    converterCache.delete(key);
    converterCache.set(key, converter);
    return converter;
  }
  
  // Create new converter
  const converter = Converter({ from: origin, to: target });
  
  // If cache is full, remove oldest entry
  if (converterCache.size >= MAX_CACHE_SIZE) {
    const firstKey = converterCache.keys().next().value;
    converterCache.delete(firstKey);
  }
  
  converterCache.set(key, converter);
  return converter;
};

// Optimized debounce utility function with immediate option and memory cleanup
export const debounce = (func, delay, immediate = false) => {
  let timeout;
  let lastArgs;
  
  const debounced = function executedFunction(...args) {
    lastArgs = args; // Store for potential immediate execution
    
    const later = () => {
      timeout = null;
      lastArgs = null; // Clean up reference
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);
    
    if (callNow) {
      func.apply(this, args);
      lastArgs = null;
    }
  };
  
  // Add cancel method for cleanup
  debounced.cancel = () => {
    clearTimeout(timeout);
    timeout = null;
    lastArgs = null;
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
  whitelist: Object.freeze([])
});

// Utility for cleaning up references to prevent memory leaks
export const cleanup = () => {
  if (converterCache.size > MAX_CACHE_SIZE * 2) {
    const keysToDelete = Array.from(converterCache.keys()).slice(0, MAX_CACHE_SIZE);
    keysToDelete.forEach(key => converterCache.delete(key));
  }
};
