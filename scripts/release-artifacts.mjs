import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { archiveNames, sha256 } from "./package-built.mjs";

export async function releaseArtifacts(root = process.cwd(), env = process.env) {
  const read = (name) => fs.readFile(path.join(root, name));
  const { version } = JSON.parse(await read("package.json"));
  const lock = JSON.parse(await read("package-lock.json"));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Package version must be a stable semantic version");
  if (env.EXPECTED_VERSION?.trim() && env.EXPECTED_VERSION.trim() !== version)
    throw new Error("Expected version does not match package.json");
  if (lock.version !== version || lock.packages?.[""]?.version !== version)
    throw new Error("Package lock version does not match package.json");
  if (!/^[a-f\d]{40}$/i.test(env.GITHUB_SHA ?? "")) throw new Error("GITHUB_SHA must be a full commit SHA");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (commit !== env.GITHUB_SHA) throw new Error("GITHUB_SHA does not match HEAD");
  const notes = await read("CHANGELOG_RELEASE.md");
  const heading = notes.toString("utf8").split(/\r?\n/, 1)[0];
  const date = heading.slice(`## v${version} - `.length);
  if (heading !== `## v${version} - ${date}` || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Release notes must start with the exact version heading");
  const sums = await read(".output/SHA256SUMS");
  const lines = sums.toString("utf8").trimEnd().split(/\r?\n/);
  if (lines.length !== archiveNames.length) throw new Error("SHA256SUMS must contain exactly three archives");
  const files = new Map();
  const hashes = {};
  for (const [index, name] of archiveNames.entries()) {
    const contents = await read(`.output/${name}`);
    if (contents.length < 22 || contents.readUInt32LE(0) !== 0x04034b50) throw new Error(`Invalid ZIP: ${name}`);
    hashes[name] = sha256(contents);
    if (lines[index] !== `${hashes[name]}  ${name}`) throw new Error(`Checksum mismatch: ${name}`);
    files.set(name, contents);
  }
  hashes["CHANGELOG_RELEASE.md"] = sha256(notes);
  execFileSync("git", ["diff", "--quiet", "HEAD", "--"], { cwd: root, stdio: "pipe" });
  files.set("SHA256SUMS", sums);
  files.set("CHANGELOG_RELEASE.md", notes);
  files.set("release-metadata.json", `${JSON.stringify({ version, commit, sha256: hashes }, null, 2)}\n`);
  const destination = path.join(root, ".output/release-artifacts");
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  for (const [name, contents] of files) await fs.writeFile(path.join(destination, name), contents);
  if (env.GITHUB_OUTPUT) await fs.appendFile(env.GITHUB_OUTPUT, `version=${version}\n`);
  return { version, commit, sha256: hashes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await releaseArtifacts();
}
