import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { artifactFixture } from "./helpers/artifact-fixture.mjs";

const packager = () => import("../scripts/package-built.mjs");

describe("built artifact packaging", () => {
  it("archives all three existing outputs with root manifests and exact checksums", async () => {
    const root = await artifactFixture();
    try {
      const { packageBuilt } = await packager();
      await packageBuilt(root);
      const sums = await fs.readFile(path.join(root, ".output/SHA256SUMS"), "utf8");
      for (const browser of ["chrome", "firefox", "edge"]) {
        const zip = await fs.readFile(path.join(root, `.output/opencc.${browser}.zip`));
        expect(zip.readUInt32LE(0)).toBe(0x04034b50);
        expect(zip.includes(Buffer.from("manifest.json"))).toBe(true);
        expect(zip.includes(Buffer.from(`${browser}-mv3/manifest.json`))).toBe(false);
        const names = [];
        let offset = 0;
        while (zip.readUInt32LE(offset) === 0x04034b50) {
          const nameLength = zip.readUInt16LE(offset + 26);
          const extraLength = zip.readUInt16LE(offset + 28);
          names.push(zip.subarray(offset + 30, offset + 30 + nameLength).toString("utf8"));
          offset += 30 + nameLength + extraLength + zip.readUInt32LE(offset + 18);
        }
        expect(names).toEqual([...names].sort());
        expect(names).toContain("nested/a.txt");
        expect(sums).toContain(`${createHash("sha256").update(zip).digest("hex")}  opencc.${browser}.zip\n`);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it.each(["missing", "invalid", "symlink"])("rejects %s build output", async (failure) => {
    const root = await artifactFixture();
    try {
      const dir = path.join(root, ".output/chrome-mv3");
      if (failure === "missing") await fs.rm(dir, { recursive: true });
      if (failure === "invalid") await fs.writeFile(path.join(dir, "manifest.json"), "{}");
      if (failure === "symlink")
        await fs.symlink(path.join(root, ".output/firefox-mv3"), path.join(dir, "linked"), "junction");
      const { packageBuilt } = await packager();
      await expect(packageBuilt(root)).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
