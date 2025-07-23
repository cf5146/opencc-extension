// Advanced OpenCC with selective dictionary loading
// This module implements dynamic dictionary loading for maximum tree shaking

// Map conversion types to their required dictionary files
const DICTIONARY_MAP = {
  "cn-hk": ["s2hk"],
  "cn-tw": ["s2tw"],
  "cn-twp": ["s2twp"],
  "hk-cn": ["hk2s"],
  "tw-cn": ["tw2s"],
  "twp-cn": ["twp2s"],
  "hk-tw": ["hk2s", "s2tw"],
  "tw-hk": ["tw2s", "s2hk"],
  "hk-twp": ["hk2s", "s2twp"],
  "twp-hk": ["twp2s", "s2hk"],
  "tw-twp": ["tw2twp"],
  "twp-tw": ["twp2tw"],
};

// Cache for loaded dictionaries
const dictionaryCache = new Map();
const converterCache = new Map();

// Dynamically import only the needed converter components
const loadConverter = async (from, to) => {
  const key = `${from}-${to}`;

  if (converterCache.has(key)) {
    return converterCache.get(key);
  }

  try {
    // Import the core converter without all dictionaries
    const { ConverterFactory } = await import("opencc-js/core");

    // Load only required dictionaries
    const requiredDicts = DICTIONARY_MAP[key] || [];
    const dictionaries = {};

    for (const dict of requiredDicts) {
      if (!dictionaryCache.has(dict)) {
        try {
          // Dynamically import only the needed dictionary
          const dictModule = await import(`opencc-js/dicts/${dict}.json`);
          dictionaryCache.set(dict, dictModule.default);
        } catch (error) {
          console.warn(`Failed to load dictionary ${dict}, falling back to full converter`, error);
          // Fallback to regular ConverterFactory
          const { ConverterFactory: FullConverter } = await import("opencc-js");
          const converter = FullConverter({ from, to });
          converterCache.set(key, converter);
          return converter;
        }
      }
      dictionaries[dict] = dictionaryCache.get(dict);
    }

    // Create converter with selective dictionaries
    const converter = ConverterFactory({ from, to, dictionaries });
    converterCache.set(key, converter);
    return converter;
  } catch (error) {
    console.warn("Selective loading failed, falling back to full opencc-js", error);
    // Ultimate fallback to full opencc-js
    const { ConverterFactory } = await import("opencc-js");
    const converter = ConverterFactory({ from, to });
    converterCache.set(key, converter);
    return converter;
  }
};

// Check if selective loading is supported
const isSelectiveLoadingSupported = async () => {
  try {
    await import("opencc-js/core");
    return true;
  } catch {
    return false;
  }
};

// Optimized converter factory with intelligent fallback
export const createOptimizedConverter = async (from, to) => {
  const key = `${from}-${to}`;

  if (converterCache.has(key)) {
    return converterCache.get(key);
  }

  // Try selective loading first for better tree shaking
  if ((await isSelectiveLoadingSupported()) && DICTIONARY_MAP[key]) {
    return await loadConverter(from, to);
  }

  // Fallback to regular ConverterFactory
  const { ConverterFactory } = await import("opencc-js");
  const converter = ConverterFactory({ from, to });
  converterCache.set(key, converter);
  return converter;
};

// Preload common converters with selective loading
export const preloadCommonConverters = async () => {
  const commonPairs = ["cn-hk", "cn-tw", "hk-cn", "tw-cn"];

  // Use requestIdleCallback for non-blocking preloading
  const preloadNext = async (index = 0) => {
    if (index >= commonPairs.length) return;

    const [from, to] = commonPairs[index].split("-");
    try {
      await createOptimizedConverter(from, to);
    } catch (error) {
      console.warn(`Failed to preload converter ${from}-${to}:`, error);
    }

    // Schedule next preload
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => preloadNext(index + 1), { timeout: 100 });
    } else {
      setTimeout(() => preloadNext(index + 1), 50);
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => preloadNext(), { timeout: 1000 });
  } else {
    preloadNext();
  }
};

// Initialize preloading in browser environment
if (typeof window !== "undefined") {
  preloadCommonConverters();
}

export default {
  createOptimizedConverter,
  preloadCommonConverters,
};
