#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const distScript = path.join(projectRoot, 'scripts', 'dist.mjs');

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: projectRoot, env: process.env, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`node ${args.join(' ')} exited with code ${code}`));
    });
  });
}

for (const browser of ['chrome', 'firefox', 'edge']) {
  await runNode([distScript, browser]);
}

// Keep the repo clean (mirrors previous `rm -rf ./dist`).
await fs.rm(path.join(projectRoot, 'dist'), { recursive: true, force: true });
