import assert from "node:assert";
import { convertText } from "../src/utils/convert.js";

function testCnToTwpAlgorithm() {
  const input = "這是一個算法示例"; // Simplified phrase embedded
  const result = convertText("cn", "twp", input);
  assert.ok(result.includes("演算法"), `Expected '演算法' in result, got: ${result}`);
}

function run() {
  const tests = [testCnToTwpAlgorithm];
  for (const t of tests) t();
  console.log(`✔ ${tests.length} tests passed`);
}

run();
