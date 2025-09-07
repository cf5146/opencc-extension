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
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    console.warn(`[generate-changelog] Command failed: ${cmd}`);
    if (process.env.DEBUG_CHANGELOG) {
      console.warn(err && err.stack ? err.stack : String(err));
    }
    return '';
  }
}

function normalizeRepoUrl(url) {
  if (!url) return '';
  // Remove surrounding whitespace
  url = url.trim();
  // Strip git+ prefix
  url = url.replace(/^git\+/, '');
  // SSH git@github.com:owner/repo(.git)?
  const sshMatch = /^git@github\.com:([^/]+)\/(.+?)(\.git)?$/.exec(url);
  if (sshMatch) {
    url = `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
  }
  // git://github.com/owner/repo(.git)?
  url = url.replace(/^git:\/\/github\.com\//, 'https://github.com/');
  // https with .git
  url = url.replace(/\.git(#.*)?$/i, '');
  return url;
}

// Collect repo URL
let repoUrl = process.env.REPO_URL;
if (!repoUrl) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
    );
    if (pkg.repository) {
      if (typeof pkg.repository === 'string') {
        repoUrl = pkg.repository;
      } else if (pkg.repository.url) {
        repoUrl = pkg.repository.url;
      }
    }
  } catch {
    /* ignore */
  }
}
if (!repoUrl) {
  repoUrl = sh('git config --get remote.origin.url');
}
repoUrl = normalizeRepoUrl(repoUrl);

// Previous tag (expects v* tags)
const prevTag = sh('git describe --tags --abbrev=0 --match "v*" 2>/dev/null');
const range = prevTag ? `${prevTag}..HEAD` : '';
const logCmd = `git log --pretty=format:%s --no-merges ${range}`.trim();
let commits = sh(logCmd)
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean)
  // filter out release commits
  .filter(s => !/^chore:\s+release\s+v?\d+\.\d+\.\d+$/i.test(s));

if (!commits.length) commits = ['(no changes)'];

const typeMap = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build',
  ci: 'CI',
  chore: 'Chores',
  style: 'Style'
};
const conventionalRe = /^(?<type>feat|fix|perf|refactor|docs|test|build|ci|chore|style)(!?)(\([^)]*\))?:\s*(?<msg>.+)$/i;

const buckets = {};
const other = [];

for (const c of commits) {
  const m = c.match(conventionalRe);
  if (m) {
    const rawType = m.groups.type.toLowerCase();
    const sectionName = typeMap[rawType] || 'Other';
    if (!buckets[sectionName]) buckets[sectionName] = [];
    buckets[sectionName].push(m.groups.msg.trim());
  } else {
    other.push(c);
  }
}
if (other.length) {
  if (!buckets.Other) buckets.Other = [];
  buckets.Other.push(...other);
}

const today = new Date().toISOString().slice(0, 10);
const heading = `## v${version} - ${today}`;
let compare = '';
if (prevTag && repoUrl) compare = `\n[Compare changes](${repoUrl}/compare/${prevTag}...v${version})\n`;

const prLinkRe = /\(#(\d+)\)/g;
let section = heading + compare + '\n';

for (const name of Object.keys(buckets).sort()) {
  section += `\n### ${name}\n`;
  for (const item of buckets[name]) {
    let transformed = item;
    if (repoUrl) {
      transformed = transformed.replace(
        prLinkRe,
        (_, id) => `([#${id}](${repoUrl}/pull/${id}))`
      );
    }
    section += `- ${transformed}\n`;
  }
}
section += '\n';

fs.writeFileSync(releaseBodyPath, section, 'utf8');
console.log('Wrote', releaseBodyPath);

if (update) {
  const changelogPath = 'CHANGELOG.md';
  let existing = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '';
  if (!existing.startsWith('# Changelog')) {
    existing = existing
      ? '# Changelog\n\n' + existing
      : '# Changelog\n\n';
  }
  if (existing.includes(heading)) {
    console.log('Section already exists; skipping prepend');
  } else {
    const withoutHeader = existing.replace(/^# Changelog\n?/, '').trimStart();
    const newContent = '# Changelog\n\n' + section + withoutHeader;
    fs.writeFileSync(changelogPath, newContent.trimEnd() + '\n', 'utf8');
    console.log('Updated CHANGELOG.md');
  }
}
