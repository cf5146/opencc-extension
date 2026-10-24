// @vitest-environment node
import assert from "node:assert/strict";
import { test, afterEach } from "vitest";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const sha = "a".repeat(40);
const names = ["opencc.chrome.zip", "opencc.firefox.zip", "opencc.edge.zip"];
const hash = (data) => createHash("sha256").update(data).digest("hex");
const missing = () => Object.assign(new Error("Not found"), { status: 404 });

const temporaryDirectories = [];
afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture({ version = "1.2.3", latest = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "opencc-publication-"));
  temporaryDirectories.push(dir);
  const notes = `## v${version} - 2026-10-18\n\nReviewed release notes.\n`;
  const files = Object.fromEntries(names.map((name) => [name, Buffer.from(name)]));
  files["CHANGELOG_RELEASE.md"] = Buffer.from(notes);
  const hashes = Object.fromEntries(Object.entries(files).map(([name, data]) => [name, hash(data)]));
  files.SHA256SUMS = Buffer.from(names.map((name) => `${hashes[name]}  ${name}\n`).join(""));
  files["release-metadata.json"] = Buffer.from(JSON.stringify({ version, commit: sha, sha256: hashes }));
  for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), data);
  const state = {
    tag: null,
    release: null,
    additionalReleases: [],
    assets: [],
    nextId: 1,
    createdReleases: 0,
    writes: 0,
    failUpload: false,
    annotated: {},
  };
  const github = {
    rest: {
      git: {
        async getRef({ ref }) {
          assert.equal(ref, `tags/v${version}`);
          if (!state.tag) throw missing();
          return { data: { object: state.tag } };
        },
        async getTag({ tag_sha }) {
          return { data: { object: state.annotated[tag_sha] } };
        },
        async createRef({ ref, sha: commit }) {
          assert.equal(ref, `refs/tags/v${version}`);
          state.writes++;
          state.tag = { type: "commit", sha: commit };
        },
      },
      repos: {
        async getReleaseByTag() {
          // GitHub's by-tag endpoint exposes published releases, not drafts.
          if (!state.release || state.release.draft) throw missing();
          return { data: state.release };
        },
        async listReleases() {
          return { data: [...(state.release ? [state.release] : []), ...state.additionalReleases] };
        },
        async createRelease(data) {
          state.writes++;
          state.createdReleases++;
          state.release = {
            ...data,
            id: 8 + state.createdReleases,
            upload_url: "https://uploads.example/{?name,label}",
          };
          return { data: state.release };
        },
        async listReleaseAssets() {
          return { data: state.assets.map(({ data, ...asset }) => asset) };
        },
        async uploadReleaseAsset({ name, data }) {
          if (state.failUpload && name === names[1]) throw new Error("Upload interrupted");
          state.writes++;
          state.assets.push({ id: state.nextId++, name, data: Buffer.from(data) });
        },
        async getReleaseAsset({ asset_id, headers }) {
          assert.equal(headers.accept, "application/octet-stream");
          return { data: state.assets.find((asset) => asset.id === asset_id).data };
        },
        async updateRelease({ draft, make_latest = "true" }) {
          state.writes++;
          state.release.draft = draft;
          // Model GitHub's default promotion and its version-aware legacy policy.
          if (
            !draft &&
            (make_latest === "true" ||
              (make_latest === "legacy" &&
                (!latest.version || version.localeCompare(latest.version, undefined, { numeric: true }) > 0)))
          )
            latest.version = version;
          return { data: state.release };
        },
      },
    },
    async paginate(method, args) {
      return (await method(args)).data;
    },
  };
  async function run() {
    const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
    const match = workflow.match(/\/\/ BEGIN PUBLICATION\r?\n([\s\S]*?)\s*\/\/ END PUBLICATION/);
    assert.ok(match, "Workflow must contain executable publication script");
    const script = match[1].replace(/^            /gm, "");
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const saved = {
      SOURCE_SHA: process.env.SOURCE_SHA,
      VERSION: process.env.VERSION,
      ARTIFACT_DIR: process.env.ARTIFACT_DIR,
    };
    Object.assign(process.env, { SOURCE_SHA: sha, VERSION: version, ARTIFACT_DIR: dir });
    try {
      await new AsyncFunction("github", "context", "core", "require", script)(
        github,
        { repo: { owner: "test", repo: "repo" } },
        { info() {} },
        require,
      );
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
  return { dir, files, state, run, github };
}

test("publishing an older release last keeps the higher version Latest", async () => {
  const latest = {};
  const newer = fixture({ version: "1.10.0", latest });
  const older = fixture({ version: "1.2.3", latest });
  await newer.run();
  assert.equal(latest.version, "1.10.0");
  await older.run();
  assert.equal(older.state.release.draft, false);
  assert.equal(latest.version, "1.10.0");
});

test("rejects missing checksums before creating a tag", async () => {
  const f = fixture();
  rmSync(join(f.dir, "SHA256SUMS"));
  await assert.rejects(f.run(), /checksum|files|artifact/i);
  assert.equal(f.state.writes, 0);
});
test("rejects metadata commit drift before publication", async () => {
  const f = fixture();
  const metadata = JSON.parse(f.files["release-metadata.json"]);
  metadata.commit = "b".repeat(40);
  writeFileSync(join(f.dir, "release-metadata.json"), JSON.stringify(metadata));
  await assert.rejects(f.run(), /commit/i);
  assert.equal(f.state.writes, 0);
});
test("refuses a tag pointing at another commit", async () => {
  const f = fixture();
  f.state.tag = { type: "commit", sha: "b".repeat(40) };
  await assert.rejects(f.run(), /tag/i);
  assert.equal(f.state.release, null);
});
test("resumes an interrupted draft and publishes only after all four assets exist", async () => {
  const f = fixture();
  f.state.failUpload = true;
  await assert.rejects(f.run(), /Upload interrupted/);
  assert.equal(f.state.release.draft, true);
  assert.equal(f.state.assets.length, 1);
  const originalDraft = f.state.release;
  const firstAsset = f.state.assets[0];
  assert.equal(f.state.createdReleases, 1);
  f.state.failUpload = false;
  await f.run();
  assert.equal(f.state.createdReleases, 1, "Retry must reuse the existing draft");
  assert.equal(f.state.release, originalDraft);
  assert.equal(f.state.release.id, originalDraft.id);
  assert.equal(f.state.assets[0], firstAsset);
  assert.deepEqual(firstAsset.data, f.files[names[0]]);
  assert.equal(f.state.release.draft, false);
  assert.equal(f.state.assets.length, 4);
  assert.equal(f.state.tag.sha, sha);
  assert.equal(f.state.release.target_commitish, sha);
});
test("rerunning a complete published release makes no writes", async () => {
  const f = fixture();
  await f.run();
  const writes = f.state.writes;
  await f.run();
  assert.equal(f.state.writes, writes);
});

test("rejects multiple draft releases for the same tag without changing them", async () => {
  const f = fixture();
  f.state.failUpload = true;
  await assert.rejects(f.run(), /Upload interrupted/);
  f.state.additionalReleases.push({ ...f.state.release, id: 10 });
  const writes = f.state.writes;
  await assert.rejects(f.run(), /multiple|duplicate/i);
  assert.equal(f.state.writes, writes);
  assert.equal(f.state.release.draft, true);
});
test("refuses conflicting remote bytes without overwriting them", async () => {
  const f = fixture();
  f.state.failUpload = true;
  await assert.rejects(f.run());
  f.state.assets[0].data = Buffer.from("corrupted");
  f.state.failUpload = false;
  const writes = f.state.writes;
  await assert.rejects(f.run(), /asset|checksum|hash/i);
  assert.equal(f.state.writes, writes);
  assert.equal(f.state.release.draft, true);
});
test("refuses to repair an incomplete published release", async () => {
  const f = fixture();
  await f.run();
  f.state.assets.pop();
  const writes = f.state.writes;
  await assert.rejects(f.run(), /published|missing|asset/i);
  assert.equal(f.state.writes, writes);
});
test("resolves annotated tags before checking their commit", async () => {
  const f = fixture();
  f.state.tag = { type: "tag", sha: "c".repeat(40) };
  f.state.annotated["c".repeat(40)] = { type: "commit", sha };
  await f.run();
  assert.equal(f.state.release.draft, false);
});

test("rejects changed archive bytes before writing anything", async () => {
  const f = fixture();
  writeFileSync(join(f.dir, names[0]), "tampered");
  await assert.rejects(f.run(), /checksum/i);
  assert.equal(f.state.writes, 0);
});
test("rejects checksum lines naming a different archive", async () => {
  const f = fixture();
  writeFileSync(
    join(f.dir, "SHA256SUMS"),
    f.files.SHA256SUMS.toString().replace("opencc.chrome.zip", "../opencc.chrome.zip"),
  );
  await assert.rejects(f.run(), /checksum/i);
  assert.equal(f.state.writes, 0);
});
test("rejects additional downloaded files before writing anything", async () => {
  const f = fixture();
  writeFileSync(join(f.dir, "unexpected.js"), "arbitrary code");
  await assert.rejects(f.run(), /artifact files/i);
  assert.equal(f.state.writes, 0);
});
test("preserves reviewed release notes when an existing draft conflicts", async () => {
  const f = fixture();
  f.state.failUpload = true;
  await assert.rejects(f.run());
  f.state.release.body = "Different reviewed notes";
  const writes = f.state.writes;
  await assert.rejects(f.run(), /notes/i);
  assert.equal(f.state.writes, writes);
});
test("checks the winner of a concurrent tag creation before publication", async () => {
  const f = fixture();
  // The remote changes between the initial GET and createRef.
  const original = f.state;
  Object.defineProperty(original, "tag", {
    configurable: true,
    get() {
      delete original.tag;
      original.tag = { type: "commit", sha: "b".repeat(40) };
      return null;
    },
  });
  // Initial lookup fails; creating an already-existing ref must be treated as a race.
  // Override via the fixture's explicit API hook below rather than accepting a mock overwrite.
  f.github.rest.git.createRef = async () => {
    throw Object.assign(new Error("Reference exists"), { status: 422 });
  };
  await assert.rejects(f.run(), /tag/i);
  assert.equal(f.state.release, null);
});

test("rejects a later matching heading when the first version is stale", async () => {
  const f = fixture();
  const notes = "## v0.1.0 - 2026-10-18\n\n## v1.2.3 - 2026-10-18\n";
  const metadata = JSON.parse(f.files["release-metadata.json"]);
  metadata.sha256["CHANGELOG_RELEASE.md"] = hash(notes);
  writeFileSync(join(f.dir, "CHANGELOG_RELEASE.md"), notes);
  writeFileSync(join(f.dir, "release-metadata.json"), JSON.stringify(metadata));
  await assert.rejects(f.run(), /heading/i);
  assert.equal(f.state.writes, 0);
});

test("keeps a draft unpublished if uploaded bytes differ from verified files", async () => {
  const f = fixture();
  const upload = f.github.rest.repos.uploadReleaseAsset;
  f.github.rest.repos.uploadReleaseAsset = async (args) => {
    await upload(args);
    if (args.name === "SHA256SUMS") f.state.assets.at(-1).data = Buffer.from("changed in transit");
  };
  await assert.rejects(f.run(), /checksum/i);
  assert.equal(f.state.release.draft, true);
});
