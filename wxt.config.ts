import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: [],
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: {
    name: 'OpenCC Extension',
    description: 'A browser extension to convert webpages between different Chinese variants.',
    permissions: ['storage', 'contextMenus', 'activeTab', 'scripting'],
    action: {
      default_popup: 'popup.html',
      default_icon: 'icon.png',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    icons: {
      128: 'icon.png',
    },
  },
});
