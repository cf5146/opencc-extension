import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.(ts|js|mjs)'],
    globals: true,
    setupFiles: [],
  },
});
