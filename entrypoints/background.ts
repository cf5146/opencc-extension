import { defineBackground } from 'wxt/utils/define-background';
import { createBackgroundRuntime } from '../src/application/runtime/background-runtime.js';
import { createSettingsStore } from '../src/application/settings/settings-store.js';
import { createBrowserPlatform } from '../src/platform/browser-platform.js';

export default defineBackground({
	type: 'module',
	main() {
		const platform = createBrowserPlatform();
		const settingsStore = createSettingsStore(platform.storage);
		const runtime = createBackgroundRuntime(platform, settingsStore);
		runtime.start();
	},
});
