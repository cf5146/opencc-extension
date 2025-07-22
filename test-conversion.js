import { Converter } from "opencc-js";

const zeroWidthSpace = String.fromCharCode(8203);
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

const removeZeroWidthSpaces = (text) => {
  return text.replace(zeroWidthSpaceRegex, "");
};

const addZeroWidthSpaces = (text) => {
  return text.replace(/(\S+)/g, `$1${zeroWidthSpace}`);
};

// Test the specific case: 算法 from cn to twp
const testText = "算法";
console.log("Original text:", testText);
console.log("Original text length:", testText.length);

// Create converter
const converter = Converter({ from: "cn", to: "twp" });

// First conversion
const converted1 = converter(testText);
console.log("First conversion:", converted1);
console.log("First conversion length:", converted1.length);

// Add zero-width spaces
const withZWS = addZeroWidthSpaces(converted1);
console.log("With zero-width spaces:", withZWS);
console.log("With ZWS length:", withZWS.length);

// Try to convert again (simulating "once" mode behavior)
const cleanedForSecondConversion = removeZeroWidthSpaces(withZWS);
console.log("Cleaned for second conversion:", cleanedForSecondConversion);
console.log("Cleaned length:", cleanedForSecondConversion.length);

const converted2 = converter(cleanedForSecondConversion);
console.log("Second conversion:", converted2);
console.log("Second conversion length:", converted2.length);

// Check if they're equal
console.log("Are conversions equal?", converted1 === converted2);
console.log("Are cleaned and first conversion equal?", cleanedForSecondConversion === converted1);

// Test with a sentence containing 算法
const sentenceTest = "这个算法很好用";
console.log("\n--- Sentence Test ---");
console.log("Original sentence:", sentenceTest);

const sentenceConverted1 = converter(sentenceTest);
console.log("Sentence first conversion:", sentenceConverted1);

const sentenceWithZWS = addZeroWidthSpaces(sentenceConverted1);
console.log("Sentence with ZWS:", sentenceWithZWS);

const sentenceCleaned = removeZeroWidthSpaces(sentenceWithZWS);
console.log("Sentence cleaned:", sentenceCleaned);

const sentenceConverted2 = converter(sentenceCleaned);
console.log("Sentence second conversion:", sentenceConverted2);

console.log("Sentence conversions equal?", sentenceConverted1 === sentenceConverted2);
