import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function verifyOfficialAssets(directory = path.join(root, "public/opencc/engine")) {
  const lock = JSON.parse(await fs.readFile(path.join(root, "scripts/opencc-feasibility/artifact-lock.json"), "utf8"));
  const actual = JSON.parse(await fs.readFile(path.join(directory, "engine-resources.json"), "utf8"));
  assert.deepEqual(actual, lock, "Official engine manifest differs from the reviewed lock");
  await Promise.all(
    [...lock.resources, ...lock.artifacts].map(async (item) => {
      const bytes = await fs.readFile(path.join(directory, item.path));
      assert.equal(bytes.length, item.bytes, item.path + " size");
      assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.path + " hash");
    }),
  );
  return lock;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // CLI inputs select reviewed build locations rather than arbitrary filesystem paths.
  let directory;
  switch (process.argv[2]) {
    case undefined:
      break;
    case "chrome":
      directory = path.join(root, ".output/chrome-mv3/opencc/engine");
      break;
    case "firefox":
      directory = path.join(root, ".output/firefox-mv3/opencc/engine");
      break;
    case "edge":
      directory = path.join(root, ".output/edge-mv3/opencc/engine");
      break;
    default:
      throw new Error("Unknown build target; use chrome, firefox or edge");
  }
  await verifyOfficialAssets(directory);
  console.log("Official source, manifest and 32 bundled engine/resource hashes verified.");
}
