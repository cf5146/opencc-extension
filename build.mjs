#!/usr/bin/env node

/* eslint-env node */

import * as esbuild from "esbuild";

const arg = process.argv[2];
const mode = process.env.MODE || "development";
// Default to chrome when BROWSER not provided (e.g. generic CI build)
const browser = process.env.BROWSER || "chrome";
const outdir = arg && arg !== "watch" ? arg : "./build";

const options = {
  entryPoints: [
    './src/background.ts',
    './src/content.ts',
    './src/popup/index.ts',
    './src/popup/index.html',
    './src/popup/index.css',
    './src/options/index.ts',
    './src/options/index.html',
    './src/options/index.css',
    { in: `./src/manifest.${browser}.json`, out: 'manifest' },
    { in: './icon.png', out: 'icon' },
  ],
  loader: {
    ".html": "copy",
    ".css": "copy",
    ".json": "copy",
    ".png": "copy",
  },
  outbase: "src",
  outdir,
  target: "es6",
  bundle: true,
  allowOverwrite: true,
  minify: mode === "production",
  sourcemap: mode === "development",
};

if (arg === "watch") {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(`[watch] building to ${outdir} with browser=${browser} mode=${mode}`);
} else {
  await esbuild.build(options);
  console.log(`Built to ${outdir} (browser=${browser}, mode=${mode})`);
}
