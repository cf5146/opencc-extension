import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const verifierPath = path.resolve("scripts/verify-build-output.mjs");
const resolverPath = path.resolve("scripts/resolve-release-version.mjs");

async function writeFile(root, relativePath, contents) {
  const filePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function createArtifactFixture(version = "1.0.0") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencc-artifact-"));
  const manifest = {
    manifest_version: 3,
    version,
    permissions: ["storage", "contextMenus", "scripting", "activeTab", "offscreen"],
    host_permissions: ["http://*/*", "https://*/*"],
    icons: { 128: "icon.png" },
    action: { default_popup: "popup.html", default_icon: { 128: "icon.png" } },
    options_ui: { page: "options.html" },
    background: { service_worker: "background.js", type: "module" },
    content_scripts: [
      {
        matches: ["http://*/*", "https://*/*"],
        all_frames: false,
        run_at: "document_idle",
        js: ["content-scripts/content.js"],
      },
    ],
  };

  await writeFile(root, "package.json", JSON.stringify({ version }));
  await writeFile(root, ".output/chrome-mv3/manifest.json", JSON.stringify(manifest));
  await writeFile(root, ".output/chrome-mv3/icon.png", "icon");
  await writeFile(root, ".output/chrome-mv3/background.js", "background");
  await writeFile(root, ".output/chrome-mv3/content-scripts/content.js", "content");
  await writeFile(root, ".output/chrome-mv3/popup.html", '<script src="/chunks/popup.js"></script>');
  await writeFile(root, ".output/chrome-mv3/options.html", '<script src="/chunks/options.js"></script>');
  await writeFile(root, ".output/chrome-mv3/chunks/popup.js", "popup");
  await writeFile(root, ".output/chrome-mv3/chunks/options.js", "options");
  return { root, manifest };
}

function runScript(scriptPath, cwd, env = {}, args = []) {
  const childEnv = { ...process.env };
  delete childEnv.GITHUB_OUTPUT;
  delete childEnv.RELEASE_VERSION;
  Object.assign(childEnv, env);
  return spawnSync(process.execPath, [scriptPath, ...args], { cwd, encoding: "utf8", env: childEnv });
}

function runVerifier(cwd) {
  return runScript(verifierPath, cwd, {}, ["chrome"]);
}

describe("generated artifact verifier", () => {
  it("accepts root-relative HTML assets and a complete target manifest", async () => {
    const { root } = await createArtifactFixture();
    try {
      const result = runVerifier(root);
      expect(result.status).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing required icons", async () => {
    const { root, manifest } = await createArtifactFixture();
    try {
      delete manifest.icons;
      await writeFile(root, ".output/chrome-mv3/manifest.json", JSON.stringify(manifest));
      const result = runVerifier(root);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("required 128px icons are missing");

      manifest.icons = { 128: "https://example.com/icon.png" };
      await writeFile(root, ".output/chrome-mv3/manifest.json", JSON.stringify(manifest));
      const externalResult = runVerifier(root);
      expect(externalResult.status).not.toBe(0);
      expect(`${externalResult.stdout}${externalResult.stderr}`).toContain("required local reference is invalid");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects extra content scripts and escaping HTML references", async () => {
    const { root, manifest } = await createArtifactFixture();
    try {
      manifest.content_scripts.push({ ...manifest.content_scripts[0] });
      await writeFile(root, ".output/chrome-mv3/manifest.json", JSON.stringify(manifest));
      let result = runVerifier(root);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("exactly one static content script is required");

      manifest.content_scripts.pop();
      await writeFile(root, ".output/chrome-mv3/manifest.json", JSON.stringify(manifest));
      await writeFile(root, ".output/chrome-mv3/popup.html", '<script src="../../outside.js"></script>');
      result = runVerifier(root);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("local reference escapes");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe("release version resolver", () => {
  it("selects the highest loose or packed semver tag", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencc-resolver-"));
    try {
      await writeFile(root, "package.json", JSON.stringify({ version: "1.0.0" }));
      await writeFile(root, ".git/refs/tags/v1.1.0", "a");
      await writeFile(root, ".git/packed-refs", `b refs/tags/v2.0.0\n`);
      const result = runScript(resolverPath, root);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Resolved release version: 2.0.1");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an already tagged version during preparation", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencc-resolver-"));
    try {
      await writeFile(root, "package.json", JSON.stringify({ version: "1.2.3" }));
      await writeFile(root, ".git/refs/tags/v1.2.3", "a");
      const result = runScript(resolverPath, root, { RELEASE_VERSION: "1.2.3" });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain("must be greater");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when git metadata is unavailable", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencc-resolver-"));
    try {
      await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
      expect(() => execFileSync(process.execPath, [resolverPath], { cwd: root, stdio: "pipe" })).toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe("release package update", () => {
  it("fails instead of continuing when package.json cannot be parsed", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencc-bump-"));
    try {
      await writeFile(root, "package.json", "not JSON");
      await writeFile(root, "package-lock.json", JSON.stringify({ version: "1.0.0" }));
      const result = runScript(path.resolve("scripts/bump-version.cjs"), root, {}, ["1.0.1"]);
      expect(result.status).not.toBe(0);
      expect(JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8")).version).toBe("1.0.0");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
  it.each(["0.0.0", "1.2.65536", "999999999999999999999.1.0", "01.2.3", "1.0.0;echo unsafe"])(
    "rejects invalid browser version %s before editing files",
    async (version) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencc-bump-"));
      try {
        await writeFile(root, "package.json", JSON.stringify({ version: "1.0.0" }));
        const result = runScript(path.resolve("scripts/bump-version.cjs"), root, {}, [version]);
        expect(result.status).not.toBe(0);
        expect(JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")).version).toBe("1.0.0");
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );
});

describe("browser release version boundaries", () => {
  it.each(["0.0.0", "1.2.65536", "999999999999999999999.1.0", "01.2.3"])(
    "rejects requested version %s",
    async (requestedVersion) => {
      const { resolveReleaseVersion } = await import("../scripts/resolve-release-version.mjs");
      expect(() => resolveReleaseVersion({ packageVersion: "1.0.0", requestedVersion })).toThrow(
        /Invalid release version/,
      );
    },
  );
  it("requires an explicit version when the patch component is exhausted", async () => {
    const { resolveReleaseVersion } = await import("../scripts/resolve-release-version.mjs");
    expect(() => resolveReleaseVersion({ packageVersion: "1.2.65535" })).toThrow(/explicit release version/);
    expect(resolveReleaseVersion({ packageVersion: "1.2.65535", requestedVersion: "1.3.0" })).toBe("1.3.0");
  });
});
