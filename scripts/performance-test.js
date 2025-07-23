#!/usr/bin/env node

/* eslint-env node */

import * as fs from 'fs';
import * as path from 'path';

// Performance test for the extension
const testPerformance = () => {
  console.log('🚀 Running Performance Tests...\n');

  // Test 1: Bundle size analysis
  console.log('📦 Bundle Size Analysis:');
  const buildDir = './build';
  
  if (fs.existsSync(buildDir)) {
    const files = fs.readdirSync(buildDir, { recursive: true });
    let totalSize = 0;
    
    files.forEach(file => {
      const filePath = path.join(buildDir, file);
      if (fs.statSync(filePath).isFile()) {
        const size = fs.statSync(filePath).size;
        totalSize += size;
        const sizeKB = (size / 1024).toFixed(2);
        console.log(`  ${file}: ${sizeKB} KB`);
      }
    });
    
    console.log(`  Total: ${(totalSize / 1024).toFixed(2)} KB\n`);
  } else {
    console.log('  Build directory not found. Run build first.\n');
  }

  // Test 2: Source code metrics
  console.log('📊 Source Code Metrics:');
  const srcDir = './src';
  let totalLines = 0;
  let totalFiles = 0;

  const countLines = (dir) => {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        countLines(filePath);
      } else if (file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        totalLines += lines;
        totalFiles++;
        console.log(`  ${filePath}: ${lines} lines`);
      }
    });
  };

  countLines(srcDir);
  console.log(`  Total: ${totalFiles} files, ${totalLines} lines\n`);

  // Test 3: Dependency analysis
  console.log('📚 Dependencies:');
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  
  console.log('  Runtime dependencies:');
  Object.entries(packageJson.dependencies || {}).forEach(([name, version]) => {
    console.log(`    ${name}: ${version}`);
  });
  
  console.log('  Dev dependencies:');
  Object.entries(packageJson.devDependencies || {}).forEach(([name, version]) => {
    console.log(`    ${name}: ${version}`);
  });

  console.log('\n✅ Performance test completed!');
};

testPerformance();
