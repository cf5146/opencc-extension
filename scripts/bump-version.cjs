#!/usr/bin/env node
// Update all root versions only after both input documents have been parsed.
const fs = require("node:fs");
async function main() {
  const { parseVersion } = await import("./resolve-release-version.mjs");
  const version = process.argv[2];
  if (!parseVersion(version)) throw new Error("A valid browser release version is required");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  if (!lock.packages?.[""]) throw new Error("package-lock.json must contain packages root metadata");
  pkg.version = version;
  lock.version = version;
  lock.packages[""].version = version;
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
