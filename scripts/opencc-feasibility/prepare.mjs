import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = path.dirname(fileURLToPath(import.meta.url));
const source = await fs.realpath(process.argv[2] || path.join(root, "source/OpenCC"));
// Developer-initiated build: git is resolved from the trusted local toolchain PATH.
// Keep all subprocess arguments fixed; a selected source directory is only a cwd.
const git = (args) => execFileSync("git", args, { cwd: source }); // NOSONAR S4036: trusted build tool, never selected by page input.
const commit = "025f371dc76b598d77384fbdab90c937471844d8";
if (git(["rev-parse", "HEAD"]).toString("utf8").trim() !== commit) throw new Error("Unexpected source commit");
if (git(["status", "--porcelain"]).toString("utf8").trim()) throw new Error("Modified official source");
const dist = path.join(root, "dist"),
  resources = [];
const hash = (b) => createHash("sha256").update(b).digest("hex");
const names = new Set();
const visit = (x) => {
  if (!x || typeof x !== "object") return;
  if (x.file) names.add(x.file);
  for (const v of Object.values(x)) visit(v);
};
await Promise.all(
  ["s2t", "s2tw", "s2twp", "s2hk", "tw2sp"]
    .flatMap((c) => [c, `${c}_jieba`])
    .map(async (name) => {
      const relative = `resources/config/${name}.json`;
      const original = `${name.endsWith("_jieba") ? "plugins/jieba/data/config" : "data/config"}/${name}.json`;
      // Git blob bytes are stable across Windows autocrlf and Linux checkouts.
      const bytes = git(["show", `${commit}:${original}`]);
      await fs.writeFile(path.join(dist, relative), bytes);
      visit(JSON.parse(bytes));
    }),
);
await Promise.all(
  (await fs.readdir(path.join(dist, "resources/dict")))
    .filter((file) => !names.has(file))
    .map((file) => fs.unlink(path.join(dist, "resources/dict", file))),
);
const directories = await Promise.all(
  ["config", "dict", "jieba_dict"].map(async (dir) =>
    Promise.all(
      (await fs.readdir(path.join(dist, "resources", dir))).sort().map(async (file) => {
        const p = `resources/${dir}/${file}`,
          b = await fs.readFile(path.join(dist, p));
        return {
          path: p,
          virtualPath: `/data/${dir === "jieba_dict" ? "config/jieba_dict" : dir}/${file}`,
          bytes: b.length,
          sha256: hash(b),
        };
      }),
    ),
  ),
);
resources.push(...directories.flat());
const artifacts = await Promise.all(
  ["opencc.mjs", "opencc.wasm", "runtime.mjs"].map(async (p) => {
    const b = await fs.readFile(path.join(dist, p));
    return { path: p, bytes: b.length, sha256: hash(b) };
  }),
);
const adapter = await Promise.all(
  (await fs.readdir(path.join(root, "adapter"))).sort().map(async (p) => {
    const b = await fs.readFile(path.join(root, "adapter", p));
    return { path: `adapter/${p}`, sha256: hash(b) };
  }),
);
const manifest = {
  schema: 1,
  official: { repository: "https://github.com/BYVoid/OpenCC", tag: "ver.1.4.2", commit, sourceUnmodified: true },
  toolchain: {
    emsdk: "4.0.22",
    emsdkCommit: "15915cad554b707837024dc2758b6a1c5b94b036",
    emscriptenSdkHash: "bebaf7e50e31865b0724f17eaa52e161e2dfef5a",
    python: "3.13.9",
    cmake: "3.31.10",
    ninja: "1.13.0",
    hostCompiler: "GCC 14 (Debian 13.6 x86_64)",
  },
  policy: {
    includeTofuRiskDictionaries: true,
    segmentation: ["mmseg", "jieba"],
    input: "complete UTF-8 heap buffer; explicit byte length; no chunks or fallback",
  },
  adapter,
  artifacts,
  resources,
};
await fs.writeFile(path.join(dist, "engine-resources.json"), JSON.stringify(manifest, null, 2) + "\n");
await fs.rm(path.join(dist, "manifest.json"), { force: true });
console.log(
  JSON.stringify({
    resources: resources.length,
    resourceBytes: resources.reduce((n, r) => n + r.bytes, 0),
    artifactBytes: artifacts.reduce((n, r) => n + r.bytes, 0),
  }),
);
