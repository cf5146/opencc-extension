#!/usr/bin/env node
// Bump version across package.json and manifest templates.
// Usage: node scripts/bump-version.cjs <version>

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Version argument required');
  process.exit(1);
}

function updateJSON(file) {
  if (!fs.existsSync(file)) return;
  const p = path.resolve(file);
  const raw = fs.readFileSync(p, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON:', file, e.message);
    return;
  }
  if (json.version === newVersion) return;
  json.version = newVersion;
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  console.log('Updated', file);
}

updateJSON('package.json');

// Update any src/manifest.*.json files
if (fs.existsSync('src')) {
  fs.readdirSync('src')
    .filter(f => /^manifest\..+\.json$/.test(f))
    .forEach(f => updateJSON(path.join('src', f)));
}
