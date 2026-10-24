import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const checks = [
  "disable-auto-during-cold-Jieba",
  "edit-text-during-pending-manual",
  "selection-element-identity",
  "page-editable-keyboard-while-conversion-pending",
  "popup-keyboard-while-page-request-pending",
  "settings-change-invalidates-pending-Jieba-output",
];
function functional(result) {
  const lab = fs.mkdtempSync(path.join(os.tmpdir(), "opencc-functional-cli-"));
  try {
    fs.writeFileSync(path.join(lab, "completion.json"), "{}");
    fs.writeFileSync(path.join(lab, "provenance.json"), JSON.stringify({ candidateCheckoutHEAD: "fixture" }));
    const cli = path.join(lab, "stub.cjs");
    fs.writeFileSync(
      cli,
      `const fs=require('node:fs');fs.appendFileSync(process.env.STUB_CALLS,JSON.stringify(process.argv)+'\\n');if(process.argv.includes('run-code'))process.stdout.write(JSON.stringify({result:JSON.parse(process.env.STUB_RESULT)}));`,
    );
    const run = spawnSync(process.execPath, [path.resolve("scripts/performance-short-nodes/functional.mjs")], {
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        SHORT_NODE_LAB: lab,
        PLAYWRIGHT_CLI: cli,
        STUB_RESULT: JSON.stringify(result),
        STUB_CALLS: path.join(lab, "calls"),
      },
    });
    return {
      ...run,
      evidence: JSON.parse(fs.readFileSync(path.join(lab, "functional.json"))),
      report: fs.readFileSync(path.join(lab, "FUNCTIONAL.md"), "utf8"),
      calls: fs.readFileSync(path.join(lab, "calls"), "utf8"),
    };
  } finally {
    expect(path.dirname(path.resolve(lab))).toBe(path.resolve(os.tmpdir()));
    fs.rmSync(lab, { recursive: true, force: true });
  }
}
describe("operational acceptance CLI", () => {
  it("succeeds only when all six named browser checks pass", () => {
    const result = functional({ tests: checks.map((name) => ({ name, pass: true })), allPass: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.evidence.allPass).toBe(true);
    expect(result.calls).toContain('"close"');
  });
  it.each([false, true])(
    "fails a browser check even when allPass is %s, preserving evidence and closing Edge",
    (allPass) => {
      const result = functional({ tests: checks.map((name, i) => ({ name, pass: i !== 2 })), allPass });
      expect(result.status).not.toBe(0);
      expect(result.evidence.tests[2].pass).toBe(false);
      expect(result.report).toContain("FAIL: selection-element-identity");
      expect(result.calls).toContain('"close"');
    },
  );
  it.each(["missing", "duplicate", "renamed"])("rejects %s checks despite an allPass flag", (kind) => {
    const tests = checks.map((name) => ({ name, pass: true }));
    if (kind === "missing") tests.pop();
    else tests[5].name = kind === "duplicate" ? tests[0].name : "unexpected-check";
    expect(functional({ tests, allPass: true }).status).not.toBe(0);
  });
});
describe("benchmark executable selection", () => {
  it.each([undefined, "git", "./git"])("rejects an unpinned Git executable %s before reading builds", (executable) => {
    const lab = fs.mkdtempSync(path.join(os.tmpdir(), "opencc-git-cli-"));
    try {
      const env = {
        ...process.env,
        SHORT_NODE_LAB: lab,
        PLAYWRIGHT_CLI: process.execPath,
        SHORT_NODE_BASELINE_SHA: "a".repeat(40),
      };
      if (executable === undefined) delete env.GIT_EXECUTABLE;
      else env.GIT_EXECUTABLE = executable;
      const result = spawnSync(process.execPath, [path.resolve("scripts/performance-short-nodes/run.mjs")], {
        env,
        encoding: "utf8",
        windowsHide: true,
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("GIT_EXECUTABLE must be an absolute path");
    } finally {
      expect(path.dirname(path.resolve(lab))).toBe(path.resolve(os.tmpdir()));
      fs.rmSync(lab, { recursive: true, force: true });
    }
  });
});
