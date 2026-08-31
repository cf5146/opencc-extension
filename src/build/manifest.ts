export type TargetBrowser = 'chrome' | 'edge' | 'firefox';

type ChromiumBackground = { service_worker: string; type: 'module' };
type FirefoxBackground = { scripts: string[] };

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
  host_permissions: string[];
  browser_specific_settings?: { gecko: { id: string } };
}

const commonManifest = {
  manifest_version: 3 as const,
  name: 'OpenCC',
  author: 'Tony Chan',
  description: 'Convert webpages between different Chinese variants.',
  homepage_url: 'https://github.com/tnychn/opencc-extension',
  icons: { 128: 'icon.png' },
  options_ui: { page: 'options.html', open_in_tab: false },
  action: {
    default_icon: { 128: 'icon.png' },
    default_title: 'OpenCC',
    default_popup: 'popup.html',
  },
  permissions: ['storage', 'contextMenus', 'scripting', 'activeTab'],
  host_permissions: ['http://*/*', 'https://*/*'],
};

export function createManifest(browser: TargetBrowser): ExtensionManifest {
  if (browser === 'firefox') {
    return {
      ...commonManifest,
      background: { scripts: ['background.js'] },
      browser_specific_settings: { gecko: { id: 'opencc.extension@tnychn' } },
    };
  }

  return {
    ...commonManifest,
    background: { service_worker: 'background.js', type: 'module' },
  };
}
