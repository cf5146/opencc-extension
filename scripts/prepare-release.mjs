#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveReleaseVersion } from "./resolve-release-version.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
function requirePreparationSource(env, git) {
  if (env.GITHUB_REF !== "refs/heads/main") throw new Error("Release preparation must be dispatched from main");
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || "")) throw new Error("GITHUB_REPOSITORY is required");
  if (!/^[1-9]\d*$/.test(env.GITHUB_RUN_ID || "")) throw new Error("GITHUB_RUN_ID is required for release provenance");
  if (!env.GITHUB_SHA || git("rev-parse", "HEAD") !== env.GITHUB_SHA)
    throw new Error("Checkout must match the dispatch GITHUB_SHA commit");
  if (git("status", "--porcelain")) throw new Error("Release preparation requires a clean working tree");
}

export function prepareRelease({
  cwd = process.cwd(),
  env = process.env,
  run = (file, args, options) =>
    execFileSync(file, args, { ...options, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
} = {}) {
  const command = (file, args) => String(run(file, args, { cwd, env: { ...process.env, ...env } })).trim();
  const git = (...args) => command(env.GIT_EXECUTABLE || process.env.GIT_EXECUTABLE || "git", args);
  const gh = (...args) => command("gh", args);
  requirePreparationSource(env, git);
  git("fetch", "origin", "--tags");
  const version = resolveReleaseVersion({
    packageVersion: JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")).version,
    tags: git("tag", "--list").split(/\r?\n/),
    requestedVersion: env.RELEASE_VERSION || "",
  });
  const branch = `codex/release-v${version}`;
  const repository = env.GITHUB_REPOSITORY;
  const server = env.GITHUB_SERVER_URL || "https://github.com";
  const prs = JSON.parse(
    gh("pr", "list", "--repo", repository, "--head", branch, "--state", "all", "--json", "state,url,baseRefName"),
  );
  if (prs.some((pr) => pr.state !== "OPEN"))
    throw new Error(`Release branch ${branch} has a closed or merged PR; choose another version`);
  if (prs.length > 1 || prs.some((pr) => pr.baseRefName !== "main"))
    throw new Error(`Release branch ${branch} has an incompatible PR`);
  const existing = git("ls-remote", "--heads", "origin", `refs/heads/${branch}`);
  if (existing) {
    // Never reset an existing release branch: reviewers may have edited its notes.
    git("fetch", "origin", `refs/heads/${branch}:refs/remotes/origin/${branch}`);
  } else {
    if (prs.length) throw new Error(`Open PR has no remote release branch: ${branch}`);
    git("checkout", "-b", branch, env.GITHUB_SHA);
    command(process.execPath, [path.join(scripts, "bump-version.cjs"), version]);
    command(process.execPath, [path.join(scripts, "generate-changelog.cjs"), version, "--update"]);
    git("add", "--", "package.json", "package-lock.json", "CHANGELOG.md", "CHANGELOG_RELEASE.md");
    git(
      "-c",
      "user.name=github-actions[bot]",
      "-c",
      "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "commit",
      "-m",
      `chore: release v${version}`,
    );
    // A failed push stops this run. A rerun detects any branch that reached the server.
    git("push", "origin", `HEAD:refs/heads/${branch}`);
  }
  let prUrl = prs[0]?.url;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "opencc-release-pr-"));
  try {
    const marker = `<!-- opencc-release-preparation:${env.GITHUB_RUN_ID}:${env.GITHUB_SHA} -->`;
    const body = path.join(temporary, "body.md");
    if (prUrl) {
      // Append bot-owned provenance instead of replacing a description reviewers may be editing.
      fs.writeFileSync(
        body,
        `[準備執行 / Preparation run](${server}/${repository}/actions/runs/${env.GITHUB_RUN_ID})\n\n${marker}\n`,
      );
      gh("pr", "comment", prUrl, "--repo", repository, "--body-file", body);
    } else {
      const notes = existing
        ? git("show", `refs/remotes/origin/${branch}:CHANGELOG_RELEASE.md`)
        : fs.readFileSync(path.join(cwd, "CHANGELOG_RELEASE.md"), "utf8");
      const prose = notes.replace(/^<!-- opencc-release-preparation:.* -->\r?\n?/gm, "").trimEnd();
      fs.writeFileSync(
        body,
        `${prose}\n\n審查版本與說明；合併此 PR 至 main 後會自動發布。\nReview the version and notes; merging this PR into main publishes automatically.\n\n${marker}\n`,
      );
      prUrl = gh(
        "pr",
        "create",
        "--repo",
        repository,
        "--base",
        "main",
        "--head",
        branch,
        "--title",
        `chore: release v${version}`,
        "--body-file",
        body,
      );
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  const prPrefix = `${server}/${repository}/pull/`;
  const prNumber = prUrl.startsWith(prPrefix) ? prUrl.slice(prPrefix.length) : "";
  if (!/^[1-9]\d*$/.test(prNumber) || !Number.isSafeInteger(Number(prNumber)))
    throw new Error("Release PR URL must identify a pull request in this repository");
  gh("workflow", "run", "ci.yml", "--repo", repository, "--ref", branch);
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `version=${version}\npr_number=${prNumber}\n`);
  const ciUrl = `${server}/${repository}/actions/workflows/ci.yml?query=branch%3A${encodeURIComponent(branch)}`;
  if (env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `Prepared v${version}: [Review PR](${prUrl})\n\n[Dispatched CI](${ciUrl})\n`,
    );
  console.log(`Release PR: ${prUrl}\nCI: ${ciUrl}`);
  return { version, branch, prUrl, ciUrl };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) prepareRelease();
