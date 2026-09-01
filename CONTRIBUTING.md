# Contributing

Thanks for your interest in contributing!

## GitHub Flow

1. Fork the repo (or create a feature branch off `main` if you have access).
2. Branch name format: `feat/short-desc`, `fix/issue-123`, `chore/something`.
3. Keep commits small & focused. Use conventional-ish prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
4. Open a Pull Request against `main` (drafts welcome). The `CI` workflow must pass.
5. A maintainer will review & merge using squash (preferred) or rebase.

## Development

Requirements: Node >= 20.19, npm, and the `rtk` command used to keep local command output compact.

Install deps:

```bash
rtk npm ci
```

Start WXT development builds:

```bash
rtk npm run dev
rtk npm run dev:firefox
rtk npm run dev:edge
```

WXT writes watch builds to `.output/chrome-mv3/`, `.output/firefox-mv3/`, or `.output/edge-mv3/`. Load the matching directory in the target browser.

Build and verify each MV3 target:

```bash
rtk npm run build:chrome
rtk node scripts/verify-build-output.mjs chrome
rtk npm run build:firefox
rtk node scripts/verify-build-output.mjs firefox
rtk npm run build:edge
rtk node scripts/verify-build-output.mjs edge
```

Build production artifacts (zips generated in `.output/`):

```bash
rtk npm run dist
```

Chrome, Edge, and Firefox share one WXT source tree and are explicitly built as Manifest V3 targets. Content scripts are declared statically; auto mode controls the content observer. Page conversion has a one-shot active-tab injection fallback when a static script was missed.

## Lint & Format

```bash
rtk npm run lint
rtk npm run format:check
```

Run the complete local gate before opening a pull request:

```bash
rtk npm run ci
```

## Commit Messages

Use present tense, imperative mood. Example:

```text
feat: add auto mode badge hover tooltip
```

## Release Process

Maintainers:

1. Run the `Release` workflow from the `main` branch. An optional semver override and release notes can be supplied in the dispatch form.
2. The workflow updates `package.json` and `package-lock.json`, generates the changelog, builds and verifies all three targets, and packages the distributions.
3. The workflow atomically pushes the release commit and `vX.Y.Z` tag, then publishes the GitHub Release with checksums.
4. To resume an interrupted publication, dispatch the workflow again with the same version after confirming that `main` and `vX.Y.Z` point to the same release commit. The workflow preserves the existing release notes and replaces matching assets.

## Issue Reporting

Provide reproduction steps & environment details. Screens/GIFs help.

## Security

Do not open public issues for sensitive vulnerabilities. Email the author (see `package.json`).

## License

By contributing you agree your work is MIT licensed.
