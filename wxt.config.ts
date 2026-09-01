import { defineConfig } from "wxt";
import { createManifest, type TargetBrowser } from "./src/build/manifest.js";

export default defineConfig({
  manifestVersion: 3,
  outDirTemplate: "{{browser}}-mv{{manifestVersion}}",
  manifest: ({ browser }) => {
    const manifest = createManifest(browser as TargetBrowser);
    Reflect.deleteProperty(manifest, "manifest_version");
    return manifest;
  },
  zip: {
    artifactTemplate: "opencc.{{browser}}.zip",
    excludeSources: ["build/**", "dist/**", "opencc.*.zip", "SHA256SUMS"],
  },
});
