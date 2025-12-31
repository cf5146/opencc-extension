#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const browser = (process.argv[2] || '').toLowerCase();
const allowed = new Set(['chrome', 'firefox', 'edge']);

if (!allowed.has(browser)) {
  console.error('Usage: node scripts/dist.mjs <chrome|firefox|edge>');
  process.exit(1);
}

const mode = 'production';
const outDir = path.join(projectRoot, 'dist', browser);
const buildScript = path.join(projectRoot, 'build.mjs');

const npmCmd = 'npm';

function run(command, args, { env, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, env, stdio: 'inherit', shell });
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

const buildEnv = { ...process.env, MODE: mode, BROWSER: browser };
await run(process.execPath, [buildScript, outDir], { env: buildEnv, shell: false });

const zipName = `opencc.${browser}.zip`;
// Use npm exec so the local devDependency web-ext is used consistently.
// On Windows, npm may resolve to a PowerShell script (npm.ps1). Use a shell and pass a full command line.
if (process.platform === 'win32') {
  const cmdLine = `${npmCmd} exec -- web-ext build --overwrite-dest -s "${outDir}" -a . -n "${zipName}"`;
  await run(cmdLine, [], { env: process.env, shell: true });
} else {
  await run(
    npmCmd,
    ['exec', '--', 'web-ext', 'build', '--overwrite-dest', '-s', outDir, '-a', '.', '-n', zipName],
    { env: process.env, shell: false },
  );
}
