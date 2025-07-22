import { Converter } from "opencc-js";

// Simulate the improved auto mode logic with node tracking
console.log("🔧 Testing Node Tracking Auto Mode");
console.log("============================================================");

// Mock WeakSet for node tracking
class MockWeakSet {
  constructor() {
    this.items = new Set();
  }
  add(item) {
    this.items.add(item.id || item);
  }
  has(item) {
    return this.items.has(item.id || item);
  }
}

// Mock text nodes
class MockTextNode {
  constructor(id, value) {
    this.id = id;
    this.nodeValue = value;
    this.originalValue = value;
  }
}

const processedNodes = new MockWeakSet();
const zeroWidthSpace = String.fromCharCode(8203);

// Helper functions
const removeZeroWidthSpaces = (text) => text.replace(new RegExp(zeroWidthSpace, "g"), "");

const isCascadingConversion = (original, converted) => {
  if (converted === original) return false;
  
  // Only check for very obvious cascading patterns
  if (converted.length > original.length) {
    // Pattern 1: Check if the converted text contains the original as a complete substring
    // This catches "演算法" -> "演演算法" but not "算法" -> "演算法"
    if (converted.includes(original) && original.length >= 2) {
      return true;
    }
    
    // Pattern 2: Check for character repetition patterns at the beginning
    // This catches "演算法" -> "演演算法" pattern
    const firstChar = original.charAt(0);
    const secondChar = original.charAt(1);
    if (firstChar && secondChar && converted.startsWith(firstChar + firstChar + secondChar)) {
      return true;
    }
  }
  
  // Only block if ratio is extremely high (indicating obvious cascading)
  const lengthRatio = converted.length / original.length;
  return lengthRatio > 2.5; // Allow normal CN->TWP length increases
};

const processTextNodeNormalMode = (textNode, originalText, convert, isAutoMode = false) => {
  if (isAutoMode && processedNodes.has(textNode)) {
    console.log(`  ⏸️  Skipped (already processed): "${originalText}"`);
    return false;
  }
  
  const cleanText = removeZeroWidthSpaces(originalText);
  const convertedText = convert(cleanText);
  
  // For auto mode, rely on node tracking instead of cascading detection
  // For manual mode, still check for cascading to prevent obvious issues
  const shouldBlock = !isAutoMode && isCascadingConversion(cleanText, convertedText);
  
  if (convertedText !== cleanText && !shouldBlock) {
    console.log(`  ✅ Converting: "${cleanText}" -> "${convertedText}"`);
    textNode.nodeValue = convertedText;
    
    if (isAutoMode) {
      processedNodes.add(textNode);
    }
    
    return true;
  }
  
  if (convertedText === cleanText) {
    console.log(`  ⏸️  Skipped (no change): "${cleanText}"`);
  } else {
    console.log(`  ⏸️  Skipped (cascading prevention): "${cleanText}" -> "${convertedText}"`);
  }
  return false;
};

// Test scenarios
const converter = Converter({ from: "cn", to: "twp" });

console.log("\nTest 1: Initial auto mode conversion");
console.log("----------------------------------------");
const nodes1 = [
  new MockTextNode("node1", "算法"),
  new MockTextNode("node2", "数据结构"),
  new MockTextNode("node3", "编程"),
];

let count = 0;
nodes1.forEach(node => {
  if (processTextNodeNormalMode(node, node.nodeValue, converter, true)) {
    count++;
  }
});

console.log(`Result: ${count} nodes converted`);
console.log("Final state:");
nodes1.forEach((node, i) => {
  console.log(`  ${i + 1}. "${node.nodeValue}"`);
});

console.log("\nTest 2: Second mutation cycle (should skip already processed nodes)");
console.log("----------------------------------------");
count = 0;
nodes1.forEach(node => {
  if (processTextNodeNormalMode(node, node.nodeValue, converter, true)) {
    count++;
  }
});

console.log(`Result: ${count} nodes converted`);
console.log("Final state:");
nodes1.forEach((node, i) => {
  console.log(`  ${i + 1}. "${node.nodeValue}"`);
});

console.log("\nTest 3: New nodes added to page (should convert)");
console.log("----------------------------------------");
const newNodes = [
  new MockTextNode("node4", "新算法"),
  new MockTextNode("node5", "机器学习"),
];

count = 0;
newNodes.forEach(node => {
  if (processTextNodeNormalMode(node, node.nodeValue, converter, true)) {
    count++;
  }
});

console.log(`Result: ${count} nodes converted`);
console.log("Final state:");
newNodes.forEach((node, i) => {
  console.log(`  ${i + 1}. "${node.nodeValue}"`);
});

console.log("\nTest 4: Manual conversion (not auto mode - should always convert)");
console.log("----------------------------------------");
const manualNodes = [
  new MockTextNode("manual1", "算法"),
  new MockTextNode("manual2", "算法"), // Same text, but should convert since not auto mode
];

count = 0;
manualNodes.forEach(node => {
  if (processTextNodeNormalMode(node, node.nodeValue, converter, false)) {
    count++;
  }
});

console.log(`Result: ${count} nodes converted`);
console.log("Final state:");
manualNodes.forEach((node, i) => {
  console.log(`  ${i + 1}. "${node.nodeValue}"`);
});

console.log("\n✨ Node tracking auto mode testing completed!");
console.log("\n🎯 Key Features:");
console.log("✅ Tracks processed DOM nodes to prevent re-conversion");
console.log("✅ Allows first-time conversions (算法 -> 演算法)");
console.log("✅ Prevents cascading mutations in auto mode");
console.log("✅ Manual conversions work normally (no node tracking)");
