import { Converter } from "opencc-js";

const zeroWidthSpace = String.fromCharCode(8203);

// Let's test different strategies for zero-width space insertion

console.log("=== Testing different ZWS strategies ===");

const testText = "算法";
const converter = Converter({ from: "cn", to: "twp" });

console.log("Original:", testText);
const converted = converter(testText);
console.log("Converted:", converted);

// Strategy 1: Current implementation (after each word)
const strategy1 = converted.replace(/(\S+)/g, `$1${zeroWidthSpace}`);
console.log("Strategy 1 (after words):", strategy1);

// Strategy 2: Between each character
const strategy2 = converted.split('').join(zeroWidthSpace) + zeroWidthSpace;
console.log("Strategy 2 (between chars):", strategy2);

// Strategy 3: Only at the very end
const strategy3 = converted + zeroWidthSpace;
console.log("Strategy 3 (end only):", strategy3);

// Strategy 4: Use a unique marker instead of ZWS
const uniqueMarker = '‌'; // Zero-width non-joiner (different from zero-width space)
const strategy4 = converted + uniqueMarker;
console.log("Strategy 4 (ZWNJ marker):", strategy4);

// Strategy 5: Simple suffix approach
const strategy5 = converted + "<!--converted-->";
console.log("Strategy 5 (comment marker):", strategy5);

console.log("\n=== Testing removal and re-conversion ===");

// Test each strategy's behavior when cleaned and re-converted
const strategies = [
  { name: "Strategy 1", text: strategy1, regex: new RegExp(zeroWidthSpace, 'g') },
  { name: "Strategy 2", text: strategy2, regex: new RegExp(zeroWidthSpace, 'g') },
  { name: "Strategy 3", text: strategy3, regex: new RegExp(zeroWidthSpace, 'g') },
  { name: "Strategy 4", text: strategy4, regex: new RegExp('‌', 'g') },
  { name: "Strategy 5", text: strategy5, regex: /<!--converted-->/g }
];

strategies.forEach(strategy => {
  const cleaned = strategy.text.replace(strategy.regex, '');
  const reconverted = converter(cleaned);
  console.log(`${strategy.name}:`);
  console.log(`  Cleaned: "${cleaned}"`);
  console.log(`  Re-converted: "${reconverted}"`);
  console.log(`  Equal to original conversion: ${reconverted === converted}`);
  console.log("");
});

// Test with a longer text
console.log("=== Testing with longer text ===");
const longText = "这个算法很好用，可以处理各种情况";
const longConverted = converter(longText);
console.log("Long text converted:", longConverted);

const longWithZWS = longConverted + zeroWidthSpace;
const longCleaned = longWithZWS.replace(new RegExp(zeroWidthSpace, 'g'), '');
const longReconverted = converter(longCleaned);

console.log("Long text re-converted:", longReconverted);
console.log("Long text equal:", longReconverted === longConverted);
