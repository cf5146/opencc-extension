import { defineConfig } from "wxt";
import { createManifest, type TargetBrowser } from "./src/build/manifest.js";

export default defineConfig({
  manifestVersion: 3,
  outDirTemplate: "{{browser}}-mv{{manifestVersion}}",
  manifest: ({ browser }) => createManifest(browser as TargetBrowser),
  zip: {
    artifactTemplate: "opencc.{{browser}}.zip",
    excludeSources: [],
  },
});
