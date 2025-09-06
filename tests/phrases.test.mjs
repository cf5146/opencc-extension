import assert from "node:assert";
import { JSDOM } from "jsdom";
import { convertAllNewTextNodes, resetConversionCache } from "../src/conversion.js";

function setupDom(html) {
  const dom = new JSDOM(html, { url: "https://example.com" });
  global.document = dom.window.document;
  global.NodeFilter = dom.window.NodeFilter;
  return dom;
}

function testSingleConversionNoDuplicates() {
  resetConversionCache();
  setupDom("<body>算法</body>");
  convertAllNewTextNodes("cn", "twp");
  const once = document.body.textContent;
  convertAllNewTextNodes("cn", "twp");
  const twice = document.body.textContent;
  assert.strictEqual(once, twice, "Text should not change after first conversion (no duplication)");
  assert.ok(twice.includes("演算法"), "Expected 演算法 after conversion");
  assert.ok(!/演演算法/.test(twice), "Should not contain duplicated 演演算法");
}

function testDynamicAppend() {
  resetConversionCache();
  setupDom("<body><div id='c'>這是算法</div></body>");
  convertAllNewTextNodes("cn", "twp");
  document.getElementById("c").appendChild(document.createTextNode(" 和更多算法"));
  convertAllNewTextNodes("cn", "twp");
  const text = document.body.textContent;
  const matches = text.match(/演算法/g) || [];
  assert.ok(matches.length === 2, `Expected two converted occurrences, got ${matches.length}`);
  assert.ok(!/演演算法/.test(text), "No duplicated prefix in dynamic update");
}

function run() {
  testSingleConversionNoDuplicates();
  testDynamicAppend();
  console.log("✔ auto-mode conversion tests passed");
}

run();
