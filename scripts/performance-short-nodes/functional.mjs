import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const scripts = path.dirname(fileURLToPath(import.meta.url)),
  lab = process.env.SHORT_NODE_LAB,
  cli = process.env.PLAYWRIGHT_CLI;
assert.ok(lab && path.isAbsolute(lab), "Set SHORT_NODE_LAB to the acceptance results directory");
assert.ok(cli && path.isAbsolute(cli), "Set PLAYWRIGHT_CLI to the installed CLI JavaScript entrypoint");
assert.ok(fs.existsSync(path.join(lab, "completion.json")), "Complete timing first");
assert.ok(!fs.existsSync(path.join(lab, "functional.json")), "Preserve prior functional evidence before rerun");
const output = path.join(lab, "artifacts/candidate"),
  cfg = path.join(lab, "functional-config.json");
fs.writeFileSync(
  cfg,
  JSON.stringify(
    {
      browser: {
        browserName: "chromium",
        userDataDir: path.join(lab, "functional-profile"),
        launchOptions: {
          channel: "msedge",
          headless: true,
          args: [`--disable-extensions-except=${output}`, `--load-extension=${output}`],
        },
      },
      outputDir: path.join(lab, "functional-playwright"),
    },
    null,
    2,
  ),
);
function call(args, json = false) {
  const r = spawnSync(process.execPath, [cli, "-s=short-node-functional", ...(json ? ["--json"] : []), ...args], {
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
}
try {
  call(["open", "edge://extensions", "--config", cfg]);
  const result = call(["run-code", `--filename=${path.join(scripts, "functional.snippet")}`], true);
  result.recordedAt = new Date().toISOString();
  result.candidateSHA = JSON.parse(fs.readFileSync(path.join(lab, "provenance.json"))).candidateCheckoutHEAD;
  fs.writeFileSync(path.join(lab, "functional.json"), JSON.stringify(result, null, 2) + "\n");
  let md =
    "# Separate Edge operational validation\n\nHeadless automated real-browser interaction with the frozen candidate; no product/source instrumentation. These checks run after all timing sessions and do not enter performance medians. No human/manual, IME, actual toolbar-popup lifecycle, Firefox runtime, or subjective latency claim.\n\n";
  for (const t of result.tests)
    md += `- ${t.pass ? "PASS" : "FAIL"}: ${t.name}${t.limitation ? " — " + t.limitation : ""}\n`;
  md +=
    "\nExact observations/responses are retained in functional.json. An unresolved-request check is required before claiming typing/editing overlapped conversion.\n";
  fs.writeFileSync(path.join(lab, "FUNCTIONAL.md"), md);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  fs.writeFileSync(path.join(lab, "functional-error.json"), JSON.stringify({ error: e.stack ?? String(e) }, null, 2));
  throw e;
} finally {
  call(["close"]);
}
