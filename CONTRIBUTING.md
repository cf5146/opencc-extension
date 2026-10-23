# Contributing

Thanks for your interest in contributing to the independently maintained [cf5146/opencc-extension](https://github.com/cf5146/opencc-extension) fork! Original authorship and license notices are retained.

## GitHub Flow

1. Fork the repo (or create a feature branch off `main` if you have access).
2. Branch name format: `feat/short-desc`, `fix/issue-123`, `chore/something`.
3. Keep commits small & focused. Use conventional-ish prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
4. Open a Pull Request against `main` (drafts welcome). The `CI` workflow must pass.
5. A maintainer will review & merge using squash (preferred) or rebase.

## Development

Requirements: a Node version supported by `package.json`, npm, and the `rtk` command used to keep local command output compact.

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

## CI and packaging

The `CI` workflow keeps one `verify` job for branch protection. It runs on pushes to main/dev, pull requests targeting main, and manual dispatches. Each run installs dependencies once, prepares WXT explicitly, checks lint/types/tests, and builds/verifies all three MV3 targets once.

`npm run package:built` packages existing verified `.output/<browser>-mv3/` directories without rebuilding. It writes `opencc.chrome.zip`, `opencc.firefox.zip`, `opencc.edge.zip`, and `SHA256SUMS` into `.output/`. Run the full local gate first so packages reflect current source. Missing, invalid, or version-mismatched builds are rejected. Push/manual CI runs upload these files for 14 days. Existing `dist` commands remain available when a fresh local build and package are wanted together.

## Release Process

These workflows publish artifacts to this repository's GitHub Releases. Browser-store submission and Firefox signing are separate steps; the new Firefox ID `opencc-extension@cf5146` has not been submitted to AMO. See [maintainer and release identity](docs/maintainer-and-release-identity.md).

### Prepare and review

1. Run **Prepare release** on `main`. Leave version blank for the next patch above the package version and existing tags, or supply a version without a leading v. Optional additional notes are included in the reviewed release notes.
2. The workflow updates package/lockfile versions and both changelogs, pushes `codex/release-vX.Y.Z`, and opens a PR against main. It never pushes main or approves/merges the PR. An existing release branch/PR is reused without overwriting edits; failures after branch creation can be retried.
3. Preparation explicitly dispatches CI for the release branch. Review the release diff and checks, then merge the PR normally. To change reviewed content, edit that branch through the normal PR flow; rerunning preparation does not regenerate existing branch content.

Actions must be allowed to create PRs in **Settings > Actions > General > Workflow permissions**. Preparation requests contents/write, pull-requests/write, and actions/write for branch creation, PR creation, and CI dispatch. No PAT is required. Repository or organization policy may prevent this setting; the workflow must fail clearly rather than bypass that policy. Bot-created PR workflows may separately await approval; preparation also dispatches CI explicitly.

### Publish the reviewed commit

1. After merging the release PR, run **Release** from `main`. Optionally enter `expected_version` to assert the version you intend to publish. This input does not bump the version.
2. The read-only build job freezes the dispatch commit SHA, verifies versions and release notes, runs the complete gate once, and packages those exact outputs.

   Release artifact staging requires `GIT_EXECUTABLE` to point to a trusted absolute Git executable path; the hosted workflow uses `/usr/bin/git` instead of resolving Git through `PATH`.

3. A separate publication job downloads the verified artifacts. It performs no repository checkout, dependency installation, or project-script execution. It verifies commit/version metadata and all local checksums before touching tags or releases.
4. Publication creates `vX.Y.Z` at the verified commit and a draft GitHub Release. It uploads all three ZIPs and `SHA256SUMS`, verifies their remote bytes, then publishes the draft. It never edits version/changelog files or pushes main.

### Recovery

- If preparation stops after pushing the branch or opening the PR, rerun it with the same version. It reuses existing work and dispatches CI again.
- If publication stops after creating the tag/draft or uploading some assets, use **Re-run failed jobs** on that Release run. The publication job reuses the successful build job's original artifact identity and source SHA. Matching assets are preserved, missing draft assets are uploaded, and conflicting bytes are rejected.
- If all assets were published but the response was lost, retrying verifies the existing release and completes without replacing assets.
- Artifact retention is 14 days. If they have expired, rerun all jobs of the original run to rebuild its frozen source commit. A new dispatch uses the then-current main commit and may be rejected if its version tag points elsewhere.
- A tag pointing to a different commit, a conflicting asset, or changed release notes causes a failure. Investigate the mismatch; workflows never move tags, force-push branches, or overwrite published binaries automatically.

### First hosted run

After merging these workflows, confirm CI's `verify` check is recognized by existing branch rules, preparation can create PRs and dispatch CI, and the publication job can download same-run artifacts. Local tests mock GitHub publication; they do not establish hosted permissions. This implementation does not change repository settings or branch protection, publish a real release, or submit to browser stores.

## Issue Reporting

Use [this fork's issue tracker](https://github.com/cf5146/opencc-extension/issues). Provide reproduction steps & environment details. Screens/GIFs help.

## Security

Use [GitHub private vulnerability reporting](https://github.com/cf5146/opencc-extension/security/advisories/new) to contact this fork's maintainer. Do not disclose sensitive vulnerability details in public issues.

## License

By contributing you agree your work is MIT licensed.
