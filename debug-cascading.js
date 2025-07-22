import { Converter } from "opencc-js";

console.log("🔍 Debugging OpenCC CN->TWP Conversion");
console.log("============================================================");

const converter = Converter({ from: "cn", to: "twp" });

const testCases = ["算法", "演算法", "演演算法", "新算法", "数据结构", "编程"];

testCases.forEach((text) => {
  const converted = converter(text);
  const lengthRatio = converted.length / text.length;

  console.log(`"${text}" -> "${converted}"`);
  console.log(`  Length: ${text.length} -> ${converted.length} (ratio: ${lengthRatio.toFixed(2)})`);
  console.log(`  Contains original? ${converted.includes(text)}`);
  console.log(`  Same text? ${text === converted}`);
  console.log();
});

// Test specific cascading detection logic
const isCascadingConversion = (original, converted) => {
  if (converted === original) return false;

  // Only check for very obvious cascading patterns
  if (converted.length > original.length) {
    // Pattern 1: Check if the converted text contains the original as a complete substring
    // This catches "演算法" -> "演演算法" but not "算法" -> "演算法"
    if (converted.includes(original) && original.length >= 2) {
      console.log(`  🚫 Blocked by Pattern 1: "${converted}" contains "${original}"`);
      return true;
    }

    // Pattern 2: Check for character repetition patterns at the beginning
    // This catches "演算法" -> "演演算法" pattern
    const firstChar = original.charAt(0);
    const secondChar = original.charAt(1);
    if (firstChar && secondChar && converted.startsWith(firstChar + firstChar + secondChar)) {
      console.log(`  🚫 Blocked by Pattern 2: repetition pattern`);
      return true;
    }
  }

  // Only block if ratio is extremely high (indicating obvious cascading)
  const lengthRatio = converted.length / original.length;
  if (lengthRatio > 2.5) {
    console.log(`  🚫 Blocked by Pattern 3: ratio ${lengthRatio.toFixed(2)} > 2.5`);
    return true;
  }

  return false;
};

console.log("🧪 Testing Cascading Detection Logic");
console.log("============================================================");

testCases.forEach((text) => {
  const converted = converter(text);
  if (converted !== text) {
    console.log(`Testing: "${text}" -> "${converted}"`);
    const isBlocked = isCascadingConversion(text, converted);
    console.log(`  Result: ${isBlocked ? "🚫 BLOCKED" : "✅ ALLOWED"}`);
    console.log();
  }
});
