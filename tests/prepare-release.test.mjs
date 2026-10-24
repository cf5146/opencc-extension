// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it as vitestIt } from "vitest";

const it = (name, fn) => vitestIt(name, fn, 60000);
const roots = [];
const gitExe = process.env.GIT_EXECUTABLE || "git";
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencc-prepare-"));
  roots.push(root);
  const cwd = path.join(root, "work");
  const remote = path.join(root, "remote.git");
  const git = (...args) =>
    execFileSync(gitExe, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  fs.mkdirSync(cwd);
  execFileSync(gitExe, ["init", "--bare", remote], { stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "pack.threads", "1");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  fs.writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({ version: "1.0.0", repository: "github:stale/repo" }),
  );
  fs.writeFileSync(
    path.join(cwd, "package-lock.json"),
    JSON.stringify({ version: "1.0.0", packages: { "": { version: "1.0.0" } } }),
  );
  git("add", ".");
  git("commit", "-m", "feat: real feature (#42)");
  git("tag", "v1.0.0");
  git("commit", "--allow-empty", "-m", "fix: subsequent change (#43)");
  git("remote", "add", "origin", remote);
  git("push", "origin", "main", "--tags");
  return {
    cwd,
    git,
    env: {
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: git("rev-parse", "HEAD"),
      GITHUB_REPOSITORY: "actual/project",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_RUN_ID: "123",
    },
  };
}
function githubRunner(calls, { prs = [] } = {}) {
  return (file, args, options) => {
    if (file !== "gh")
      return execFileSync(file, args, { ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    calls.push(args);
    if (args[0] === "pr" && args[1] === "list") return JSON.stringify(prs);
    if (args[0] === "pr" && args[1] === "create") {
      calls.createdBody = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
      return "https://github.com/actual/project/pull/7";
    }
    if (args[0] === "pr" && args[1] === "edit") {
      calls.editedBody = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
      prs[0].body = calls.editedBody;
      return "";
    }
    if (args[0] === "pr" && args[1] === "comment") {
      calls.provenanceBody = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
      return "";
    }
    if (args[0] === "workflow") return "";
    throw new Error(`Unexpected gh call: ${args.join(" ")}`);
  };
}
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
it("prepares a separate release branch, root versions and changelog, PR and explicit CI", async () => {
  const { prepareRelease } = await import("../scripts/prepare-release.mjs");
  const f = fixture();
  const calls = [];
  const notes = "Keep $(touch forbidden) and `literal` text";
  const output = path.join(f.cwd, "github-output");
  const result = prepareRelease({
    ...f,
    env: { ...f.env, RELEASE_NOTES: notes, GITHUB_OUTPUT: output },
    run: githubRunner(calls),
  });
  expect(result.version).toBe("1.0.1");
  expect(JSON.parse(fs.readFileSync(path.join(f.cwd, "package.json"))).version).toBe("1.0.1");
  expect(f.git("show", "origin/main:package.json")).toContain('"1.0.0"');
  const lock = JSON.parse(fs.readFileSync(path.join(f.cwd, "package-lock.json")));
  expect(lock.version).toBe("1.0.1");
  expect(lock.packages[""].version).toBe("1.0.1");
  expect(f.git("ls-remote", "--heads", "origin", "codex/release-v1.0.1")).toContain("refs/heads/codex/release-v1.0.1");
  const changelog = fs.readFileSync(path.join(f.cwd, "CHANGELOG.md"), "utf8");
  expect(changelog).toContain("https://github.com/actual/project/compare/v1.0.0...v1.0.1");
  expect(changelog).toContain("https://github.com/actual/project/pull/43");
  expect(changelog).toContain(notes);
  expect(calls.createdBody).toContain(notes);
  expect(calls.createdBody).toContain(`<!-- opencc-release-preparation:123:${f.env.GITHUB_SHA} -->`);
  expect(fs.readFileSync(output, "utf8")).toBe("version=1.0.1\npr_number=7\n");
  expect(calls.find((a) => a[0] === "pr" && a[1] === "create")).toEqual(
    expect.arrayContaining(["--base", "main", "--head", "codex/release-v1.0.1"]),
  );
  expect(calls.find((a) => a[0] === "pr" && a[1] === "create")).toContain("--body-file");
  expect(calls).toContainEqual([
    "workflow",
    "run",
    "ci.yml",
    "--repo",
    "actual/project",
    "--ref",
    "codex/release-v1.0.1",
  ]);
});
it("reuses a branch and open PR without overwriting manual edits or advancing it to main", async () => {
  const { prepareRelease } = await import("../scripts/prepare-release.mjs");
  const f = fixture();
  const branch = "codex/release-v1.0.1";
  f.git("checkout", "-b", branch);
  fs.writeFileSync(path.join(f.cwd, "CHANGELOG.md"), "Human notes\n");
  f.git("add", ".");
  f.git("commit", "-m", "human edits");
  f.git("push", "origin", branch);
  const branchSha = f.git("rev-parse", "HEAD");
  f.git("checkout", "main");
  f.git("commit", "--allow-empty", "-m", "new main work");
  f.env.GITHUB_SHA = f.git("rev-parse", "HEAD");
  const calls = [];
  const prs = [
    {
      state: "OPEN",
      url: "https://github.com/actual/project/pull/7",
      baseRefName: "main",
      body: `Human-reviewed notes\n<!-- opencc-release-preparation:122:${f.env.GITHUB_SHA} -->\n`,
    },
  ];
  const baseRun = githubRunner(calls, { prs });
  const editedBody = "New reviewer notes added during fetch\n";
  const result = prepareRelease({
    ...f,
    run(file, args, options) {
      const result = baseRun(file, args, options);
      if (file !== "gh" && args[0] === "fetch" && args.some((arg) => arg.includes("refs/remotes/origin/")))
        prs[0].body = editedBody;
      return result;
    },
  });
  expect(result.prUrl).toContain("/pull/7");
  expect(f.git("rev-parse", `origin/${branch}`)).toBe(branchSha);
  expect(f.git("show", `origin/${branch}:CHANGELOG.md`)).toBe("Human notes");
  expect(calls.filter((a) => a[0] === "pr" && a[1] === "create")).toHaveLength(0);
  expect(prs[0].body).toBe(editedBody);
  expect(calls.editedBody).toBeUndefined();
  expect(calls.provenanceBody).toContain(`<!-- opencc-release-preparation:123:${f.env.GITHUB_SHA} -->`);
});
it("rejects a closed PR collision before changing the branch", async () => {
  const { prepareRelease } = await import("../scripts/prepare-release.mjs");
  const f = fixture();
  const calls = [];
  expect(() =>
    prepareRelease({
      ...f,
      run: githubRunner(calls, {
        prs: [{ state: "CLOSED", url: "https://github.com/actual/project/pull/7", baseRefName: "main" }],
      }),
    }),
  ).toThrow(/closed|merged/i);
  expect(f.git("branch", "--show-current")).toBe("main");
});
it("rejects non-main dispatches and mismatched checked-out commits before commands", async () => {
  const { prepareRelease } = await import("../scripts/prepare-release.mjs");
  expect(() =>
    prepareRelease({
      env: { GITHUB_REF: "refs/heads/feature" },
      run: () => {
        throw new Error("command ran");
      },
    }),
  ).toThrow(/main/);
  const f = fixture();
  expect(() =>
    prepareRelease({
      ...f,
      env: { ...f.env, GITHUB_SHA: "0000000000000000000000000000000000000000" },
      run: githubRunner([]),
    }),
  ).toThrow(/SHA|commit/);
});

it("recovers after a push reaches the remote but the client reports failure", async () => {
  const { prepareRelease } = await import("../scripts/prepare-release.mjs");
  const f = fixture();
  const calls = [];
  const baseRun = githubRunner(calls);
  const interrupted = (file, args, options) => {
    const result = baseRun(file, args, options);
    if (file !== "gh" && args[0] === "push") throw new Error("simulated disconnect after push");
    return result;
  };
  expect(() => prepareRelease({ ...f, run: interrupted })).toThrow("simulated disconnect");
  const sha = f.git("rev-parse", "HEAD");
  f.git("checkout", "main");
  const result = prepareRelease({ ...f, run: baseRun });
  expect(result.prUrl).toContain("/pull/7");
  expect(f.git("rev-parse", "origin/codex/release-v1.0.1")).toBe(sha);
  expect(calls.filter((a) => a[0] === "pr" && a[1] === "create")).toHaveLength(1);
});
