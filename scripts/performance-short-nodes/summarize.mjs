import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const lab = process.env.SHORT_NODE_LAB;
assert.ok(lab && path.isAbsolute(lab), "Set SHORT_NODE_LAB to the results directory");
const rows = JSON.parse(fs.readFileSync(path.join(lab, "results.json")));
assert.equal(rows.length, 40, "Acceptance requires all40sessions");
assert.equal(new Set(rows.map((x) => x.identity)).size, 40);
const median = (xs) => {
  xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
};
const stat = (xs) => ({ median: median([...xs]), min: Math.min(...xs), max: Math.max(...xs) }),
  groups = {};
for (const r of rows) {
  assert.equal(r.cases.length, 3);
  for (const c of r.cases) {
    assert.ok(c.complete && !c.timeout);
    assert.equal(c.outputSha256, c.expectedHash);
    const k = [r.mode, r.kind, c.name].join("/");
    groups[k] ??= { baseline: [], candidate: [] };
    groups[k][r.variant].push(c);
  }
}
const summary = Object.entries(groups).map(([scenario, variants]) => {
  const stats = {};
  for (const v of ["baseline", "candidate"]) {
    assert.equal(variants[v].length, 5);
    assert.equal(new Set(variants[v].map((x) => x.outputSha256)).size, 1);
    stats[v] = {
      elapsedMs: stat(variants[v].map((x) => x.elapsedMs)),
      maxTimerDriftMs: stat(variants[v].map((x) => x.maxTimerDriftMs)),
    };
  }
  const ratio = stats.candidate.elapsedMs.median / stats.baseline.elapsedMs.median,
    driftIncreaseMs = stats.candidate.maxTimerDriftMs.median - stats.baseline.maxTimerDriftMs.median;
  return {
    scenario,
    gated: !scenario.includes("cold-1000"),
    ...stats,
    completionRatio: ratio,
    completionReductionPercent: (1 - ratio) * 100,
    driftIncreaseMs,
    completionPass: ratio <= 0.5,
    driftPass: driftIncreaseMs <= 10,
  };
});
const gates = summary.filter((x) => x.gated);
assert.equal(gates.length, 8);
const report = {
  sessions: rows.length,
  cases: rows.length * 3,
  trialsPerCellPerVariant: 5,
  edgeVersions: [...new Set(rows.map((x) => x.edgeVersion))],
  allOutputsCompleteAndExact: true,
  allEightCompletionGatesPass: gates.every((x) => x.completionPass),
  allEightDriftGatesPass: gates.every((x) => x.driftPass),
  acceptancePass: gates.every((x) => x.completionPass && x.driftPass),
  summary,
};
fs.writeFileSync(path.join(lab, "summary.json"), JSON.stringify(report, null, 2) + "\n");
let md =
  "# Short-node acceptance measurements\n\nFive sequential alternating trial pairs; uninstrumented clean-built artifacts. Median [min-max], milliseconds. Full output arrays match the frozen baseline engine reference. Cold1000 recorded but not gated. No p95/significance claim.\n\n| Scenario | Baseline completion | Candidate completion | Reduction | Drift change | Gate |\n|---|---:|---:|---:|---:|---|\n";
const fmt = (x) => `${x.median.toFixed(1)} [${x.min.toFixed(1)}-${x.max.toFixed(1)}]`;
for (const r of summary) {
  let gate = "not gated";
  if (r.gated) gate = r.completionPass && r.driftPass ? "PASS" : "FAIL";
  md += `| ${r.scenario} | ${fmt(r.baseline.elapsedMs)} | ${fmt(r.candidate.elapsedMs)} | ${r.completionReductionPercent.toFixed(1)}% | ${r.driftIncreaseMs.toFixed(1)}ms | ${gate} |\n`;
}
md += `\nOverall acceptance: ${report.acceptancePass ? "PASS" : "FAIL"}. Required each of8cells: candidate median completion <=50% ofbaseline; median oftrial maximum timerdrift <=baseline+10ms. SeeREADME.md for workload/method limitations.\n`;
fs.writeFileSync(path.join(lab, "RESULTS.md"), md);
console.log(md);

if (!report.acceptancePass) process.exitCode = 1;
