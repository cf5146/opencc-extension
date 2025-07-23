// Optimized OpenCC module with dynamic imports for better tree shaking
import { Converter } from "opencc-js";

// Language pairs that are commonly used - prioritize these for preloading
const COMMON_CONVERSIONS = ["cn-hk", "cn-tw", "cn-twp", "hk-cn", "tw-cn", "twp-cn", "hk-tw", "tw-hk"];

// Cache for loaded converters
const converterCache = new Map();
const loadingPromises = new Map();

// Preload common conversions in the background
const preloadCommonConverters = () => {
  // Use requestIdleCallback to preload during idle time
  const preloadBatch = (conversions, index = 0) => {
    if (index >= conversions.length) return;

    const [from, to] = conversions[index].split("-");
    const key = `${from}-${to}`;

    if (!converterCache.has(key) && !loadingPromises.has(key)) {
      createConverter(from, to).catch(() => {
        // Ignore preload errors
      });
    }

    // Schedule next preload
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => preloadBatch(conversions, index + 1), { timeout: 50 });
    } else {
      setTimeout(() => preloadBatch(conversions, index + 1), 10);
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => preloadBatch(COMMON_CONVERSIONS), { timeout: 1000 });
  }
};

// Create converter with optimized loading
const createConverter = async (from, to) => {
  const key = `${from}-${to}`;

  if (converterCache.has(key)) {
    return converterCache.get(key);
  }

  if (loadingPromises.has(key)) {
    return await loadingPromises.get(key);
  }

  const promise = new Promise((resolve, reject) => {
    try {
      // Use Converter for better compatibility
      const converter = Converter({ from, to });
      converterCache.set(key, converter);
      loadingPromises.delete(key);
      resolve(converter);
    } catch (error) {
      loadingPromises.delete(key);
      reject(error);
    }
  });

  loadingPromises.set(key, promise);
  return await promise;
};

// Get converter with caching and lazy loading
export const getOptimizedConverter = async (from, to) => {
  return await createConverter(from, to);
};

// Synchronous version for compatibility
export const getOptimizedConverterSync = (from, to) => {
  const key = `${from}-${to}`;

  if (converterCache.has(key)) {
    return converterCache.get(key);
  }

  // Create synchronously
  const converter = Converter({ from, to });
  converterCache.set(key, converter);
  return converter;
};

// Initialize preloading
if (typeof window !== "undefined") {
  // Only preload in browser environment
  preloadCommonConverters();
}

// Cleanup function
export const cleanupConverters = () => {
  converterCache.clear();
  loadingPromises.clear();
};

export default {
  getOptimizedConverter,
  getOptimizedConverterSync,
  cleanupConverters,
};
