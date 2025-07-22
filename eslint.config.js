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
        
        // WebExtension globals
        chrome: "readonly",
        browser: "readonly",
        
        // Node.js globals (for build scripts)
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        global: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      // Keep existing rules from package.json
      "no-unused-vars": "warn",
      "no-console": "off",
    },
    files: ["src/**/*.js", "build.mjs"],
  },
  {
    ignores: ["build/", "dist/", "node_modules/", "artifacts/"],
  },
];
