#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const browser = process.argv[2];
let outputDir;
switch (browser) {
  case "chrome":
    outputDir = path.resolve(".output", "chrome-mv3");
    break;
  case "firefox":
    outputDir = path.resolve(".output", "firefox-mv3");
    break;
  case "edge":
    outputDir = path.resolve(".output", "edge-mv3");
    break;
  default:
    console.error("Usage: node scripts/verify-build-output.mjs <chrome|firefox|edge>");
    process.exit(1);
}

const manifestPath = path.join(outputDir, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const httpMatch = ["http:", "//", "*/*"].join("");
const httpsMatch = ["https:", "//", "*/*"].join("");
const expectedPermissions = ["storage", "contextMenus", "scripting", "activeTab"];

if (manifest.manifest_version !== 3) throw new Error(`${browser}: manifest_version must be 3`);
if (manifest.version !== packageJson.version) {
  throw new Error(`${browser}: manifest version does not match package.json`);
}
if (
  !Array.isArray(manifest.permissions) ||
  manifest.permissions.length !== expectedPermissions.length ||
  expectedPermissions.some((permission) => !manifest.permissions.includes(permission))
) {
  throw new Error(`${browser}: permissions are incorrect`);
}
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify([httpMatch, httpsMatch])) {
  throw new Error(`${browser}: host permissions are incorrect`);
}
if (!manifest.action?.default_popup || !manifest.options_ui?.page) {
  throw new Error(`${browser}: popup/options entrypoints are missing`);
}

const icon = manifest.icons?.["128"];
const actionIcon = manifest.action.default_icon?.["128"];
if (!icon || !actionIcon) throw new Error(`${browser}: required 128px icons are missing`);
const requiredFiles = [manifest.action.default_popup, manifest.options_ui.page, icon, actionIcon];
const contentScripts = manifest.content_scripts;
if (!Array.isArray(contentScripts) || contentScripts.length !== 1) {
  throw new Error(`${browser}: exactly one static content script is required`);
}
const contentScript = contentScripts[0];
if (
  !Array.isArray(contentScript?.js) ||
  contentScript.js.length === 0 ||
  contentScript.run_at !== "document_idle" ||
  contentScript.all_frames !== false ||
  !Array.isArray(contentScript.matches) ||
  contentScript.matches.length !== 2 ||
  !contentScript.matches.includes(httpMatch) ||
  !contentScript.matches.includes(httpsMatch) ||
  (contentScript.css !== undefined && !Array.isArray(contentScript.css))
) {
  throw new Error(`${browser}: static top-frame content script is incorrect`);
}
requiredFiles.push(...contentScript.js, ...(contentScript.css ?? []));

if (browser === "firefox") {
  if (!manifest.browser_specific_settings?.gecko?.id) throw new Error("firefox: Gecko ID is missing");
  if (manifest.background?.type !== "module" || !Array.isArray(manifest.background?.scripts)) {
    throw new Error("firefox: MV3 module background is missing");
  }
  requiredFiles.push(...manifest.background.scripts);
} else if (manifest.background?.type !== "module" || !manifest.background?.service_worker) {
  throw new Error(`${browser}: service worker background is missing`);
} else {
  requiredFiles.push(manifest.background.service_worker);
}

function localReference(reference) {
  if (typeof reference !== "string" || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return undefined;
  const withoutQuery = reference.split(/[?#]/, 1)[0];
  const relativePath = decodeURIComponent(withoutQuery.replace(/^\/+/, ""));
  if (!relativePath) return undefined;
  const resolvedPath = path.resolve(outputDir, relativePath);
  const outputPrefix = `${path.resolve(outputDir)}${path.sep}`;
  if (resolvedPath !== path.resolve(outputDir) && !resolvedPath.startsWith(outputPrefix)) {
    throw new Error(`${browser}: local reference escapes the generated output directory`);
  }
  return resolvedPath;
}

async function verifyFiles(files, required = false) {
  for (const reference of files) {
    const filePath = localReference(reference);
    if (!filePath) {
      if (required) throw new Error(`${browser}: required local reference is invalid`);
      continue;
    }
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error(`${browser}: referenced path is not a file`);
  }
}

await verifyFiles(requiredFiles, true);

for (const htmlReference of [manifest.action.default_popup, manifest.options_ui.page]) {
  const htmlPath = localReference(htmlReference);
  if (!htmlPath) throw new Error(`${browser}: HTML entrypoint reference is invalid`);
  const html = await fs.readFile(htmlPath, "utf8");
  const references = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  await verifyFiles(references);
}

console.log(`${browser}: generated manifest and entrypoints verified`);
