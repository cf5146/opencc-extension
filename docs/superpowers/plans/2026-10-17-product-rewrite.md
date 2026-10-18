# OpenCC product and auto-conversion rewrite

Approved in chat on October 17, 2026. Implement without replacing TypeScript, WXT, the OpenCC engine, or browser support.

## Deliverables

1. Correct load-more conversion: manual requests inspect new content; cached nodes are invalidated by text changes.
2. Replace mutation fallback body scans and repeated recursive subtree checks with a deduplicated queue. Yield after 8ms or 200 visited DOM nodes per task; discard detached work; cancel on disable, route changes, failure, or disposal. Reenable scans eligible content accumulated while disabled.
3. Bound shared conversion output caches to 512 strings / 65,536 characters per locale pair; do not retain strings longer than 4,096 characters. Keep live-node metadata weakly referenced and content-aware.
4. Persist exact-host Always/Never overrides, inheriting the global default when absent. Exclusions and the Chinese-language safeguard retain precedence; manual actions remain available. Normalize HTTP/S hostnames consistently.
5. Route extension-page settings changes through a background-owned serialized queue, including atomic per-host edits. Preserve existing keys and regex semantics, ignore malformed stored patterns, and reject invalid edited patterns.
6. Rewrite popup and options using accessible vanilla HTML/CSS. Keep original textbox input separate from its result, support IME, copy/clear/swap, truthful failures/retry, configured-policy explanations, and live settings updates without losing dirty edits.

## Verification

Regression tests for conversion invalidation, manual load-more, streaming existing-node changes, queue work bounds/dedup/cancellation/routes, settings migration/concurrency, and UI persistence/IME/failure handling. Run npm run ci for lint, types, tests, and verified Chrome/Firefox/Edge MV3 builds. Inspect rendered popup/options and repeat browser load-more/performance probes.

## Boundaries

No cloud features, telemetry, text persistence, new UI framework, undo, automatic language detection, per-site language pairs, or dictionary replacement. Queue limits are cooperative: one converter call or first dictionary initialization may exceed the time budget. No publish, push, or merge requested.
