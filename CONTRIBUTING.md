# Contributing

Thanks for your interest in contributing!

## GitHub Flow

1. Fork the repo (or create a feature branch off `main` if you have access).
2. Branch name format: `feat/short-desc`, `fix/issue-123`, `chore/something`.
3. Keep commits small & focused. Use conventional-ish prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
4. Open a Pull Request against `main` (drafts welcome). The `CI` workflow must pass.
5. A maintainer will review & merge using squash (preferred) or rebase.

## Development

Requirements: Node >= 18, pnpm.

Install deps:

```bash
pnpm install
```

Start dev for Firefox:

```bash
pnpm start:firefox
```

For Chromium:

```bash
pnpm start:chromium
```

Build production artifacts (zips generated in repo root):

```bash
pnpm dist
```

## Lint & Format

```bash
pnpm lint
pnpm format:check
```

## Commit Messages
 
Use present tense, imperative mood. Example:

```text
feat: add auto mode badge hover tooltip
```

## Release Process
Maintainers:
 
1. Update version in `package.json` (or use the Release workflow dispatch).
2. Tag: `git tag vX.Y.Z && git push --tags`.
3. GitHub Action builds & attaches artifacts.

## Issue Reporting
Provide reproduction steps & environment details. Screens/GIFs help.

## Security
Do not open public issues for sensitive vulnerabilities. Email the author (see `package.json`).

## License
By contributing you agree your work is MIT licensed.
