#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const mode = 'development';
const arg = (process.argv[2] || 'chromium').toLowerCase();

// For build.mjs: chrome|firefox|edge (edge maps to chrome manifest).
const buildBrowser = arg === 'firefox' ? 'firefox' : 'chrome';
// For web-ext run: pass -t chromium for Chromium browsers; omit for Firefox.
const webExtTarget = arg === 'firefox' ? null : 'chromium';

const buildScript = path.join(projectRoot, 'build.mjs');
const manifestPath = path.join(projectRoot, 'build', 'manifest.json');

const npmCmd = 'npm';

async function waitForFile(filePath, timeoutMs = 60_000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      // keep waiting
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${filePath}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function runChild(command, args, options) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  return child;
}

let shuttingDown = false;
function shutdown(buildProc, runProc) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    runProc?.kill('SIGINT');
  } catch {
    // ignore
  }
  try {
    buildProc?.kill('SIGINT');
  } catch {
    // ignore
  }
}

const buildEnv = { ...process.env, MODE: mode, BROWSER: buildBrowser };
const buildProc = runChild(process.execPath, [buildScript, 'watch'], { cwd: projectRoot, env: buildEnv });

buildProc.on('exit', (code) => {
  if (!shuttingDown && code && code !== 0) {
    process.exitCode = code;
  }
});

process.on('SIGINT', () => shutdown(buildProc));
process.on('SIGTERM', () => shutdown(buildProc));

try {
  await waitForFile(manifestPath, 60_000);
} catch (e) {
  console.error(String(e));
  shutdown(buildProc);
  process.exit(1);
}

const startArgs = ['run', 'start'];
if (webExtTarget) {
  startArgs.push('--', '-t', webExtTarget);
}

// On Windows, npm is typically a PowerShell script (npm.ps1). Use a shell and pass a full command line.
const runProc =
  process.platform === 'win32'
    ? runChild(`${npmCmd} ${startArgs.join(' ')}`, [], { cwd: projectRoot, env: process.env, shell: true })
    : runChild(npmCmd, startArgs, { cwd: projectRoot, env: process.env, shell: false });

runProc.on('exit', (code) => {
  shutdown(buildProc, runProc);
  process.exit(code ?? 0);
});
