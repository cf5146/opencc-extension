#!/usr/bin/env node
// Bump the package and lockfile versions.
// Usage: node scripts/bump-version.cjs <version>

const fs = require("node:fs");

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("Version argument required");
  process.exit(1);
}

function updateJSON(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON:", file, e.message);
    return;
  }
  if (json.version === newVersion) return;
  json.version = newVersion;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log("Updated", file);
}

updateJSON("package.json");

const lockfile = "package-lock.json";
if (fs.existsSync(lockfile)) {
  const raw = fs.readFileSync(lockfile, "utf8");
  const json = JSON.parse(raw);
  json.version = newVersion;
  if (json.packages?.[""]) json.packages[""].version = newVersion;
  fs.writeFileSync(lockfile, JSON.stringify(json, null, 2) + "\n");
  console.log("Updated", lockfile);
}
