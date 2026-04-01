#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

(async () => {
  const root = process.cwd();
  const iconSrc = path.join(root, 'icon.png');
  try {
    await fs.access(iconSrc);
  } catch (err) {
    console.error(`icon.png not found at ${iconSrc}`);
    process.exit(0);
  }

  const outDir = path.join(root, '.output');
  let entries;
  try {
    entries = await fs.readdir(outDir, { withFileTypes: true });
  } catch (err) {
    console.error(`.output directory not found: ${err.message}`);
    process.exit(1);
  }

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const name = e.name.toLowerCase();
    if (name.includes('chrome') || name.includes('firefox') || name.includes('edge')) {
      const destDir = path.join(outDir, e.name);
      const dest = path.join(destDir, 'icon.png');
      try {
        await fs.copyFile(iconSrc, dest);
        console.log(`Copied icon.png -> ${dest}`);
      } catch (err) {
        console.error(`Failed to copy to ${dest}: ${err.message}`);
      }
    }
  }
})();

