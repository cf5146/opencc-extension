import { Converter } from "opencc-js";

const zeroWidthSpace = String.fromCharCode(8203);
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

// New implementation
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
      wasConverted: true
    };
  }
  return {
    convertedText: text,
    originalText: null,
    wasConverted: false
  };
};

console.log("=== Testing Fixed Zero-Width Space Implementation ===");

const testText = "算法";
const converter = Converter({ from: "cn", to: "twp" });

console.log(`1. Original text: "${testText}"`);

// First conversion
const converted1 = converter(testText);
console.log(`2. First conversion: "${converted1}"`);

// Mark with original text
const markedText = addZeroWidthSpaces(converted1, testText);
console.log(`3. Marked text: "${markedText}"`);
console.log(`   Length: ${markedText.length}`);

// Extract and check
const { convertedText, originalText, wasConverted } = extractFromMarkedText(markedText);
console.log(`4. Extracted converted: "${convertedText}"`);
console.log(`   Extracted original: "${originalText}"`);
console.log(`   Was converted: ${wasConverted}`);

// Simulate second conversion attempt (should be skipped)
if (wasConverted) {
  console.log(`5. Text was already converted, displaying: "${convertedText}"`);
} else {
  console.log(`5. Converting again...`);
  const converted2 = converter(convertedText);
  console.log(`   Second conversion: "${converted2}"`);
}

console.log("\n=== Testing with sentence ===");

const sentence = "这个算法很好用";
console.log(`Original sentence: "${sentence}"`);

const sentenceConverted = converter(sentence);
console.log(`Converted sentence: "${sentenceConverted}"`);

const sentenceMarked = addZeroWidthSpaces(sentenceConverted, sentence);
console.log(`Marked sentence: "${sentenceMarked}"`);

const sentenceExtracted = extractFromMarkedText(sentenceMarked);
console.log(`Extracted converted: "${sentenceExtracted.convertedText}"`);
console.log(`Extracted original: "${sentenceExtracted.originalText}"`);
console.log(`Should skip re-conversion: ${sentenceExtracted.wasConverted}`);

console.log("\n=== Testing edge cases ===");

// Test with text that doesn't need conversion
const noChangeText = "Hello World";
const noChangeConverted = converter(noChangeText);
console.log(`No change text: "${noChangeText}" -> "${noChangeConverted}"`);
console.log(`Are equal: ${noChangeText === noChangeConverted}`);

if (noChangeText === noChangeConverted) {
  console.log("No marking needed since no conversion occurred");
} else {
  const noChangeMarked = addZeroWidthSpaces(noChangeConverted, noChangeText);
  console.log(`Would mark as: "${noChangeMarked}"`);
}

// Test with already converted text (simulate user editing)
const userModified = "演算法很好";
console.log(`\nUser modified text: "${userModified}"`);
const userExtracted = extractFromMarkedText(userModified);
console.log(`Is marked: ${userExtracted.wasConverted}`);
if (!userExtracted.wasConverted) {
  const userConverted = converter(userModified);
  console.log(`Converting user text: "${userConverted}"`);
}
