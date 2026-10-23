import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { verifyOfficialAssets } from "./verify-official-assets.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  source = path.join(root, "scripts/opencc-feasibility/dist"),
  target = path.join(root, "public/opencc/engine");
const lock = await verifyOfficialAssets(source);
assert.equal(lock.official.commit, "025f371dc76b598d77384fbdab90c937471844d8");
await Promise.all(
  [...lock.resources, ...lock.artifacts, { path: "manifest.json" }].map(async (item) => {
    const out = path.join(target, item.path);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.copyFile(path.join(source, item.path), out);
  }),
);
await verifyOfficialAssets(target);
console.log("Reviewed source-built engine staged; no download or lock update performed.");
