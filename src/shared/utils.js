import { Converter } from "opencc-js";

// Cached converters to avoid repeated initialization with LRU-like behavior
const converterCache = new Map();
const MAX_CACHE_SIZE = 20; // Limit cache size to prevent memory leaks

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

// Optimized debounce utility function with immediate option
export const debounce = (func, delay, immediate = false) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);
    
    if (callNow) func.apply(this, args);
  };
};

// Optimized throttle utility function with leading and trailing options
export const throttle = (func, delay, options = {}) => {
  const { leading = true, trailing = true } = options;
  let timeout;
  let lastExecTime = 0;
  let lastArgs;
  
  return function executedFunction(...args) {
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
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        lastExecTime = leading ? Date.now() : 0;
        timeout = null;
        func.apply(this, lastArgs);
      }, remaining);
    }
  };
};

// Performance monitoring utility
export const measurePerformance = (fn, name) => {
  return (...args) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    if (process.env.NODE_ENV === 'development') {
      console.log(`${name} took ${end - start} milliseconds`);
    }
    return result;
  };
};

// Async performance monitoring utility
export const measureAsyncPerformance = (fn, name) => {
  return async (...args) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();
    if (process.env.NODE_ENV === 'development') {
      console.log(`${name} took ${end - start} milliseconds`);
    }
    return result;
  };
};

// Check if text is empty or whitespace-only
export const isEmptyText = (text) => !text || text.trim().length === 0;

// Check if two settings objects have the same conversion parameters
export const isSameConversion = (origin, target) => origin === target;

export const defaultSettings = { origin: "cn", target: "hk", auto: false, whitelist: [] };
