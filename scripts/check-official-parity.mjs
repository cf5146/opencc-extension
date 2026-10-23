import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { verifyOfficialAssets } from "./verify-official-assets.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  poc = path.join(root, "scripts/opencc-feasibility");
const require = createRequire(path.join(poc, "package.json"));
const Native = (await import(pathToFileURL(require.resolve("opencc")))).default;
await import(pathToFileURL(require.resolve("opencc-jieba")));
const { parse } = require("jsonc-parser");
assert.equal(Native.version, "1.4.2");
assert.equal(
  JSON.parse(await fs.readFile(path.join(poc, "node_modules/opencc-jieba/package.json"), "utf8")).version,
  "1.4.2",
);
await verifyOfficialAssets();
const { loadOpenCC } = await import(pathToFileURL(path.join(root, "public/opencc/engine/runtime.mjs")));
const engine = await loadOpenCC(),
  bases = ["s2t", "s2tw", "s2twp", "s2hk", "tw2sp"],
  cache = new Map();
const reference = (cfg) => {
  if (!cache.has(cfg)) cache.set(cfg, new Native(cfg + ".json", { includeTofuRiskDictionaries: true }));
  return cache.get(cfg);
};
let tested = 0;
const long = [];
const fixtures = [
  ["official-testcases.json", "3f8273c5f432090ec1a8a01bd4d545046ad5a28e69eb41a081c5e3e54d3e402b"],
  ["official-jieba-testcases.json", "962babe39228b398f425b039c99255941a62c232815727da92c231159aee52f6"],
];
try {
  const loaded = await Promise.all(
    fixtures.map(async ([file, expectedHash]) => {
      const bytes = await fs.readFile(path.join(poc, "fixtures", file));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash);
      return { file, bytes };
    }),
  );
  for (const { file, bytes } of loaded) {
    for (const c of parse(bytes.toString()).cases)
      for (const config of Object.keys(c.expected)) {
        if (!bases.includes(config.replace("_jieba", ""))) continue;
        for (const cfg of config.endsWith("_jieba") ? [config] : [config, config + "_jieba"]) {
          assert.equal(
            engine.convert(cfg, c.input),
            reference(cfg).convertSync(c.input),
            file + ":" + c.id + ":" + cfg,
          );
          tested++;
        }
      }
  }
  for (const config of bases.flatMap((c) => [c, c + "_jieba"]))
    for (const chars of [100000, 1000000])
      for (const pattern of ["汉", "勇敢的士兵在软件开发中心使用鼠标，研究生命起源。 OpenCC 😀\n"]) {
        let text = pattern.repeat(Math.ceil(chars / pattern.length)).slice(0, chars);
        if (!text.isWellFormed()) text = text.slice(0, -1);
        const actual = engine.convert(config, text),
          expected = reference(config).convertSync(text);
        assert.equal(actual, expected, config + " " + chars);
        long.push({
          config,
          chars: text.length,
          pattern: pattern === "汉" ? "repeated-Han" : "mixed",
          sha256: createHash("sha256").update(actual).digest("hex"),
          outputBytes: Buffer.byteLength(actual),
        });
      }
  assert.equal(tested, 779);
  assert.equal(long.length, 40);
  const report = {
    source: "public/opencc/engine",
    nativeVersion: Native.version,
    policy: "includeTofuRiskDictionaries=true",
    matched: tested,
    long,
  };
  await fs.mkdir(path.join(root, ".output"), { recursive: true });
  await fs.writeFile(path.join(root, ".output/official-parity.json"), JSON.stringify(report, null, 2));
  console.log(
    "Bundled official engine: 779/779 native comparisons; all 40 complete 100k/1m long-input comparisons passed.",
  );
} finally {
  engine.close();
}
