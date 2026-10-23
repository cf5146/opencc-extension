# Maintainer and release identity

## Project ownership and attribution

- Maintainer and repository owner: [cf5146](https://github.com/cf5146).
- Source and support: [cf5146/opencc-extension](https://github.com/cf5146/opencc-extension), [issues](https://github.com/cf5146/opencc-extension/issues), [private security reports](https://github.com/cf5146/opencc-extension/security/advisories/new).
- Original extension: [tnychn/opencc-extension](https://github.com/tnychn/opencc-extension), by Tony Chan. Its original [MIT copyright and license](../LICENSE.txt) are preserved and copied into each browser package as `LICENSE.txt`; package contributors and Git history retain attribution.
- Conversion-engine upstream: [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC). The pinned engine, models and build dependency notices remain in [third-party notices](../public/opencc/THIRD_PARTY_NOTICES.md).

This is independently maintained software. The repository does not imply that Tony Chan or BYVoid publishes or supports this fork. Existing historical changelogs, benchmark snapshots and original-source links remain historical records.

## Distribution status

| Channel                | Identity and status                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub                 | [cf5146/opencc-extension/releases](https://github.com/cf5146/opencc-extension/releases); the existing release workflows publish here |
| Chrome Web Store       | No verified listing for this fork is linked or configured in this repository                                                         |
| Microsoft Edge Add-ons | No verified listing for this fork is linked or configured in this repository                                                         |
| Firefox / AMO          | New configured ID: `opencc-extension@cf5146`; not submitted, registered or signed                                                    |

A GitHub Release ZIP is a build artifact, not a signed Firefox XPI or a browser-store approval. The existing workflows do not submit to browser stores or contain an AMO signing configuration. Browser publisher accounts, credentials and listing ownership remain separate from GitHub repository ownership.

## Firefox identity

`src/build/manifest.ts` defines the stable new ID `opencc-extension@cf5146`. It is an add-on identifier, not a contact email address. It replaces the original author's `opencc.extension@tnychn` only for this fork's future builds; it does not claim control of the original add-on or store listing.

Firefox MV3 requires a developer-chosen ID before signing; the ID can be set locally before applying. AMO checks uniqueness during first submission/signing. The chosen string has not been reserved or confirmed available. See [Mozilla's ID documentation](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/) and [manifest ID format](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings#id).

An ID change creates a separate add-on identity, including its own updates and storage. There is no automatic migration from the original author's add-on. The existing legacy-settings retention applies within one extension's storage, not across different add-on IDs. Once the new ID is accepted for signing, keep it stable for subsequent updates.

The Firefox manifest also declares `data_collection_permissions.required: ["none"]`, matching local conversion and local settings without transmitting data outside the extension for storage or processing. Mozilla requires the declaration for new AMO submissions; local access to page text is still part of conversion. Review this declaration if future behavior introduces external data transmission. See [Mozilla's manifest documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings#data_collection_permissions).

## Before the first Firefox submission

1. Set up the intended maintainer's AMO publisher account and confirm the ID is accepted on first submission/signing. If unavailable, choose and review a replacement before distributing a signed build.
2. Confirm listing name, support links, privacy/data declarations, license notices and reviewer build instructions match this repository.
3. Build and verify the Firefox target, then run Firefox runtime checks. Signing/store review is separate from the build-only checks currently recorded.
4. Choose listed or unlisted AMO distribution and complete the signing/review process. Add the verified listing link only after it exists; retain the accepted ID for future versions.

This identity change does not bump a release version, create a store account, submit a package, sign an XPI or publish a release.
