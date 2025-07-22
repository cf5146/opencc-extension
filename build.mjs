#!/usr/bin/env node

/* eslint-env node */

import * as esbuild from "esbuild";

const arg = process.argv[2];
const mode = process.env.MODE;
const browser = process.env.BROWSER;

const options = {
  entryPoints: [
    "./src/background.js",
    "./src/content.js",
    "./src/popup/index.js",
    "./src/popup/index.html",
    "./src/popup/index.css",
    "./src/options/index.js",
    "./src/options/index.html",
    "./src/options/index.css",
    {
      in: `./src/manifest.${browser}.json`,
      out: "manifest",
    },
    {
      in: "./icon.png",
      out: "icon",
    },
  ],
  loader: {
    ".html": "copy",
    ".css": "copy",
    ".json": "copy",
    ".png": "copy",
  },
  outbase: "src",
  outdir: arg === "watch" ? "./build" : arg,
  target: "es2020", // Updated to newer ES target for better optimization
  bundle: true,
  allowOverwrite: true,
  minify: mode === "production",
  sourcemap: mode === "development",
  treeShaking: true, // Enable tree shaking for smaller bundles
  splitting: false, // Disable code splitting for browser extensions
  format: "esm", // Use ES modules format
  platform: "browser", // Optimize for browser environment
  // Advanced optimizations for production
  ...(mode === "production" && {
    drop: ["console", "debugger"], // Remove console.log and debugger statements
    legalComments: "none", // Remove license comments to reduce size
    mangleProps: /^_/, // Mangle private properties starting with _
  }),
};

if (arg === "watch") {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else await esbuild.build(options);
