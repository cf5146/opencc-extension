# Separate Edge operational validation

Headless automated real-browser interaction with the frozen candidate; no product/source instrumentation. These checks run after all timing sessions and do not enter performance medians. No human/manual, IME, actual toolbar-popup lifecycle, Firefox runtime, or subjective latency claim.

- PASS: disable-auto-during-cold-Jieba — Cold conversion start inferred from enabled auto debounce and100ms wait; no internal request pause/hook. Actual DOM remained unchanged throughout observer window.
- PASS: edit-text-during-pending-manual — Confirms unresolved request at edit; no internal snapshot hook.
- PASS: selection-element-identity
- PASS: page-editable-keyboard-while-conversion-pending — Automated click/key/input interaction; no IME or subjective latency claim.
- PASS: popup-keyboard-while-page-request-pending — Automated click/key/input and DOM state check in popup.html extension tab; does not claim human-perceived latency, actual toolbar popup lifecycle, or input-latency measurement.
- PASS: settings-change-invalidates-pending-Jieba-output

Exact observations/responses are retained in functional.json. An unresolved-request check is required before claiming typing/editing overlapped conversion.
