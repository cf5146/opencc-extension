export type TargetBrowser = "chrome" | "edge" | "firefox";

type ChromiumBackground = { service_worker: string; type: "module" };
type FirefoxBackground = { scripts: string[]; type: "module" };

export interface ExtensionManifest {
  manifest_version: 3;
  name: string;
  author: string;
  version?: string;
  description: string;
  homepage_url: string;
  icons: { 128: string };
  options_ui: { page: string; open_in_tab: boolean };
  action: {
    default_icon: { 128: string };
    default_title: string;
    default_popup: string;
  };
  background: ChromiumBackground | FirefoxBackground;
  permissions: string[];
  content_security_policy?: { extension_pages: string };
  host_permissions: string[];
  browser_specific_settings?: { gecko: { id: string; data_collection_permissions: { required: ["none"] } } };
}

const commonManifest = {
  manifest_version: 3 as const,
  name: "OpenCC",
  author: "cf5146",
  description: "Convert Chinese text and webpages. Independently maintained by cf5146.",
  homepage_url: "https://github.com/cf5146/opencc-extension",
  icons: { 128: "icon.png" },
  options_ui: { page: "options.html", open_in_tab: false },
  action: {
    default_icon: { 128: "icon.png" },
    default_title: "OpenCC",
    default_popup: "popup.html",
  },
  permissions: ["storage", "contextMenus", "scripting", "activeTab"],
  content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
  host_permissions: ["http://*/*", "https://*/*"], // NOSONAR S5332: browser URL matching metadata; this performs no HTTP request.
};

export function createManifest(browser: TargetBrowser): ExtensionManifest {
  if (browser === "firefox") {
    return {
      ...commonManifest,
      background: { scripts: ["background.js"], type: "module" },
      browser_specific_settings: {
        gecko: {
          id: "opencc-extension@cf5146",
          data_collection_permissions: { required: ["none"] },
        },
      },
    };
  }

  return {
    ...commonManifest,
    permissions: [...commonManifest.permissions, "offscreen"],
    background: { service_worker: "background.js", type: "module" },
  };
}
