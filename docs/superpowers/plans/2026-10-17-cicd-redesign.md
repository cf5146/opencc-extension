# CI/CD redesign implementation plan

Approved request: CI -> Prepare release PR -> manually publish merged release. Preserve the existing application rewrite.

## Tasks and ownership

1. CI and packages: retain CI/verify; one Node 24 setup and full gate; package existing three MV3 outputs without rebuilding; sorted ZIP entries, validated manifests/checksums, fourteen-day artifacts. Declare zero-zip directly and add immutable release-artifact metadata.
2. Preparation: manual main-only version/notes inputs, next patch or validated override, actual repository changelog links, release branch and PR reuse without overwriting edits, explicit CI dispatch. Never push main, autoapprove, or merge.
3. Publication: manual main-only frozen SHA, optional expected version, read-only build/package job, separate write-only publication job with no checkout/dependency install/project scripts. Tag conflict checks, draft-first publication, byte-verified assets, preserve matching assets and reject conflicts, safe reruns.
4. Integrate and verify: workflow static checks/actionlint; temporary Git remote and mocked API tests; full gate plus packaging; contributor/recovery docs. Hosted permissions/check recognition require first hosted execution and are not silently changed here.

## Interfaces

- package:built -> .output/opencc.{chrome,firefox,edge}.zip and .output/SHA256SUMS.
- scripts/release-artifacts.mjs -> .output/release-artifacts with ZIPs/checksums/CHANGELOG_RELEASE.md/release-metadata.json. Metadata: version, commit, sha256 mapping three ZIP names plus release notes to their hashes. Environment: EXPECTED_VERSION (optional), GITHUB_SHA (frozen commit). Step output: version.
- Publication embeds trusted code in the workflow rather than executing downloaded or repository scripts. Tests extract and execute that exact script against mocked GitHub APIs.

## Constraints and defaults

- Existing browser filenames, targets, CI job name, main/dev push and main PR triggers retained. Explicit workflow_dispatch added.
- Official Actions pinned to verified full commits; Node 24, npm ci --ignore-scripts, explicit WXT prepare.
- Preparation permissions: contents/write, pull-requests/write, actions/write. CI/build contents/read; publication contents/write only.
- No browser-store submission, remote settings edits, real release, push, or PR creation during local implementation.
- No changes to application source required for this task.
