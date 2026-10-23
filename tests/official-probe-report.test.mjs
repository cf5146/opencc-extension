import { it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
it("the browser probe supplies fresh startup measurements to the report generator", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "opencc-probe-report-"));
  try {
    const source = path.resolve("scripts/opencc-feasibility");
    for (const dir of ["dist", "probe", "output", "fixtures"]) fs.mkdirSync(path.join(temp, dir));
    for (const file of ["edge-test.mjs", "build-results.mjs"])
      fs.copyFileSync(path.join(source, file), path.join(temp, file));
    fs.copyFileSync(path.join(source, "output/node.json"), path.join(temp, "output/node.json"));
    fs.copyFileSync(path.join(source, "output/edge.json"), path.join(temp, "fixtures/edge.json"));
    const startup = JSON.parse(fs.readFileSync(path.join(source, "output/edge-startup.json"), "utf8"));
    for (const row of startup) row.first.ms = 424242;
    fs.writeFileSync(path.join(temp, "fixtures/startup.json"), JSON.stringify(startup));
    const cli = path.join(temp, "fake-cli.mjs");
    fs.writeFileSync(
      cli,
      `import fs from 'node:fs'; const args=process.argv.slice(2); if(args.includes('--json')) { const name=args.find(x=>x.startsWith('--filename=')); const result=name ? JSON.parse(fs.readFileSync(name.includes('startup')?'fixtures/startup.json':'fixtures/edge.json','utf8')) : [{name:'Official OpenCC source feasibility probe',state:'ENABLED',id:'probe'}]; console.log(JSON.stringify({result})); }`,
    );
    const run = (file) =>
      spawnSync(process.execPath, [path.join(temp, file)], {
        cwd: temp,
        env: { ...process.env, PLAYWRIGHT_CLI: cli },
        encoding: "utf8",
        windowsHide: true,
        timeout: 20000,
      });
    const probe = run("edge-test.mjs");
    expect(probe.status, probe.stderr).toBe(0);
    const report = run("build-results.mjs");
    expect(report.status, report.stderr).toBe(0);
    expect(fs.readFileSync(path.join(temp, "RESULTS.md"), "utf8")).toContain("424242");
  } finally {
    expect(path.dirname(path.resolve(temp))).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(temp).startsWith("opencc-probe-report-")).toBe(true);
    fs.rmSync(temp, { recursive: true, force: true });
  }
}, 30000);
