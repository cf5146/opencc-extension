# Short-node conversion performance

## Result and frozen revisions

The warm short-node regression is improved in all eight agreed cells. Baseline `fd37dac3925092c403ac1f6695a157ec8ec01217` and candidate `6adc025f4af62bc7c766e354e8227423624f50d6` were clean-built with the same installed dependency tree, snapshotted, and measured serially in Edge 155.0.4283.62 on the same machine. The candidate commit contains all product changes; subsequent report/test/harness-only changes do not alter the measured product.

Five alternating baseline/candidate trial pairs per engine/input class produced **40 sessions / 120 complete cases**. Every full output array SHA256 matches the frozen official baseline engine reference. All outliers are retained; no failed samples were replaced. This establishes integration parity for these inputs, not an independent linguistic oracle or statistical significance.

Median milliseconds:

| Workload                  | Mode  | Input    | Baseline | Candidate | Reduction |
| ------------------------- | ----- | -------- | -------: | --------: | --------: |
| Manual warm 20,000 nodes  | mmseg | unique   |   3603.3 |     896.8 |     75.1% |
| Manual warm 20,000 nodes  | mmseg | repeated |   4050.1 |     339.6 |     91.6% |
| Manual warm 20,000 nodes  | Jieba | unique   |   4621.7 |     941.8 |     79.6% |
| Manual warm 20,000 nodes  | Jieba | repeated |   4277.9 |     468.4 |     89.1% |
| Automatic 1,000 new roots | mmseg | unique   |   2189.7 |      74.2 |     96.6% |
| Automatic 1,000 new roots | mmseg | repeated |   2499.5 |      42.3 |     98.3% |
| Automatic 1,000 new roots | Jieba | unique   |   2837.1 |      67.9 |     97.6% |
| Automatic 1,000 new roots | Jieba | repeated |   3269.3 |      47.6 |     98.5% |

All eight completion medians decrease by at least 50%. The median of per-trial maximum page timer drift changes by **-26.5 to +0.8 ms**, passing the <= baseline + 10 ms requirement in every warm cell. This proxy does not prove input latency or universal smoothness. [Full ranges and drift results](evidence/short-node-performance/measurements.md), [machine-readable gates](evidence/short-node-performance/summary.json).

## Diagnosis and change

Instrumented exploratory copies of the pre-change build showed 157 requests and 156 explicit timer yields for 20,000 nodes. Yield waits occupied approximately 49%/54% of the mmseg/Jieba diagnostic completion time. Automatic insertion of 1,000 independent roots caused 1,000 requests; the content IPC intervals occupied about 96% of elapsed time. Repeated offscreen getContexts queries were measurable but accounted for only about 14%/16% of automatic IPC wall time, so that lookup alone could not explain a 50% fix. Nested times must not be added or treated as pure CPU time. [Diagnostic methods and numbers](evidence/short-node-performance/profiling.md), [20k diagnostic data](evidence/short-node-performance/profile-20k.json).

The product changes are limited to the integration layer:

- One shared 1,024-text request limit replaces 128, reducing request/yield counts while retaining the character threshold and interbatch yield. The character threshold remains a soft batch threshold; single long nodes are not split.
- Pending automatic roots are collected together; each Text remains an independent conversion input. Repeated/overlapping Text nodes are deduplicated.
- A page-local LRU reuses exact original strings under the full configuration, with within-batch deduplication. It holds at most 2,048 entries / 524,288 accounted UTF16 key+value bytes, skips oversized results, and clears on disposal. Canceled responses cannot repopulate a cleared cache. These are payload bounds, not measured total JavaScript RAM.

Selection commits remain atomic. Current text, parent, exclusions, settings/generation and URL are checked before writes. No cross-tab or persistent cache, engine downgrade, node-string concatenation, native interface, engine resources or offscreen lifecycle change is included.

## Workload and reproduction

See [portable runner instructions](../scripts/performance-short-nodes/README.md). The runner snapshots loaded files, records source/build hashes and exact revisions, saves each session immediately, and rejects incomplete runs. The summarizer exits nonzero for a failed gate.

Inputs are `勇敢的士兵在软件开发中心使用鼠标。` plus a decimal index for unique strings; repeated inputs omit the index. Manual warm fixtures replace the initial 1,000 nodes with 20,000 nodes. Automatic fixtures insert 1,000 independent `p` roots in one fragment after enabling the exact-host rule. Automatic elapsed includes fixture creation, debounce and polling; manual elapsed excludes fixture creation. Warm repeated scenarios can reuse the candidate cache populated earlier on that page. Unique automatic strings 0-999 are outside the final 2,048-entry LRU working set of the previous manual case. Unique inputs also pass the improvement gates, so the result does not rely solely on repeated cache hits.

This workload differs from the earlier PR76 report, whose 20,000-node fixture was appended to the first 1,000 nodes. Do not interpret differences between those reports as changes to the same benchmark.

Raw evidence: [results](evidence/short-node-performance/results.json), [reference hashes](evidence/short-node-performance/expected.json), [provenance and artifact hashes](evidence/short-node-performance/provenance.json), [completion](evidence/short-node-performance/completion.json).

## Correctness and operational validation

The measured candidate's initial `npm run ci` passes: **258 tests**, lint/typecheck, all three MV3 builds, generated artifact checks and 32 official resource hashes. Focused regression tests cover independent node strings, page/config cache separation, entry/byte LRU limits, oversized/invalid responses, canceled cache refill, automatic additions during an in-flight batch, and existing selection/DOM safety contracts.

Six separate headless Edge checks pass: actual click/keyboard typing in a page input and popup.html while page conversion is still pending; selected element identity; editing the same Text during a pending request; changing settings during pending Jieba; disabling automatic conversion during cold Jieba. [Exact observations](evidence/short-node-performance/functional.json), [operational method and limits](evidence/short-node-performance/functional.md). These are automated browser interactions, not subjective human latency, IME or real toolbar-popup lifecycle tests.

The initial read-only review independently recomputed the eight warm acceptance gates from raw results. A later review found that the operational CLI could exit successfully on failed browser checks; the follow-up preserves evidence, then rejects failed, missing, duplicate or renamed checks. Nine CLI regression tests cover that guard and trusted absolute Git selection. Summary gate math and the measured product remain unchanged.

## Cold-start and scale limits

Cold first-1,000-node cases were recorded separately and were not performance gates:

| Mode/input     | Baseline median ms | Candidate median ms | Observation  |
| -------------- | -----------------: | ------------------: | ------------ |
| mmseg unique   |              319.8 |               345.1 | 7.9% slower  |
| mmseg repeated |              348.7 |               303.2 | 13.0% faster |
| Jieba unique   |             3026.6 |              1834.3 | 39.4% faster |
| Jieba repeated |             2581.1 |              2777.3 | 7.6% slower  |

Cold Jieba maximum-timer-drift medians increase by 10.9/13.2 ms for unique/repeated inputs. These cold observations must not be presented as passing the warm responsiveness gate or as a universal cold-start improvement. Ranges are broad and no significance claim is made.

Firefox runtime is unverified because Firefox is not installed; Firefox build/automated checks pass. Actual heap/RAM, real websites, simultaneous-tab contention, IME and arbitrary-scale responsiveness are unmeasured. Automatic root collection remains synchronous before the first request; 100k roots or adversarial overlapping subtrees may postpone yielding. The reviewer did not establish a material regression at those unmeasured scales; this report limits claims to the measured fixtures rather than assuming equivalent behavior there.
