#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match ? match.slice(1).map(Number) : undefined;
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function formatVersion(version) {
  return version.join(".");
}

function resolveGitDirectory() {
  const dotGit = path.resolve(".git");
  const stat = fs.statSync(dotGit);
  if (stat.isDirectory()) return dotGit;

  const gitFile = fs.readFileSync(dotGit, "utf8").trim();
  const prefix = "gitdir:";
  if (!gitFile.toLowerCase().startsWith(prefix)) throw new Error("Cannot resolve the repository git directory");
  const gitDirectory = gitFile.slice(prefix.length).trim();
  if (!gitDirectory) throw new Error("Cannot resolve the repository git directory");
  return path.resolve(path.dirname(dotGit), gitDirectory);
}

function collectLooseTags(directory, prefix = "") {
  const tags = [];
  if (!fs.existsSync(directory)) return tags;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const tag = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      tags.push(...collectLooseTags(path.join(directory, entry.name), `${tag}/`));
    } else if (tag.startsWith("v") && parseVersion(tag.slice(1))) {
      tags.push(tag);
    }
  }
  return tags;
}

function readLatestTag() {
  const gitDirectory = resolveGitDirectory();
  const tags = collectLooseTags(path.join(gitDirectory, "refs", "tags"));
  const packedRefs = path.join(gitDirectory, "packed-refs");
  if (fs.existsSync(packedRefs)) {
    for (const line of fs.readFileSync(packedRefs, "utf8").split(/\r?\n/)) {
      const match = /^\w+\s+refs\/tags\/(v[^\s]+)$/.exec(line);
      if (match && parseVersion(match[1].slice(1))) tags.push(match[1]);
    }
  }

  return (
    tags
      .map((tag) => ({ tag, version: parseVersion(tag.slice(1)) }))
      .sort((left, right) => compareVersions(left.version, right.version))
      .at(-1)?.tag ?? ""
  );
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageVersion = parseVersion(packageJson.version);
if (!packageVersion) throw new Error(`Invalid package.json version: ${packageJson.version}`);

const latestTag = readLatestTag();
const latestTagVersion = parseVersion(latestTag.slice(1));
const requestedVersion = process.env.RELEASE_VERSION?.trim() ?? "";

let resolvedVersion;
let resumed = false;
if (requestedVersion) {
  const requested = parseVersion(requestedVersion);
  if (!requested) throw new Error(`Invalid release version: ${requestedVersion}`);
  const canResume =
    compareVersions(requested, packageVersion) === 0 &&
    latestTagVersion &&
    compareVersions(requested, latestTagVersion) === 0;
  if (canResume) {
    resolvedVersion = requested;
    resumed = true;
  } else if (compareVersions(requested, packageVersion) <= 0) {
    throw new Error(`Release version ${requestedVersion} must be greater than package.json ${packageJson.version}`);
  } else if (latestTagVersion && compareVersions(requested, latestTagVersion) <= 0) {
    throw new Error(`Release version ${requestedVersion} must be greater than ${latestTag}`);
  } else {
    resolvedVersion = requested;
  }
} else {
  const base =
    latestTagVersion && compareVersions(latestTagVersion, packageVersion) > 0 ? latestTagVersion : packageVersion;
  resolvedVersion = [base[0], base[1], base[2] + 1];
}

const version = formatVersion(resolvedVersion);
const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) fs.appendFileSync(outputPath, `version=${version}\nresumed=${resumed}\n`);
console.log(`Resolved release version: ${version}`);
if (resumed) console.log(`Resuming existing release: v${version}`);
