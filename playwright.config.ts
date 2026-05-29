import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  use: {
    headless: false,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('.output/chrome-mv3')}`,
            `--load-extension=${path.resolve('.output/chrome-mv3')}`,
          ],
        },
      },
    },
  ],
});
