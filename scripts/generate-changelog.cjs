#!/usr/bin/env node
// Generates (and optionally updates) the CHANGELOG for a given version.
// Usage: node scripts/generate-changelog.cjs <version> [--update]

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Version argument required');
  process.exit(1);
}
const update = process.argv.includes('--update');
const releaseBodyPath = 'CHANGELOG_RELEASE.md';

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); }
  catch (err) {
    console.error(`Error executing command "${cmd}":`, err.message);
    return '';
  }
}

const prevTag = sh('git describe --tags --abbrev=0 --match "v*" 2>/dev/null');
const range = prevTag ? `${prevTag}..HEAD` : '';
const logCmd = `git log --pretty=format:%s --no-merges ${range}`.trim();
let commits = sh(logCmd).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  .filter(s => !/^chore:\s+release\s+v?\d+\.\d+\.\d+$/i.test(s));
const buckets = {};
const other = [];
if (!commits.length) commits = ['(no changes)'];

const typeMap = { feat: 'Features', fix: 'Fixes', perf: 'Performance', refactor: 'Refactoring', docs: 'Documentation', test: 'Tests', build: 'Build', ci: 'CI', chore: 'Chore', style: 'Style' };
const buckets = {}; const other = [];
const conventionalRe = /^(?<type>feat|fix|perf|refactor|docs|test|build|ci|chore|style)(!?)(\([^)]*\))?:\s*(?<msg>.+)$/i;

for (const c of commits) {
  const m = c.match(conventionalRe);
  if (m) {
    const rawType = m.groups.type.toLowerCase();
    const section = typeMap[rawType] || 'Other';
    if (!buckets[section]) buckets[section] = [];
    buckets[section].push(m.groups.msg.trim());
  } else other.push(c);
}
if (other.length) buckets.Other = (buckets.Other || []).concat(other);
const today = new Date().toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0,10);
const heading = `## v${version} - ${today}`;
let compare = '';
if (prevTag) compare = `\n[Compare changes](https://github.com/cf5146/opencc-extension/compare/${prevTag}...v${version})\n`;

const prLinkRe = /\(#(\d+)\)/g;
let section = heading + compare + '\n';
for (const name of Object.keys(buckets).sort()) {
  section += `\n### ${name}\n`;
  for (const item of buckets[name]) {
    const transformed = item.replace(prLinkRe, (_, id) => `([#${id}](https://github.com/cf5146/opencc-extension/pull/${id}))`);
    section += `- ${transformed}\n`;
  }
}
section += '\n';

fs.writeFileSync(releaseBodyPath, section, 'utf8');
console.log('Wrote', releaseBodyPath);

if (update) {
  const changelogPath = 'CHANGELOG.md';
  let existing = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';
  if (!existing.startsWith('# Changelog')) existing = existing ? '# Changelog\n\n' + existing : '# Changelog\n\n';
  if (existing.includes(heading)) {
    console.log('Section already exists; skipping prepend');
  } else {
    const withoutHeader = existing.replace(/^# Changelog\n?/,'').trimStart();
    const newContent = '# Changelog\n\n' + section + withoutHeader;
    fs.writeFileSync(changelogPath, newContent.trimEnd() + '\n');
    console.log('Updated CHANGELOG.md');
  }
}
