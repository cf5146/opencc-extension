import { Converter } from "opencc-js";

// Test the exact implementation from the extension
const zeroWidthSpace = String.fromCharCode(8203);
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

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

// Test the specific problematic case
console.log("🧪 Testing Zero-Width Space Fix for '算法' (CN->TWP)");
console.log("=".repeat(50));

const testCases = [
  { text: "算法", from: "cn", to: "twp" },
  { text: "这个算法很好用", from: "cn", to: "twp" },
  { text: "計算機", from: "tw", to: "cn" },
  { text: "Hello World", from: "cn", to: "twp" },
];

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: "${testCase.text}" (${testCase.from} -> ${testCase.to})`);
  console.log("-".repeat(30));

  const converter = Converter({ from: testCase.from, to: testCase.to });

  // First conversion
  const firstConversion = converter(testCase.text);
  console.log(`1. First conversion: "${firstConversion}"`);

  // Mark with original (simulate "once" mode)
  const marked = addZeroWidthSpaces(firstConversion, testCase.text);
  console.log(`2. Marked text length: ${marked.length}`);

  // Extract and check (simulate second conversion attempt)
  const { convertedText, originalText, wasConverted } = extractFromMarkedText(marked);
  console.log(`3. Extracted converted: "${convertedText}"`);
  console.log(`4. Extracted original: "${originalText}"`);
  console.log(`5. Was already converted: ${wasConverted}`);

  if (wasConverted) {
    console.log(`✅ SUCCESS: Skipped re-conversion, showing: "${convertedText}"`);
  } else {
    console.log(`⚠️  Would convert: "${convertedText}" -> "${converter(convertedText)}"`);
  }
});

// Test edge cases
console.log("\n🔍 Edge Cases");
console.log("=".repeat(50));

// Test with already marked text
const alreadyMarked = `演算法${zeroWidthSpace}算法${zeroWidthSpace}`;
console.log(`\nTesting already marked text: length ${alreadyMarked.length}`);
const extracted = extractFromMarkedText(alreadyMarked);
console.log(`Extracted: "${extracted.convertedText}" (was converted: ${extracted.wasConverted})`);

// Test with text that doesn't need conversion
const converter = Converter({ from: "cn", to: "twp" });
const noChangeText = "Hello World";
const noChangeResult = converter(noChangeText);
console.log(`\nNo-change text: "${noChangeText}" -> "${noChangeResult}"`);
console.log(`Equal: ${noChangeText === noChangeResult} (should not be marked)`);

console.log("\n✨ All tests completed!");

export { addZeroWidthSpaces, extractFromMarkedText };
