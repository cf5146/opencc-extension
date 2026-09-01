# Manifest V3 Runtime Notes

## Shared WXT targets

Chrome, Edge, and Firefox are built from the same `entrypoints/` and `src/` tree. Build commands pass explicit WXT browser and Manifest V3 flags:

```text
npm run build:chrome
npm run build:firefox
npm run build:edge
```

Generated directories are `.output/chrome-mv3/`, `.output/firefox-mv3/`, and `.output/edge-mv3/`. `npm run dist` writes `opencc.chrome.zip`, `opencc.firefox.zip`, and `opencc.edge.zip` to `.output/`.

## Static content script model

The content script is declared in each generated manifest for `http://*/*` and `https://*/*`, runs at `document_idle`, and is restricted to the top frame. Auto mode enables or disables the observer in that content runtime. It does not register or unregister content scripts at runtime.

When a user requests page conversion and the static script is not listening yet, the background runtime performs at most one `scripting.executeScript` injection using the manifest-declared content-script path, then one message retry. Unsupported or protected pages return a stable unavailable status.

## Background shape

Chromium targets declare a module service worker through `background.service_worker`. Firefox uses the MV3 `background.scripts` array with `type: module` and the existing Gecko extension ID. The background runtime owns context-menu dispatch, badge state, active-tab conversion, and the one-shot fallback. DOM traversal and auto observation stay in the content runtime.

## Permissions

Shipped permissions are `storage`, `contextMenus`, `scripting`, and `activeTab`, plus HTTP/HTTPS host access for the statically declared content script. The broad `tabs` permission is not shipped. The generated artifact verifier checks these permissions, MV3 shape, target background declaration, static content-script settings, popup/options entrypoints, and every referenced file.
