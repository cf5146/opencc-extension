// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = "a".repeat(40);
const merge = "b".repeat(40);
function fixture() {
  const pr = {
    number: 7,
    merged: true,
    merge_commit_sha: merge,
    base: { ref: "main", repo: { full_name: "owner/repo" } },
    head: { ref: "codex/release-v1.2.3", repo: { full_name: "owner/repo" } },
    user: { login: "github-actions[bot]", id: 41898282 },
    body: `Reviewed notes\n<!-- opencc-release-preparation:123:${source} -->\n`,
  };
  const run = {
    id: 123,
    path: ".github/workflows/prepare-release.yml",
    event: "workflow_dispatch",
    head_branch: "main",
    head_sha: source,
    conclusion: "success",
    repository: { full_name: "owner/repo" },
  };
  const outputs = {};
  const jobs = [{ name: "Prepared release PR #7 v1.2.3", conclusion: "success" }];
  const comments = [];
  const runs = new Map([[123, run]]);
  return {
    pr,
    run,
    outputs,
    jobs,
    comments,
    runs,
    async execute() {
      const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
      const match = workflow.match(/\/\/ BEGIN ELIGIBILITY\r?\n([\s\S]*?)\s*\/\/ END ELIGIBILITY/);
      expect(match, "Release must validate eligibility before building").not.toBeNull();
      const script = match[1].replace(/^            /gm, "");
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const github = {
        async paginate(method, args) {
          const { data } = await method(args);
          return Array.isArray(data) ? data : data.jobs;
        },
        rest: {
          issues: {
            async listComments({ issue_number }) {
              expect(issue_number).toBe(pr.number);
              return { data: comments };
            },
          },
          actions: {
            async getWorkflowRun({ run_id }) {
              if (!runs.has(run_id)) throw Object.assign(new Error("Run not found"), { status: 404 });
              return { data: runs.get(run_id) };
            },
            async listJobsForWorkflowRun({ run_id, filter }) {
              expect(run_id).toBe(123);
              expect(filter).toBe("latest");
              return { data: { jobs } };
            },
          },
        },
      };
      await new AsyncFunction("github", "context", "core", script)(
        github,
        { repo: { owner: "owner", repo: "repo" }, payload: { pull_request: pr } },
        { setOutput: (name, value) => (outputs[name] = value) },
      );
    },
  };
}

it("selects the exact release merge commit after verifying preparation provenance", async () => {
  const f = fixture();
  await f.execute();
  expect(f.outputs).toEqual({ source_sha: merge, version: "1.2.3" });
});

it("accepts refreshed bot-comment provenance without changing the PR description", async () => {
  const f = fixture();
  f.comments.push({ user: { ...f.pr.user }, body: f.pr.body });
  f.pr.body = "Human-reviewed description with stale or removed provenance";
  await f.execute();
  expect(f.outputs).toEqual({ source_sha: merge, version: "1.2.3" });
});

it("ignores a newer failed preparation comment and retains valid provenance", async () => {
  const f = fixture();
  f.comments.push({ user: { ...f.pr.user }, body: f.pr.body.replace(":123:", ":124:") });
  f.runs.set(124, { ...f.run, conclusion: "failure" });
  await f.execute();
  expect(f.outputs).toEqual({ source_sha: merge, version: "1.2.3" });
});

it("rejects a human comment containing a copied provenance marker", async () => {
  const f = fixture();
  f.comments.push({ user: { login: "maintainer", id: 42 }, body: f.pr.body });
  f.pr.body = "No preparation marker";
  await expect(f.execute()).rejects.toThrow();
  expect(f.outputs).toEqual({});
});

it("rejects bot-comment provenance copied to another PR", async () => {
  const f = fixture();
  f.comments.push({ user: { ...f.pr.user }, body: f.pr.body });
  f.pr.body = "No preparation marker";
  f.pr.number = 8;
  await expect(f.execute()).rejects.toThrow();
  expect(f.outputs).toEqual({});
});

it.each([
  ["unmerged PR", (f) => (f.pr.merged = false)],
  ["fork PR", (f) => (f.pr.head.repo.full_name = "fork/repo")],
  ["different base", (f) => (f.pr.base.ref = "dev")],
  ["ordinary branch", (f) => (f.pr.head.ref = "feature")],
  ["leading-zero version", (f) => (f.pr.head.ref = "codex/release-v01.2.3")],
  ["out-of-range version", (f) => (f.pr.head.ref = "codex/release-v65536.2.3")],
  ["zero version", (f) => (f.pr.head.ref = "codex/release-v0.0.0")],
  ["human-authored PR", (f) => (f.pr.user = { login: "maintainer", id: 42 })],
  ["spoofed bot login", (f) => (f.pr.user.id = 42)],
  ["missing merge SHA", (f) => (f.pr.merge_commit_sha = null)],
  ["missing provenance", (f) => (f.pr.body = "Review notes")],
  ["ambiguous provenance", (f) => (f.pr.body += f.pr.body)],
  ["wrong workflow", (f) => (f.run.path = ".github/workflows/ci.yml")],
  ["wrong workflow event", (f) => (f.run.event = "push")],
  ["wrong preparation branch", (f) => (f.run.head_branch = "dev")],
  ["failed preparation", (f) => (f.run.conclusion = "failure")],
  ["preparation commit mismatch", (f) => (f.run.head_sha = "c".repeat(40))],
  ["preparation repository mismatch", (f) => (f.run.repository.full_name = "other/repo")],
  ["marker copied to a different PR", (f) => (f.pr.number = 8)],
  ["marker copied to a different version", (f) => (f.pr.head.ref = "codex/release-v9.9.9")],
  ["missing preparation receipt", (f) => f.jobs.splice(0)],
  ["failed preparation receipt", (f) => (f.jobs[0].conclusion = "failure")],
])("rejects %s before producing release outputs", async (_name, change) => {
  const f = fixture();
  change(f);
  await expect(f.execute()).rejects.toThrow();
  expect(f.outputs).toEqual({});
});
