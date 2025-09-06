# Manifest V3 Migration Notes

Changes applied:

1. Background script adapted for service worker restarts (idempotent context menu setup at top-level + onInstalled).
2. Manifest already on version 3 for Chrome/Edge; Firefox MV3 manifest kept separate with classic scripts field.
3. Converted build to emit ES module scripts; `background.ts` used as service worker in Chromium browsers.
4. All long-running logic avoided in background; content script performs DOM work. Background only handles context menu + badge state.
5. Reduced permission scope: removed `tabs`, restricted content script matches to http/https, added explicit `host_permissions` for those schemes.

Potential follow-ups:

- Add `alarms` permission if future periodic tasks needed (e.g., refreshing conversion dictionaries).
- Replace tabs permission with `activeTab` if only current tab messaging is required (verify popup flows first).
	*Current state:* `tabs` removed; verify popup still functions for active page conversion (active tab query still allowed without full permission in MV3 when extension has action context, else consider adding `activeTab`).
- Consider offscreen document if future heavy processing requires DOM APIs not available in service worker.
- Implement messaging channel health checks (retry sendMessage on tab reload).

Testing checklist:

- Context menu appears after install and after browser restart.
- Badge shows 'A' when auto mode enabled and clears when disabled.
- Selection conversion still works via context menu.
- No errors in `chrome://extensions` service worker log.
