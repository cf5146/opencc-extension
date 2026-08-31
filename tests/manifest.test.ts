import { describe, expect, it } from "vitest";
import { createManifest, type TargetBrowser } from "../src/build/manifest.js";

const targets: TargetBrowser[] = ["chrome", "edge", "firefox"];

describe("target manifest factory", () => {
  it.each(targets)("creates an MV3 manifest for %s", (browser) => {
    const manifest = createManifest(browser);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(expect.arrayContaining(["storage", "contextMenus", "scripting", "activeTab"]));
    expect(manifest.permissions).not.toContain("tabs");
    expect(manifest.host_permissions).toEqual(["http://*/*", "https://*/*"]);
    expect(manifest.options_ui).toEqual({ page: "options.html", open_in_tab: false });
    expect(manifest.action.default_popup).toBe("popup.html");
  });

  it("uses an MV3 service worker for Chromium targets", () => {
    expect(createManifest("chrome").background).toEqual({
      service_worker: "background.js",
      type: "module",
    });
    expect(createManifest("edge").background).toEqual({
      service_worker: "background.js",
      type: "module",
    });
  });

  it("uses the Firefox MV3 background shape and preserves the Gecko ID", () => {
    expect(createManifest("firefox").background).toEqual({ scripts: ["background.js"] });
    expect(createManifest("firefox").browser_specific_settings).toEqual({
      gecko: { id: "opencc.extension@tnychn" },
    });
  });
});
