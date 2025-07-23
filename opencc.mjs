#!/usr/bin/env node

/* eslint-env node */

import { writeFile, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// This script creates a custom build of opencc-js with only the dictionaries we need.
// This significantly reduces the bundle size.

const __dirname = dirname(fileURLToPath(import.meta.url));
const openccPath = dirname(resolve(__dirname, "node_modules/opencc-js/package.json"));

const locales = ["cn", "hk", "tw", "twp"];

const dicts = [
  "STPhrases",
  "STCharacters",
  "TWVariants",
  "TWPhrases",
  "HKVariants",
];

const configs = [
  "s2t",
  "t2s",
  "s2hk",
  "hk2s",
  "s2tw",
  "tw2s",
  "s2twp",
  "tw2sp",
  "t2tw",
  "t2hk",
];

const readJson = async (path) => JSON.parse(await readFile(path, "utf-8"));

const dictObjects = await Promise.all(
  dicts.map(async (dict) => ({
    name: dict,
    data: await readJson(resolve(openccPath, `dist/dict/${dict}.json`)),
  }))
);

const configObjects = await Promise.all(
  configs.map(async (config) => ({
    name: config,
    data: await readJson(resolve(openccPath, `dist/config/${config}.json`)),
  }))
);

const code = `
import { ConverterFactory, dictionary } from "opencc-js";

const dictionaries = {
${dictObjects.map((d) => `  "${d.name}": ${JSON.stringify(d.data)}`).join(",\n")}
};

const configurations = {
${configObjects.map((c) => `  "${c.name}": ${JSON.stringify(c.data)}`).join(",\n")}
};

const factory = ConverterFactory(
  (name) => {
    if (dictionaries[name]) {
      return dictionary.Buffer(dictionaries[name]);
    }
    return undefined;
  },
  (name) => {
    return configurations[name];
  }
);

export const Converter = ({ from, to }) => {
  const fromLocale = ${JSON.stringify(locales)}.includes(from) ? from : "t";
  const toLocale = ${JSON.stringify(locales)}.includes(to) ? to : "t";
  return factory({ from: fromLocale, to: toLocale });
};

export const locales = ${JSON.stringify(locales)};
`;

await writeFile("src/opencc.js", code);

await build({
  entryPoints: ["src/opencc.js"],
  bundle: true,
  outfile: "src/opencc.min.js",
  format: "esm",
  minify: true,
  allowOverwrite: true,
});
