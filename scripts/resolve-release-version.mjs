#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function parseVersion(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return undefined;
  const parts = value.split(".").map(Number);
  return parts.every((n) => Number.isSafeInteger(n) && n <= 65535) && parts.some((n) => n > 0) ? parts : undefined;
}
function compare(left, right) {
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
export function resolveReleaseVersion({ packageVersion, tags = [], requestedVersion = "" }) {
  const current = parseVersion(packageVersion);
  if (!current) throw new Error(`Invalid package.json version: ${packageVersion}`);
  const latest = tags
    .map((tag) => (tag.startsWith("v") ? parseVersion(tag.slice(1)) : undefined))
    .filter(Boolean)
    .sort(compare)
    .at(-1);
  const base = latest && compare(latest, current) > 0 ? latest : current;
  if (requestedVersion.trim()) {
    const requested = parseVersion(requestedVersion.trim());
    if (!requested)
      throw new Error(
        `Invalid release version: ${requestedVersion}; use three components in 0..65535, excluding 0.0.0`,
      );
    if (compare(requested, base) <= 0)
      throw new Error(
        `Release version ${requestedVersion} must be greater than package.json and all release tags (${base.join(".")})`,
      );
    return requested.join(".");
  }
  if (base[2] === 65535) throw new Error("Patch version exhausted; an explicit release version is required");
  return [base[0], base[1], base[2] + 1].join(".");
}
function readTags(root) {
  let gitDir = path.join(root, ".git");
  if (fs.statSync(gitDir).isFile())
    gitDir = path.resolve(
      root,
      fs
        .readFileSync(gitDir, "utf8")
        .replace(/^gitdir:\s*/i, "")
        .trim(),
    );
  const common = path.join(gitDir, "commondir");
  if (fs.existsSync(common)) gitDir = path.resolve(gitDir, fs.readFileSync(common, "utf8").trim());
  const tags = [];
  const walk = (dir, prefix = "") => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      else tags.push(`${prefix}${entry.name}`);
    }
  };
  walk(path.join(gitDir, "refs", "tags"));
  const packed = path.join(gitDir, "packed-refs");
  if (fs.existsSync(packed))
    for (const line of fs.readFileSync(packed, "utf8").split(/\r?\n/)) {
      const match = /^\w+\s+refs\/tags\/(\S+)$/.exec(line);
      if (match) tags.push(match[1]);
    }
  return tags;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const version = resolveReleaseVersion({
    packageVersion: JSON.parse(fs.readFileSync("package.json", "utf8")).version,
    tags: readTags(process.cwd()),
    requestedVersion: process.env.RELEASE_VERSION || "",
  });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  console.log(`Resolved release version: ${version}`);
}
