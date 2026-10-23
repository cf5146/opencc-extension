import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const scripts = path.dirname(fileURLToPath(import.meta.url));
const lab = process.env.SHORT_NODE_LAB;
assert.ok(lab && path.isAbsolute(lab), "Set SHORT_NODE_LAB to a dedicated absolute results directory");
fs.mkdirSync(lab, { recursive: true });
const candidateRoot = process.env.SHORT_NODE_CANDIDATE_ROOT ?? path.resolve(scripts, "../..");
const baselineRoot = process.env.SHORT_NODE_BASELINE_ROOT ?? path.join(lab, "baseline-source");
const sourceOutputs = {
  baseline: path.join(baselineRoot, ".output/edge-mv3"),
  candidate: path.join(candidateRoot, ".output/edge-mv3"),
};
const cli = process.env.PLAYWRIGHT_CLI;
assert.ok(cli && path.isAbsolute(cli), "Set PLAYWRIGHT_CLI to the installed CLI JavaScript entrypoint");
const baselineSHA = process.env.SHORT_NODE_BASELINE_SHA;
assert.match(baselineSHA ?? "", /^[0-9a-f]{40}$/, "Set SHORT_NODE_BASELINE_SHA to the exact baseline source commit");
const sha = (x) => createHash("sha256").update(x).digest("hex");
const write = (name, value) => fs.writeFileSync(path.join(lab, name), JSON.stringify(value, null, 2) + "\n");
const git = (args) => {
  const r = spawnSync("git", args, { cwd: candidateRoot, encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
function inventory(dir) {
  const files = {};
  const visit = (current, relative = "") => {
    for (const d of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(current, d.name),
        r = path.posix.join(relative, d.name);
      if (d.isDirectory()) visit(p, r);
      else files[r] = sha(fs.readFileSync(p));
    }
  };
  visit(dir);
  return files;
}
assert.ok(fs.existsSync(cli), "Installed Playwright CLI required");
assert.ok(
  !fs.existsSync(path.join(lab, "results.json")),
  "Use a fresh lab directory or preserve/remove previous results explicitly; do not silently overwrite evidence",
);
const outputs = {},
  artifacts = {};
for (const variant of ["baseline", "candidate"]) {
  assert.ok(
    fs.existsSync(path.join(sourceOutputs[variant], "manifest.json")),
    "Build first: " + sourceOutputs[variant],
  );
  outputs[variant] = path.join(lab, "artifacts", variant);
  assert.ok(!fs.existsSync(outputs[variant]), "Artifact snapshot exists; use a fresh directory");
  fs.cpSync(sourceOutputs[variant], outputs[variant], { recursive: true });
  artifacts[variant] = {
    sourcePath: sourceOutputs[variant],
    snapshot: outputs[variant],
    files: inventory(outputs[variant]),
  };
}
const trackedSourceHashes = {};
for (const file of git(["ls-files"]).split("\n")) {
  const p = path.join(candidateRoot, file);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) trackedSourceHashes[file] = sha(fs.readFileSync(p));
}
const candidateDiff = git(["diff", "HEAD", "--binary"]);
fs.writeFileSync(path.join(lab, "candidate-working-tree.patch"), candidateDiff);
write("provenance.json", {
  recordedAt: new Date().toISOString(),
  baselineSHA,
  candidateCheckoutHEAD: git(["rev-parse", "HEAD"]),
  candidateStatus: git(["status", "--short"]),
  candidateDiffSha256: sha(candidateDiff),
  candidateRoot,
  baselineRoot,
  trackedSourceHashes,
  artifacts,
  cli,
  node: process.version,
  os: os.type() + " " + os.release(),
  cpu: os.cpus()[0].model,
  logicalCPUs: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
  method:
    "Clean-built baseline and candidate outputs snapshotted before all timing. Five sequential alternating baseline/candidate trial pairs per mode/input kind; fresh isolated profile per session. No instrumentation. No OS-cold assumption.",
});
const { loadOpenCC } = await import(pathToFileURL(path.join(outputs.baseline, "opencc/engine/runtime.mjs")));
const session = await loadOpenCC(),
  base = "勇敢的士兵在软件开发中心使用鼠标。",
  expected = {};
for (const mode of ["mmseg", "jieba"])
  for (const kind of ["unique", "repeated"]) {
    const config = "s2twp" + (mode === "jieba" ? "_jieba" : "");
    const values = Array.from({ length: 20000 }, (_, i) =>
      session.convert(config, base + (kind === "unique" ? i : "")),
    );
    expected[mode + "-" + kind] = {
      hash1000: sha(JSON.stringify(values.slice(0, 1000))),
      hash20000: sha(JSON.stringify(values)),
      firstOutput: values[0],
    };
  }
session.close();
write("expected.json", expected);
const call = (args, json = false) => {
  const r = spawnSync(process.execPath, [cli, "-s=short-node-acceptance", ...(json ? ["--json"] : []), ...args], {
    cwd: lab,
    encoding: "utf8",
    timeout: 300000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error || r.status !== 0) throw r.error ?? Error(r.stdout + r.stderr);
  if (!json) return r.stdout;
  const p = JSON.parse(r.stdout);
  if (p.isError || p.error) throw Error(r.stdout);
  return typeof p.result === "string" ? JSON.parse(p.result) : p.result;
};
const rows = [];
for (let trial = 0; trial < 5; trial++)
  for (const mode of trial % 2 ? ["jieba", "mmseg"] : ["mmseg", "jieba"])
    for (const kind of trial % 2 ? ["repeated", "unique"] : ["unique", "repeated"])
      for (const variant of trial % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"]) {
        const identity = `${trial}-${mode}-${kind}-${variant}`,
          cfg = path.join(lab, "configs", identity + ".json");
        fs.mkdirSync(path.dirname(cfg), { recursive: true });
        fs.writeFileSync(
          cfg,
          JSON.stringify(
            {
              browser: {
                browserName: "chromium",
                userDataDir: path.join(lab, "profiles", identity),
                launchOptions: {
                  channel: "msedge",
                  headless: true,
                  args: [`--disable-extensions-except=${outputs[variant]}`, `--load-extension=${outputs[variant]}`],
                },
              },
              outputDir: path.join(lab, "playwright"),
            },
            null,
            2,
          ),
        );
        const filename = path.join(lab, "current.snippet");
        fs.writeFileSync(
          filename,
          fs
            .readFileSync(path.join(scripts, "product.snippet"), "utf8")
            .replace(
              "PARAMETERS",
              JSON.stringify({ trial, variant, mode, kind, base, expected: expected[mode + "-" + kind] }),
            ),
        );
        try {
          call(["open", "edge://extensions", "--config", cfg]);
          const row = call(["run-code", `--filename=${filename}`], true);
          assert.equal(row.cases.length, 3);
          for (const c of row.cases) {
            assert.ok(c.complete && !c.timeout, identity + " " + c.name);
            assert.equal(c.outputSha256, c.expectedHash);
          }
          rows.push({ ...row, variant, identity, recordedAt: new Date().toISOString() });
          write("results.json", rows);
          console.log(
            JSON.stringify({
              identity,
              cases: row.cases.map((x) => ({
                name: x.name,
                ms: x.elapsedMs,
                drift: x.maxTimerDriftMs,
                complete: x.complete,
              })),
            }),
          );
        } catch (e) {
          write("failure.json", { identity, message: e.stack ?? String(e), completedSessions: rows.length });
          throw e;
        } finally {
          call(["close"]);
        }
      }
assert.equal(rows.length, 40);
write("completion.json", { sessions: 40, cases: 120, allComplete: true, finishedAt: new Date().toISOString() });
