import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        clearTimeout: "readonly",
        setTimeout: "readonly",
        NodeFilter: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        requestIdleCallback: "readonly",
        performance: "readonly",

        // WebExtension globals
        chrome: "readonly",
        browser: "readonly",

        // Environment detection
        process: "readonly",
      },
    },
    rules: {
      // Keep existing rules from package.json
      "no-unused-vars": "warn",
      "no-console": "off",
    },
    files: ["src/**/*.js"],
  },
  {
    // Node.js environment for scripts and build files
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node.js globals
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        global: "readonly",
        Buffer: "readonly",
        console: "readonly",

        // Additional Node globals
        fs: "readonly",
        path: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
    files: ["scripts/**/*.js", "build.mjs"],
  },
  {
    // Test files and debug files
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        clearTimeout: "readonly",
        setTimeout: "readonly",
        NodeFilter: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        requestIdleCallback: "readonly",
        performance: "readonly",

        // WebExtension globals
        chrome: "readonly",
        browser: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off", // Allow unused vars in test files for debugging
      "no-console": "off",
    },
    files: ["test-*.js", "debug-*.js", "investigate-*.js", "verify-*.js"],
  },
  {
    ignores: ["build/", "dist/", "node_modules/", "artifacts/"],
  },
];
