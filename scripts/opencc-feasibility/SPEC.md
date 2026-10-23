# Official OpenCC WASM feasibility

Approved scope: existing repository; official OpenCC ver.1.4.2 (025f371dc76b598d77384fbdab90c937471844d8), matching Jieba source/resources; WSL project-only pinned tools; Edge validation. Five configurations: s2t, s2tw, s2twp, s2hk, tw2sp, each with mmseg and Jieba. Preserve complete text, test 100,000 and 1,000,000 characters without arbitrary chunking, truncation or mode fallback. Report initialization, conversion, artifact size and available memory metrics. No production UI/DOM changes, deployment or release.

Later product decisions (not implemented here): Jieba default, manual mmseg alternative, s2twp initial preset; popup/page/selection/dynamic auto modes; per-Text DOM conversion; opt-in exact-host settings; offline packaged resources; errors preserve pending original text and never silently switch segmentation. Updates explicitly pin sources and generate manifest, gated by CI.

Reproducibility means fixed source/tool/resource identities and a documented build; bit-identical builds are not assumed.
