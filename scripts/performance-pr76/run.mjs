import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { createZip } from "@aklinker1/zero-zip";
import assert from "node:assert/strict";
const scripts = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(scripts, "../..");
const lab = process.env.PERF_LAB,
  cli = process.env.PLAYWRIGHT_CLI;
assert.ok(lab && path.isAbsolute(lab), "Set PERF_LAB to an absolute dedicated benchmark directory");
assert.ok(cli && path.isAbsolute(cli), "Set PLAYWRIGHT_CLI to the installed CLI JavaScript entrypoint");
const baseline = path.join(lab, "baseline"),
  headOutput = path.join(root, ".output/edge-mv3"),
  baseOutput = path.join(baseline, ".output/edge-mv3");
for (const p of [baseOutput, headOutput])
  assert.ok(fs.existsSync(path.join(p, "manifest.json")), "Build both Edge targets first: " + p);
const hash = (x) => createHash("sha256").update(x).digest("hex");
const extension = path.join(lab, "engine-probe");
fs.mkdirSync(extension, { recursive: true });
fs.cpSync(path.join(root, "public/opencc/engine"), path.join(extension, "engine"), { recursive: true });
await build({
  entryPoints: [path.join(baseline, "src/lib/opencc/index.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
  outfile: path.join(extension, "legacy.mjs"),
});
fs.writeFileSync(
  path.join(extension, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "PR76 performance probe",
    version: "1.0.0",
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
  }),
);
fs.writeFileSync(
  path.join(extension, "index.html"),
  '<!doctype html><html><meta charset="utf-8"><title>PR76 performance probe</title><body>Performance probe</body></html>',
);
fs.writeFileSync(
  path.join(extension, "bench-worker.mjs"),
  `
let retainedSession, convert;
const sha = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2,'0')).join('');
self.onmessage = async ({data}) => { try {
 const start = performance.now();
 if (data.variant === 'legacy') { const m = await import('./legacy.mjs'); convert = m.Converter({from:'cn',to:'twp'}); }
 else { const m = await import('./engine/runtime.mjs'); retainedSession = await m.loadOpenCC(); const config = data.variant === 'jieba' ? 's2twp_jieba' : 's2twp'; convert = text => retainedSession.convert(config,text); }
 const initMs = performance.now()-start, firstStart = performance.now(), firstOutput = convert('勇敢的士兵汉字😀'), firstMs = performance.now()-firstStart;
 const firstWasmLinearBytes = retainedSession?.memoryBytes ?? null;
 self.postMessage({phase:"cold"});
 const rows = [];
 for(const size of [100,10000,100000,1000000]) {
  const pattern='勇敢的士兵在软件开发中心使用鼠标。 OpenCC ', text=pattern.repeat(Math.ceil(size/pattern.length)).slice(0,size);
  convert(text); const times=[]; let output;
  for(let i=0;i<5;i++){const t=performance.now();output=convert(text);times.push(performance.now()-t);}
  rows.push({size,timesMs:times,outputLength:output.length,outputSha256:await sha(output)});
 }
 self.postMessage({variant:data.variant,initMs,firstMs,firstOutput,firstWasmLinearBytes,wasmLinearBytes:retainedSession?.memoryBytes ?? null,rows});
 } catch(e){self.postMessage({error:e.stack ?? e.message});} };
`,
);
const call = (args, json = false) => {
  const r = spawnSync(process.execPath, [cli, "-s=pr76-perf", ...(json ? ["--json"] : []), ...args], {
    cwd: lab,
    encoding: "utf8",
    timeout: 300000,
    maxBuffer: 12 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(r.stdout + r.stderr);
  if (!json) return r.stdout;
  const parsed = JSON.parse(r.stdout);
  if (parsed.isError || parsed.error) throw new Error(r.stdout);
  return typeof parsed.result === "string" ? JSON.parse(parsed.result) : parsed.result;
};
const config = (name, load) => {
  const p = path.join(lab, name + ".json");
  fs.writeFileSync(
    p,
    JSON.stringify(
      {
        browser: {
          browserName: "chromium",
          userDataDir: path.join(lab, "profiles", name),
          launchOptions: {
            channel: "msedge",
            headless: true,
            args: ["--enable-precise-memory-info", `--disable-extensions-except=${load}`, `--load-extension=${load}`],
          },
        },
        outputDir: path.join(lab, "playwright"),
      },
      null,
      2,
    ),
  );
  return p;
};
const write = (name, value) => fs.writeFileSync(path.join(lab, name), JSON.stringify(value, null, 2) + "\n");
const environment = {
  cpu: os.cpus()[0].model,
  logicalCPUs: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
  os: os.type() + " " + os.release(),
  node: process.version,
  measuredAt: new Date().toISOString(),
  baseline: "d0ac03266941667e94d0cdaf61eb2ea1fbc4547c",
  head: "9ba9550c2743dba84b623fb01e74f1e85eb2689a",
  manifestSha256: hash(fs.readFileSync(path.join(headOutput, "opencc/engine/engine-resources.json"))),
};
write("environment.json", environment);
let engines;
try {
  call(["open", "edge://extensions", "--config", config("engines", extension)]);
  const list = call(
    [
      "run-code",
      "async(page)=>await page.evaluate(()=>new Promise(resolve=>chrome.developerPrivate.getExtensionsInfo({includeDisabled:true},resolve)))",
    ],
    true,
  );
  const ext = list.find((x) => x.name === "PR76 performance probe" && x.state === "ENABLED");
  assert.ok(ext, "probe extension loaded");
  call(["goto", `chrome-extension://${ext.id}/index.html`]);
  engines = call(["run-code", `--filename=${path.join(scripts, "engine.snippet")}`], true);
  write("engine.json", engines);
  console.log("Engine trials completed");
} finally {
  call(["close"]);
}
if (process.env.PERF_ENGINE_ONLY === "1") process.exit(0);
const products = [];
for (let trial = 0; trial < 5; trial++) {
  const variants = trial % 2 ? ["jieba", "mmseg", "legacy"] : ["legacy", "mmseg", "jieba"];
  for (const variant of variants) {
    const snippet = fs
      .readFileSync(path.join(scripts, "product.snippet"), "utf8")
      .replace("VARIANT", JSON.stringify(variant))
      .replace("TRIAL", String(trial));
    const filename = path.join(lab, "product-current.snippet");
    fs.writeFileSync(filename, snippet);
    try {
      call([
        "open",
        "edge://extensions",
        "--config",
        config(`product-${trial}-${variant}`, variant === "legacy" ? baseOutput : headOutput),
      ]);
      const r = call(["run-code", `--filename=${filename}`], true);
      products.push(r);
      write("product.json", products);
      console.log(`Product trial ${trial + 1}/5 ${variant} completed`);
    } finally {
      call(["close"]);
    }
  }
}
async function packageSize(dir) {
  const zip = createZip();
  let bytes = 0,
    files = 0;
  const visit = (relative = "") => {
    for (const item of fs
      .readdirSync(path.join(dir, relative), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) visit(name);
      else {
        const b = fs.readFileSync(path.join(dir, name));
        bytes += b.length;
        files++;
        zip.addFile(name, b);
      }
    }
  };
  visit();
  const zipped = await zip.toBuffer();
  return { files, unpackedBytes: bytes, zipBytes: zipped.length, zipSha256: hash(zipped) };
}
write("packages.json", { baseline: await packageSize(baseOutput), head: await packageSize(headOutput) });
console.log("All benchmarks completed");
