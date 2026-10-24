# Dependency risk assessment

Assessed on 2026-10-23 against merged PR #79 (`202f05846c328e5e0100377d5916e3ca7ca50b4c`). Scope: both npm lockfiles, build/development tooling and the extension dependency boundary. This is an advisory/dependency assessment, not an exhaustive security audit of OpenCC, WASM or GitHub Actions.

## Findings and decision

| Dependency path                                                                                   | Before                                                                                         | Action                                              |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| WXT optional runner / direct `web-ext@10.8.0` → `@devicefarmer/adbkit@3.3.9` → `node-forge@1.4.0` | High: CVE-2026-85393; RSA signature verification accepts malformed nested DigestAlgorithm data | Remove the optional runner and its dependency chain |
| `web-ext` → `addons-linter` → `ajv` → `fast-uri@3.1.8`                                            | Four URI handling advisories, maximum moderate; affected versions below 3.1.9                  | Removed with the same unused tooling chain          |
| `scripts/opencc-feasibility/package-lock.json`                                                    | No npm advisories reported                                                                     | Preserve pinned native reference tools              |

The [reviewed node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) lists versions through 1.4.0 as affected and no patched version. Registry checks found node-forge 1.4.0 and web-ext 10.8.0 still latest. A normal version bump cannot resolve this chain. `npm audit` proposed major downgrades of web-ext/WXT; these are not accepted as a compatibility-safe fix. No cryptographic implementation is vendored or patched locally.

Forge is a development dependency here. ADB tooling contains a real RSA verification path, including support for exponent 3; being a development dependency does not prove it harmless. No exploit of this repository's desktop development workflow was demonstrated. Production entrypoints do not import web-ext, adbkit or node-forge; these tools are not part of the conversion engine.

## Development tradeoff

WXT 0.21.4 declares web-ext as an optional peer. Its installed `resolve-config.mjs` catches the missing runner import and selects its built-in manual runner. Removing the root web-ext dependency therefore preserves compilation/watch, browser builds and ZIP packaging, while dropping automatic browser launch and web-ext's Android debugging/add-on lint CLI.

Run `npm run dev:edge`, `npm run dev` (Chrome), or `npm run dev:firefox`, then load the directory printed by WXT manually. Reload the extension/page after edits. Firefox still requires an installed Firefox browser for runtime testing; a successful build is not a Firefox runtime claim. No repository script or workflow invokes the removed web-ext CLI directly.

## Reproduction and results

```powershell
npm ci --ignore-scripts
node_modules/.bin/wxt prepare
npm audit
npm audit --prefix scripts/opencc-feasibility
npm ls web-ext node-forge fast-uri
npm run ci
npm run package:built
```

`npm ls` intentionally exits 1 with `(empty)` for the removed packages. The root audit changes from five vulnerable package nodes (four high, one moderate) to zero. Four high entries describe one propagated Forge dependency chain, not four independent high-severity CVEs. The reference-tool audit also reports zero. Audit results are a dated registry snapshot, not a guarantee against unknown or future vulnerabilities.

Local validation after a clean install passed: 267 tests, lint, typecheck, Chrome/Firefox/Edge production builds, generated-manifest checks, all 32 official resource hashes per browser, and packaging of all three verified builds. Each of `dev`, `dev:edge` and `dev:firefox` started its development server, built successfully and printed the manual-load directory without web-ext. This checks tool startup, not browser runtime or live reload in an installed browser.

The lockfile removes 237 package entries, adds none, and changes no retained package versions. Existing platform-specific optional package entries remain in the lockfile. Rollback is a normal Git revert; reinstalling web-ext also restores the vulnerable chain and must be reassessed before use.
