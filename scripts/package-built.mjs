import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { createZip } from "@aklinker1/zero-zip";
import { verifyBuildOutput } from "./verify-build-output.mjs";

export const browsers = ["chrome", "firefox", "edge"];
export const archiveNames = browsers.map((browser) => `opencc.${browser}.zip`);
export const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");

async function filesIn(directory, prefix = "") {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Invalid build directory: ${directory}`);
  const files = [];
  for (const name of (await fs.readdir(directory)).sort()) {
    const absolute = path.join(directory, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const entry = await fs.lstat(absolute);
    if (entry.isSymbolicLink()) throw new Error(`Build output contains a symlink: ${relative}`);
    if (entry.isDirectory()) files.push(...(await filesIn(absolute, relative)));
    else if (entry.isFile()) files.push({ absolute, relative });
    else throw new Error(`Build output contains an unsupported file: ${relative}`);
  }
  return files.sort((a, b) => (a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0));
}

export async function packageBuilt(root = process.cwd()) {
  const inputs = [];
  for (const browser of browsers) {
    const files = await filesIn(path.join(root, ".output", `${browser}-mv3`));
    await verifyBuildOutput(browser, root);
    inputs.push(files);
  }
  const checksums = [];
  for (const [index, files] of inputs.entries()) {
    const zip = createZip();
    for (const file of files) zip.addFile(file.relative, await fs.readFile(file.absolute));
    const contents = await zip.toBuffer();
    const name = archiveNames[index];
    await fs.writeFile(path.join(root, ".output", name), contents);
    checksums.push(`${sha256(contents)}  ${name}\n`);
  }
  await fs.writeFile(path.join(root, ".output/SHA256SUMS"), checksums.join(""));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await packageBuilt();
}
