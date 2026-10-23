import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const verifier = path.resolve("scripts/verify-official-assets.mjs");
describe("official asset verification CLI", () => {
  it.each(["../outside", "--help", "CHROME"])("rejects an unknown build target %s before reading files", (target) => {
    const result = spawnSync(process.execPath, [verifier, target], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unknown build target; use chrome, firefox or edge");
  });
  it("verifies the bundled source assets with no target", () => {
    const result = spawnSync(process.execPath, [verifier], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("32 bundled engine/resource hashes verified");
  });
});
