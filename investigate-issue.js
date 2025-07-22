import { Converter } from "opencc-js";

console.log("🐛 Investigating the Issue in Auto Mode");
console.log("=".repeat(50));

// Test the specific problem case
const converter = Converter({ from: "cn", to: "twp" });

console.log("Issue 1: once=false mode still has cascading conversions");
console.log("-".repeat(30));

const markedText = "演算法​算法​";
console.log(`Marked text: "${markedText}"`);

// In once=false mode, we remove ZWS and convert
const zeroWidthSpace = String.fromCharCode(8203);
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");
const cleaned = markedText.replace(zeroWidthSpaceRegex, "");
console.log(`After removing ZWS: "${cleaned}"`);

const converted = converter(cleaned);
console.log(`After conversion: "${converted}"`);
console.log(`Problem: "演算法" became "${converted}"`);

console.log("\nIssue 2: Already converted text in Mutation Cycle 3");
console.log("-".repeat(30));

const displayText = "演算法"; // This was extracted from marked text
console.log(`Display text: "${displayText}"`);

const reconverted = converter(displayText);
console.log(`Re-converted: "${reconverted}"`);
console.log(`Problem: "演算法" became "${reconverted}"`);

console.log("\n💡 Root Cause Analysis:");
console.log("1. In once=false mode, we remove ZWS and re-convert everything");
console.log("2. When extracting from marked text, we expose the converted text");
console.log("3. If that extracted text gets processed again, it cascades");
console.log("4. The issue is NOT in our ZWS implementation, but in how we handle already-converted text");

console.log("\n🔧 Solution Needed:");
console.log("- In auto mode, we need to be smarter about what gets re-processed");
console.log("- Already extracted/displayed text should not be re-converted");
console.log("- The MutationObserver should only process truly new content");
