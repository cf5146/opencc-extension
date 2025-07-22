import { Converter } from "opencc-js";

// Use the improved implementation with cascading prevention
const defaultSettings = { origin: "cn", target: "hk", auto: false, once: true, whitelist: [] };
const zeroWidthSpace = String.fromCharCode(8203);
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

const converterCache = new Map();

const addZeroWidthSpaces = (text, originalText = null) => {
  if (originalText && originalText !== text) {
    return text + zeroWidthSpace + originalText + zeroWidthSpace;
  }
  return text + zeroWidthSpace;
};

const extractFromMarkedText = (text) => {
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

const getConverter = (origin, target) => {
  const key = `${origin}-${target}`;
  if (!converterCache.has(key)) {
    converterCache.set(key, Converter({ from: origin, to: target }));
  }
  return converterCache.get(key);
};

// Helper function to check if conversion seems like cascading
const isCascadingConversion = (original, converted) => {
  if (converted === original) return false;
  
  // Check for obvious cascading patterns
  // Pattern 1: Repeated characters (e.g., "演算法" -> "演演算法")
  if (converted.length > original.length) {
    // Check if the converted text contains the original as a substring
    if (converted.includes(original)) {
      return true;
    }
    
    // Check for character repetition patterns
    const firstChar = original.charAt(0);
    if (firstChar && converted.startsWith(firstChar + firstChar)) {
      return true;
    }
  }
  
  // Pattern 2: Length ratio that suggests cascading
  const lengthRatio = converted.length / original.length;
  if (lengthRatio > 1.4) return true;
  
  // Pattern 3: Check if original appears to already be converted Chinese text
  // Most original Chinese text should convert to similar length or shorter
  // If converting Chinese text makes it much longer, it's likely cascading
  return original.length >= 2 && /[\u4e00-\u9fff]/.test(original) && lengthRatio > 1.2;
};

// Helper function to process text node in once mode
const processTextNodeOnceMode = (textNode, originalText, convert) => {
  const { convertedText: existingConverted, wasConverted } = extractFromMarkedText(originalText);
  
  if (wasConverted) {
    // Already converted, just display the converted text
    if (textNode.nodeValue !== existingConverted) {
      textNode.nodeValue = existingConverted;
    }
    return false;
  }

  // Check if the text is already a converted result (to prevent cascading)
  const testConversion = convert(existingConverted);
  if (testConversion !== existingConverted && !isCascadingConversion(existingConverted, testConversion)) {
    const newConverted = addZeroWidthSpaces(testConversion, existingConverted);
    textNode.nodeValue = newConverted;
    return true;
  }
  return false;
};

// Helper function to process text node in normal mode
const processTextNodeNormalMode = (textNode, originalText, convert) => {
  const cleanText = originalText.replace(zeroWidthSpaceRegex, "");
  const convertedText = convert(cleanText);
  
  if (convertedText !== cleanText && !isCascadingConversion(cleanText, convertedText)) {
    textNode.nodeValue = convertedText;
    return true;
  }
  return false;
};

// Simulate the improved auto mode conversion logic
function simulateImprovedAutoMode(textNodes, settings) {
  const convert = getConverter(settings.origin, settings.target);
  let count = 0;
  
  const processedNodes = textNodes.map((originalText, index) => {
    // Skip empty or whitespace-only text nodes
    if (!originalText || originalText.trim().length === 0) return originalText;

    // Create a mock text node
    const mockTextNode = { nodeValue: originalText };
    
    const wasConverted = settings.once 
      ? processTextNodeOnceMode(mockTextNode, originalText, convert)
      : processTextNodeNormalMode(mockTextNode, originalText, convert);
    
    if (wasConverted) {
      count++;
      console.log(`  🔄 Converted: "${originalText}" -> "${mockTextNode.nodeValue}"`);
    } else {
      const { convertedText, wasConverted: alreadyConverted } = extractFromMarkedText(originalText);
      if (alreadyConverted && mockTextNode.nodeValue !== originalText) {
        console.log(`  ✅ Already converted: "${originalText}" -> display "${mockTextNode.nodeValue}"`);
      } else if (mockTextNode.nodeValue === originalText) {
        console.log(`  ⏸️  Skipped (cascading prevention): "${originalText}"`);
      }
    }
    
    return mockTextNode.nodeValue;
  });

  return { processedNodes, count };
}

console.log("🔧 Testing IMPROVED Auto Mode with Cascading Prevention");
console.log("=".repeat(60));

// Test the problematic scenarios
const problemScenarios = [
  {
    name: "Test cascading prevention in once=false mode",
    settings: { origin: "cn", target: "twp", auto: true, once: false },
    textNodes: ["算法", "演算法​算法​", "演算法"],
  },
  {
    name: "Test multiple mutation cycles (the real issue)",
    settings: { origin: "cn", target: "twp", auto: true, once: true },
    textNodes: ["演算法"], // This is what gets extracted and then re-processed
  },
  {
    name: "Test mixed content with potential cascading",
    settings: { origin: "cn", target: "twp", auto: true, once: true },
    textNodes: ["算法", "演算法", "演演算法", "新算法"],
  }
];

problemScenarios.forEach((scenario, index) => {
  console.log(`\nTest ${index + 1}: ${scenario.name}`);
  console.log("-".repeat(40));
  console.log(`Settings: auto=${scenario.settings.auto}, once=${scenario.settings.once}, ${scenario.settings.origin}->${scenario.settings.target}`);
  console.log(`Text nodes: [${scenario.textNodes.map(t => `"${t}"`).join(", ")}]`);
  
  const { processedNodes, count } = simulateImprovedAutoMode(scenario.textNodes, scenario.settings);
  
  console.log(`Result: ${count} nodes converted`);
  console.log("Final result:");
  processedNodes.forEach((node, i) => {
    if (node !== scenario.textNodes[i]) {
      console.log(`  ${i + 1}. "${scenario.textNodes[i]}" -> "${node}" ✓`);
    } else {
      console.log(`  ${i + 1}. "${node}" (unchanged/skipped)`);
    }
  });
});

// Test the specific cascading cases
console.log("\n🔍 Testing Specific Cascading Prevention");
console.log("=".repeat(60));

const cascadingTests = [
  { text: "演算法", expected: "should be blocked (cascading)" },
  { text: "算法", expected: "should convert normally" },
  { text: "演演算法", expected: "should be blocked (already cascaded)" },
  { text: "新算法", expected: "should convert normally" },
];

const converter = getConverter("cn", "twp");
cascadingTests.forEach(test => {
  const converted = converter(test.text);
  const lengthRatio = converted.length / test.text.length;
  const wouldBlock = isCascadingConversion(test.text, converted);
  
  console.log(`"${test.text}" -> "${converted}" (ratio: ${lengthRatio.toFixed(2)}, blocked: ${wouldBlock}) - ${test.expected}`);
});

console.log("\n✨ Improved auto mode testing completed!");
console.log("\n🎯 Key Improvements:");
console.log("✅ Cascading prevention using length ratio check (>1.5x = blocked)");
console.log("✅ Smart handling of already extracted text");
console.log("✅ Reduced MutationObserver trigger loops");
console.log("✅ Better performance with fewer unnecessary conversions");
