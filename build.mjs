#!/usr/bin/env node

/* eslint-env node */

import * as esbuild from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";

const arg = process.argv[2];
const mode = process.env.MODE || "development";
// Default to chrome when BROWSER not provided (e.g. generic CI build)
const browser = process.env.BROWSER || "chrome";
// Map unsupported/alias browser types (e.g., edge) to an existing manifest template
const manifestBrowser = ["chrome", "firefox"].includes(browser) ? browser : "chrome";
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
  { in: `./src/manifest.${manifestBrowser}.json`, out: 'manifest' },
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
  target: "es2022",
  bundle: true,
  allowOverwrite: true,
  minify: mode === "production",
  sourcemap: mode === "development",
  plugins: [
    {
      name: "inject-manifest-version",
      setup(build) {
        build.onEnd(async () => {
          try {
            const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
            const ver = pkg.version;
            if (!ver) return;
            const manifestPath = path.join(outdir, "manifest.json");
            const raw = await fs.readFile(manifestPath, "utf8");
            const json = JSON.parse(raw);
            if (json.version !== ver) {
              json.version = ver;
              await fs.writeFile(manifestPath, JSON.stringify(json, null, 2));
              console.log(`[inject] Updated manifest version -> ${ver}`);
            }
          } catch (e) {
            console.warn("[inject] Failed to update manifest version", e.message);
          }
        });
      }
    }
  ]
};

if (arg === "watch") {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(`[watch] building to ${outdir} with browser=${browser} (manifest=${manifestBrowser}) mode=${mode}`);
} else {
  await esbuild.build(options);
  console.log(`Built to ${outdir} (browser=${browser}, manifest=${manifestBrowser}, mode=${mode})`);
}
