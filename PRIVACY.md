# Privacy Policy

OpenCC Browser Extension ("the extension") processes page content locally in your browser to convert between Chinese text variants. It does not:

- Collect or transmit browsing history.
- Send page contents or converted text to any remote server.
- Use analytics, tracking scripts, or third-party advertising networks.

Permissions explanation:

- `storage`: Stores local preferences such as origin/target variants, auto mode, whitelist patterns, and textbox size.
- `activeTab`: Allows user-initiated page conversion in the active tab.
- `scripting`: Allows one-shot fallback injection into the active tab when a statically declared content script was missed.
- `contextMenus`: Provides the right-click action that converts a selected text range.
- HTTP/HTTPS host access: Allows the statically declared content script to run auto mode on ordinary web pages.

The extension does not ship the broad `tabs` permission. Chrome, Edge, and Firefox use the same WXT source tree with target-specific Manifest V3 output; page content is processed locally in the browser.

No personal data leaves your device. If you have questions or concerns, open an issue in the repository or contact the author listed in `package.json`.

MIT Licensed.
