import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { webMatches } from "../../scripts/verify-build-output.mjs";

export async function artifactFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencc-packaging-"));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));
  for (const browser of ["chrome", "firefox", "edge"]) {
    const dir = path.join(root, ".output", `${browser}-mv3`);
    await fs.mkdir(path.join(dir, "nested"), { recursive: true });
    const manifest = {
      manifest_version: 3,
      version: "1.2.3",
      permissions: ["storage", "contextMenus", "scripting", "activeTab"],
      host_permissions: [...webMatches],
      icons: { 128: "icon.png" },
      action: { default_popup: "popup.html", default_icon: { 128: "icon.png" } },
      options_ui: { page: "options.html" },
      background:
        browser === "firefox"
          ? { scripts: ["background.js"], type: "module" }
          : { service_worker: "background.js", type: "module" },
      content_scripts: [{ matches: [...webMatches], all_frames: false, run_at: "document_idle", js: ["content.js"] }],
      ...(browser === "firefox" ? { browser_specific_settings: { gecko: { id: "fixture@example.org" } } } : {}),
    };
    await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
    for (const file of ["icon.png", "background.js", "content.js", "popup.html", "options.html", "nested/a.txt"])
      await fs.writeFile(path.join(dir, file), "fixture");
  }
  return root;
}
