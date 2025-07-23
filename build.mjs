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
  target: "es2022", // Updated to even newer ES target for better optimization
  bundle: true,
  allowOverwrite: true,
  minify: mode === "production",
  sourcemap: mode === "development",
  treeShaking: true, // Enable tree shaking for smaller bundles
  splitting: false, // Disable code splitting for browser extensions
  format: "iife", // Use IIFE format for browser extensions
  platform: "browser", // Optimize for browser environment
  // Optimize external dependencies
  external: [], // Let esbuild bundle everything for better tree shaking
  // Advanced optimizations for production
  ...(mode === "production" && {
    drop: ["console", "debugger"], // Remove console.log and debugger statements
    legalComments: "none", // Remove license comments to reduce size
    mangleProps: /^_/, // Mangle private properties starting with _
    keepNames: false, // Allow name mangling for smaller bundles
    minifyIdentifiers: true, // Minify variable names
    minifySyntax: true, // Minify syntax
    minifyWhitespace: true, // Remove unnecessary whitespace
    // Advanced compression settings
    define: {
      "process.env.NODE_ENV": '"production"',
      // Help with opencc-js optimization
      global: "globalThis",
    },
    // Pure annotations for better tree shaking
    pure: ["console.log", "console.warn", "console.error"],
    // Aggressive tree shaking for opencc-js
    ignoreAnnotations: false, // Respect /*#__PURE__*/ annotations
  }),
  // Development optimizations
  ...(mode === "development" && {
    keepNames: true, // Keep names in development for debugging
    minifyIdentifiers: false,
    sourcesContent: true,
  }),
};

if (arg === "watch") {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else await esbuild.build(options);
