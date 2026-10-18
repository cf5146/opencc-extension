# Changelog

## v0.6.0 - 2026-10-18
[Compare changes](https://github.com/cf5146/opencc-extension/compare/v0.5.11...v0.6.0)


### Chores
- bump @types/node from 26.6.4 to 26.6.5
- bump jsdom from 30.1.0 to 30.1.2
- bump @typescript-eslint/eslint-plugin from 8.71.1 to 8.71.2
- bump globals from 17.12.0 to 17.13.0
- bump shell-quote
- bump @typescript-eslint/eslint-plugin from 8.70.0 to 8.71.1
- bump prettier from 3.9.9 to 3.9.10
- bump @wxt-dev/browser from 0.3.4 to 0.3.5
- bump source-map-js
- bump @wxt-dev/browser from 0.2.9 to 0.3.4
- bump eslint from 10.9.1 to 10.12.0
- bump @types/node from 26.6.3 to 26.6.4
- bump brace-expansion in the npm_and_yarn group across 1 directory
- bump prettier from 3.9.8 to 3.9.9
- bump @types/node from 26.5.1 to 26.6.3
- bump web-ext from 10.6.0 to 10.7.0
- bump prettier from 3.9.6 to 3.9.8
- bump @typescript-eslint/eslint-plugin from 8.69.0 to 8.70.0
- bump jsdom from 30.0.1 to 30.1.0
- bump adm-zip in the npm_and_yarn group across 1 directory
- bump @wxt-dev/browser from 0.2.8 to 0.2.9
- bump @types/node from 26.4.1 to 26.5.1
- bump @typescript-eslint/parser from 8.69.0 to 8.70.0
- bump jsdom from 27.4.0 to 30.0.1
- bump @wxt-dev/browser from 0.2.7 to 0.2.8
- bump @types/node from 26.4.0 to 26.4.1
- bump globals from 17.11.0 to 17.12.0
- bump @eslint/js from 9.39.4 to 10.0.1
- bump prettier from 3.7.4 to 3.9.6
- bump globals from 16.5.0 to 17.11.0
- bump @types/node from 24.10.4 to 26.4.0
- bump @humanfs/node in the npm_and_yarn group across 1 directory

### Features
- improve conversion and redesign UI and release workflows

### Fixes
- repair dependency upgrade compatibility
- restore popup layout and inline Traditional Chinese settings
- resolve SonarQube security and reliability gate failures

### Other
- Fix githubactions:S7637 Use full commit SHA hash for this dependency. External GitHub Actions and workflows should be pinned to a commit hash githubactions:S7637
- [chore] Modify workflow and bump node-version to 24

## v0.5.11 - 2026-09-01
[Compare changes](github:tnychn/opencc-extension/compare/v0.5.10...v0.5.11)


### Build
- adopt WXT for MV3 targets

### Chores
- bump the npm_and_yarn group across 1 directory with 2 updates
- bump eslint from 9.39.4 to 10.9.1
- bump the npm_and_yarn group across 1 directory with 5 updates
- bump jsdom from 27.4.0 to 30.0.1
- bump esbuild from 0.27.2 to 0.28.2
- bump vitest from 4.0.16 to 4.1.11
- bump @typescript-eslint/eslint-plugin from 8.51.0 to 8.68.0

### Documentation
- add runtime rewrite plan

### Other
- Revert "chore: bump jsdom from 27.4.0 to 30.0.1"

### Refactoring
- update GitHub Actions workflow to use latest actions and improve credential handling
- enhance error handling and serialization in errorMessage functions
- improve browser-specific output directory handling in build verification script
- update HTML status element to use <output> and improve null checks in conversion service
- update HTML title and format repository link; ensure consistent file endings
- complete WXT runtime migration
- move extension UI behind ports
- use static content runtime
- route tab operations through background
- isolate WebExtension platform APIs
- extract auto conversion controller
- add runtime contracts
