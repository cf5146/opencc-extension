import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { artifactFixture } from "./helpers/artifact-fixture.mjs";

const gitExecutable =
  process.platform === "win32"
    ? execFileSync(path.join(process.env.SystemRoot, "System32", "where.exe"), ["git"], { encoding: "utf8" })
        .trim()
        .split(/\r?\n/)[0]
    : "/usr/bin/git";

async function fixture() {
  const root = await artifactFixture();
  await fs.writeFile(
    path.join(root, "package-lock.json"),
    JSON.stringify({ version: "1.2.3", packages: { "": { version: "1.2.3" } } }),
  );
  await fs.writeFile(path.join(root, "CHANGELOG_RELEASE.md"), "## v1.2.3 - 2026-10-17\n\nRelease notes.\n");
  execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["add", "package.json", "package-lock.json", "CHANGELOG_RELEASE.md"], {
    cwd: root,
    stdio: "pipe",
  });
  execFileSync(
    "git",
    [
      "-c",
      "maintenance.auto=false",
      "-c",
      "gc.auto=0",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.org",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
      "--quiet",
    ],
    { cwd: root, stdio: "pipe" },
  );
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const { packageBuilt } = await import("../scripts/package-built.mjs");
  await packageBuilt(root);
  return { root, commit };
}

describe("release artifact staging", () => {
  it.each(["", "1.2.3"])("stages verified artifacts with optional expected version '%s'", async (expectedVersion) => {
    const { root, commit } = await fixture();
    try {
      const output = path.join(root, "github-output");
      const { releaseArtifacts } = await import("../scripts/release-artifacts.mjs");
      await releaseArtifacts(root, {
        GIT_EXECUTABLE: gitExecutable,
        GITHUB_SHA: commit,
        EXPECTED_VERSION: expectedVersion,
        GITHUB_OUTPUT: output,
      });
      const metadata = JSON.parse(
        await fs.readFile(path.join(root, ".output/release-artifacts/release-metadata.json"), "utf8"),
      );
      expect(metadata.version).toBe("1.2.3");
      expect(metadata.commit).toBe(commit);
      expect(Object.keys(metadata.sha256)).toEqual([
        "opencc.chrome.zip",
        "opencc.firefox.zip",
        "opencc.edge.zip",
        "CHANGELOG_RELEASE.md",
      ]);
      for (const [name, hash] of Object.entries(metadata.sha256)) {
        const bytes = await fs.readFile(path.join(root, ".output/release-artifacts", name));
        expect(hash).toBe(createHash("sha256").update(bytes).digest("hex"));
      }
      expect(await fs.readFile(output, "utf8")).toBe("version=1.2.3\n");
      expect((await fs.readdir(path.join(root, ".output/release-artifacts"))).length).toBe(6);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it.each(["expected version", "lock version", "notes", "checksum", "commit", "invalid commit", "source drift"])(
    "rejects incorrect %s",
    async (failure) => {
      const { root, commit } = await fixture();
      try {
        const env = { GIT_EXECUTABLE: gitExecutable, GITHUB_SHA: commit };
        if (failure === "expected version") env.EXPECTED_VERSION = "1.2.4";
        if (failure === "lock version")
          await fs.writeFile(
            path.join(root, "package-lock.json"),
            JSON.stringify({ version: "1.2.4", packages: { "": { version: "1.2.3" } } }),
          );
        if (failure === "notes")
          await fs.writeFile(path.join(root, "CHANGELOG_RELEASE.md"), "## v1.2.30 - 2026-10-17\nWrong release\n");
        if (failure === "checksum") await fs.appendFile(path.join(root, ".output/opencc.chrome.zip"), "tampered");
        if (failure === "commit") env.GITHUB_SHA = "0".repeat(40);
        if (failure === "invalid commit") env.GITHUB_SHA = "HEAD";
        if (failure === "source drift") await fs.appendFile(path.join(root, "package.json"), "\n");
        const { releaseArtifacts } = await import("../scripts/release-artifacts.mjs");
        const expectedError = {
          "expected version": /Expected version/,
          "lock version": /Package lock version/,
          notes: /Release notes/,
          checksum: /Checksum mismatch/,
          commit: /GITHUB_SHA does not match HEAD/,
          "invalid commit": /GITHUB_SHA must be/,
          "source drift": /Command failed: .*git(?:\.exe)? diff/,
        }[failure];
        await expect(releaseArtifacts(root, env)).rejects.toThrow(expectedError);
        await expect(fs.stat(path.join(root, ".output/release-artifacts"))).rejects.toThrow();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );
});

it.each([undefined, "git", "./git"])("rejects Git executables resolved from PATH: %s", async (executable) => {
  const { root, commit } = await fixture();
  try {
    const { releaseArtifacts } = await import("../scripts/release-artifacts.mjs");
    await expect(releaseArtifacts(root, { GITHUB_SHA: commit, GIT_EXECUTABLE: executable })).rejects.toThrow(
      /GIT_EXECUTABLE must be an absolute path/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
