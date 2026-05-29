import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    version: '1.0.0',
    default_locale: 'en',
    permissions: ['storage', 'activeTab', 'contextMenus', 'scripting', 'tabs'],
    host_permissions: ['http://*/*', 'https://*/*'],
    icons: {
      128: 'icon.png',
    },
    action: {
      default_title: 'OpenCC',
      default_icon: {
        128: 'icon.png',
      },
    },
    commands: {
      'convert-page': {
        suggested_key: {
          default: 'Alt+Shift+C',
          mac: 'Alt+Shift+C',
        },
        description: 'Convert current page text',
      },
    },
  },
});
