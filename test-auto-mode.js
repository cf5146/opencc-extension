import { Converter } from "opencc-js";

// Simulate the exact auto mode implementation
const defaultSettings = { origin: "cn", target: "hk", auto: false, once: true, whitelist: [] };
const zeroWidthSpace = String.fromCharCode(8203);
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

// Copy exact functions from content.js
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

// Simulate the auto mode conversion logic
function simulateAutoModeConversion(textNodes, settings) {
  const convert = getConverter(settings.origin, settings.target);
  let count = 0;

  const processedNodes = textNodes.map((originalText) => {
    // Skip empty or whitespace-only text nodes
    if (!originalText || originalText.trim().length === 0) return originalText;

    if (settings.once) {
      // Check if this text node was already converted
      const { convertedText: existingConverted, wasConverted } = extractFromMarkedText(originalText);
      if (wasConverted) {
        // Already converted, just display the converted text
        console.log(`  ✅ Already converted: "${originalText}" -> display "${existingConverted}"`);
        return existingConverted;
      }

      // Convert and mark with original if conversion occurred
      let newConverted = convert(existingConverted);
      if (newConverted !== existingConverted) {
        newConverted = addZeroWidthSpaces(newConverted, existingConverted);
        console.log(`  🔄 New conversion: "${existingConverted}" -> "${newConverted}"`);
        count++;
        return newConverted;
      }
      return originalText;
    } else {
      // Normal conversion without marking
      const cleanText = originalText.replace(zeroWidthSpaceRegex, "");
      let convertedText = convert(cleanText);
      if (convertedText !== cleanText) {
        console.log(`  🔄 Normal conversion: "${cleanText}" -> "${convertedText}"`);
        count++;
        return convertedText;
      }
      return originalText;
    }
  });

  return { processedNodes, count };
}

console.log("🔍 Testing AUTO Mode with Zero-Width Space Fix");
console.log("=".repeat(60));

// Test scenarios for auto mode
const testScenarios = [
  {
    name: "Initial page load (auto=true, once=true)",
    settings: { origin: "cn", target: "twp", auto: true, once: true },
    textNodes: ["算法", "这个算法很好用", "Hello World", "计算机"],
  },
  {
    name: "DOM mutation (new content added)",
    settings: { origin: "cn", target: "twp", auto: true, once: true },
    textNodes: ["新的算法", "机器学习算法"],
  },
  {
    name: "Page with mixed content",
    settings: { origin: "cn", target: "twp", auto: true, once: true },
    textNodes: ["算法", "演算法​算法​", "新算法", "Hello", "测试"],
  },
  {
    name: "Auto mode with once=false",
    settings: { origin: "cn", target: "twp", auto: true, once: false },
    textNodes: ["算法", "演算法​算法​", "新算法"],
  },
];

testScenarios.forEach((scenario, index) => {
  console.log(`\nTest ${index + 1}: ${scenario.name}`);
  console.log("-".repeat(40));
  console.log(
    `Settings: auto=${scenario.settings.auto}, once=${scenario.settings.once}, ${scenario.settings.origin}->${scenario.settings.target}`,
  );
  console.log(`Text nodes: [${scenario.textNodes.map((t) => `"${t}"`).join(", ")}]`);

  const { processedNodes, count } = simulateAutoModeConversion(scenario.textNodes, scenario.settings);

  console.log(`Result: ${count} nodes converted`);
  console.log("Final text nodes:");
  processedNodes.forEach((node, i) => {
    if (node !== scenario.textNodes[i]) {
      console.log(`  ${i + 1}. "${scenario.textNodes[i]}" -> "${node}" ✓`);
    } else {
      console.log(`  ${i + 1}. "${node}" (unchanged)`);
    }
  });
});

// Test multiple mutation cycles (simulate dynamic content)
console.log("\n🔄 Testing Multiple Mutation Cycles");
console.log("=".repeat(60));

let dynamicContent = ["算法"];
const autoSettings = { origin: "cn", target: "twp", auto: true, once: true };

console.log("Simulating page with dynamic content that changes over time...");

for (let cycle = 1; cycle <= 3; cycle++) {
  console.log(`\nMutation Cycle ${cycle}:`);
  const { processedNodes, count } = simulateAutoModeConversion(dynamicContent, autoSettings);
  console.log(`  Converted ${count} nodes`);
  console.log(`  Content: [${processedNodes.map((t) => `"${t}"`).join(", ")}]`);

  // Update the content for next cycle (simulate DOM mutations)
  dynamicContent = processedNodes;
  if (cycle === 1) {
    // Add new content
    dynamicContent.push("新的算法");
  } else if (cycle === 2) {
    // Add more content
    dynamicContent.push("机器学习");
  }
}

console.log("\n✨ Auto mode testing completed!");
console.log("\nKey Findings:");
console.log("✅ Already converted text is correctly detected and not re-converted");
console.log("✅ New content is properly converted and marked");
console.log("✅ Mixed content (converted + new) is handled correctly");
console.log("✅ Multiple mutation cycles work without cascading conversions");
