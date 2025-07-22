import { Converter } from "opencc-js";

console.log("=== Analyzing OpenCC behavior ===");

// Test different conversion directions
const converters = {
  'cn->twp': Converter({ from: "cn", to: "twp" }),
  'tw->cn': Converter({ from: "tw", to: "cn" }),
  'hk->cn': Converter({ from: "hk", to: "cn" }),
  'cn->hk': Converter({ from: "cn", to: "hk" })
};

const testWords = ["算法", "演算法", "演演算法"];

console.log("Testing idempotency:");
Object.entries(converters).forEach(([name, converter]) => {
  console.log(`\n${name}:`);
  testWords.forEach(word => {
    const converted = converter(word);
    const doubleConverted = converter(converted);
    console.log(`  "${word}" -> "${converted}" -> "${doubleConverted}" (idempotent: ${converted === doubleConverted})`);
  });
});

// Test alternative approach: Store original text as data attribute or different marker
console.log("\n=== Testing alternative approaches ===");

// Approach 1: Use invisible Unicode characters that won't interfere with conversion
const invisibleSeparator = '\u200B\u200C\u200D'; // Combine multiple invisible chars
const testText = "算法";
const cnToTwp = Converter({ from: "cn", to: "twp" });

const converted = cnToTwp(testText);
console.log(`Original: "${testText}" -> Converted: "${converted}"`);

// Mark converted text with original
const markedText = converted + invisibleSeparator + testText;
console.log(`Marked text: "${markedText}"`);

// Extract original and check if we need to convert
const parts = markedText.split(invisibleSeparator);
const textPart = parts[0];
const originalPart = parts[1];

console.log(`Text part: "${textPart}"`);
console.log(`Original part: "${originalPart}"`);

if (originalPart) {
  console.log("Text was already converted, skipping...");
} else {
  console.log("Text needs conversion");
}

// Approach 2: Hash-based checking
const crypto = await import('crypto');
const hash = crypto.createHash('md5').update(testText).digest('hex').slice(0, 8);
const hashedMarker = `\u200B${hash}\u200B`;
const markedWithHash = converted + hashedMarker;
console.log(`\nHashed marker approach: "${markedWithHash}"`);

// Check if text contains our hash
const hashRegex = new RegExp(`\u200B([a-f0-9]{8})\u200B`, 'g');
const match = markedWithHash.match(hashRegex);
console.log(`Contains hash marker: ${!!match}`);
if (match) {
  console.log(`Found hash: ${match[0]}`);
}
