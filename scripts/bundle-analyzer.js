#!/usr/bin/env node

/* eslint-env node */

import * as esbuild from "esbuild";
import * as fs from 'fs';

// Advanced bundle analysis
const analyzeBundle = async () => {
  console.log('🔍 Advanced Bundle Analysis...\n');

  try {
    // Analyze content.js bundle
    const result = await esbuild.build({
      entryPoints: ['./src/content.js'],
      bundle: true,
      target: 'es2022',
      format: 'esm',
      write: false,
      minify: true,
      treeShaking: true,
      metafile: true,
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    const { outputs } = result.metafile;
    const mainOutput = Object.values(outputs)[0];
    
    console.log('📊 Bundle Composition:');
    console.log(`  Total size: ${(mainOutput.bytes / 1024).toFixed(2)} KB`);
    
    // Analyze inputs
    const inputs = result.metafile.inputs;
    const inputsBySize = Object.entries(inputs)
      .map(([path, info]) => ({ path, bytes: info.bytes }))
      .sort((a, b) => b.bytes - a.bytes);

    console.log('\n📦 Largest Dependencies:');
    inputsBySize.slice(0, 10).forEach(({ path, bytes }) => {
      console.log(`  ${path}: ${(bytes / 1024).toFixed(2)} KB`);
    });

    // Calculate compression potential
    const uncompressedSize = result.outputFiles[0].contents.length;
    const compressionRatio = ((mainOutput.bytes / uncompressedSize) * 100).toFixed(1);
    
    console.log(`\n⚡ Optimization Stats:`);
    console.log(`  Compression ratio: ${compressionRatio}%`);
    console.log(`  Tree shaking enabled: ✅`);
    console.log(`  Minification enabled: ✅`);

    // Estimate gzip size
    const gzipEstimate = Math.round(mainOutput.bytes * 0.3); // Rough estimate
    console.log(`  Estimated gzipped: ~${(gzipEstimate / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('Error analyzing bundle:', error);
  }

  console.log('\n✅ Analysis completed!');
};

analyzeBundle();
