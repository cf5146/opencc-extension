# Short-node phase profiling (lab diagnostic copy)

The original Edge build is PR78 9cf612d829fb77adb7c93ffaa498330687806370. Its tracked official modules match later main fd37dac; the artifact was copied before any optimization. Only `instrumented-extension` under this lab was changed. The repository source and `.output` were not edited. `profile-provenance.json` records the instrumented file hashes and distinguishes checkout HEAD from original build HEAD.

Two sequential diagnostic passes ran one trial per mode, unique input only, Edge155.0.4283.62, separate dedicated profiles. First pass: cold1000, warmmanual2000, auto1000roots (`profile-2k.json`). Second pass: cold1000, warmmanual20000, auto1000roots (`profile-20k.json`). All 12 measured cases completed and their entire DOM output hashes matched the exact bundled engine reference. These single instrumented trials are phase diagnostics, not replacement production baselines or statistical evidence.

| Case | elapsed ms | content IPC count / cumulative ms | getContexts count / cumulative ms | Worker conversion ms | collect ms | commit ms | explicit yield count / wait ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| mmseg manual2000 | 61.2 | 16 / 49.9 | 16 / 3.4 | 13.8 | 2.7 | 4.2 | 15 / 2.3 |
| Jieba manual2000 | 101.9 | 16 / 85.6 | 16 / 5.5 | 32.5 | 3.6 | 5.8 | 15 / 3.7 |
| mmseg manual20000 | 3156.8 | 157 / 1491.1 | 157 / 114.9 | 265.8 | 25.1 | 65.4 | 156 / 1556.9 |
| Jieba manual20000 | 4438.2 | 157 / 1877.5 | 157 / 166.1 | 663.6 | 52.8 | 79.2 | 156 / 2407.8 |
| mmseg auto1000 roots, second pass | 3006.7 | 1000 / 2878.6 | 1000 / 395.1 | 72.4 | 11.2 | 22.3 | 0 / 0 |
| Jieba auto1000 roots, second pass | 3503.9 | 1000 / 3372.7 | 1000 / 545.3 | 89.3 | 13.8 | 27.5 | 0 / 0 |

Measured observations support two targeted layers: the 20,000-node path spent about 49% (mmseg) and 54% (Jieba) of elapsed wall time waiting for its 156 explicit setTimeout(0) yields, while automatic independent roots generated 1,000 IPC requests for 1,000 input strings. The latter's content IPC intervals occupied about 96% of completion wall time. These are measured wait intervals, not CPU time. Avoid asserting timer clamping as the sole reason: rendering, scheduling and system load may contribute to each wait.

Every automatic request also called getContexts, confirming the repeated-check hypothesis. However, getContexts consumed approximately14%/16% of the automatic content-IPC cumulative time in the second pass; removing only that lookup cannot support a 50% overall improvement expectation from these observations. Worker map conversion was substantially smaller than the enclosing IPC wall time, so these cases do not currently justify a native interface change before attempting scheduling/batching improvements.

Instrumentation definitions and limitations:

- `collect`: the exact current document-converter's TreeWalker/filter/snapshot expression, including title/body separate calls; no different traversal algorithm.
- `commit`: time inside the exact current per-snapshot commit helper, including unchanged validation, writes and metadata; early invalid-node returns would not be counted. All fixture nodes remained valid here.
- `yieldWait`: wall interval around the existing explicit interbatch setTimeout(0), from scheduling to callback.
- `contentIPC`: wall interval around the current content world's official-convert sendMessage call.
- `officialRequestDuration`: background listener receipt to response callback. This is nested within contentIPC.
- `getContexts`: awaited API call time in current background route. This is nested within officialRequestDuration/contentIPC.
- `workerConvert`: time around existing texts.map(session.convert). It includes JS validation, UTF8 encoding, allocation/copy/free, native conversion and decode, and config initialization for cold requests; it is not pure native CPU. It is nested within IPC.
- Nested durations must not be added together. Context clocks have independent time origins, but elapsed durations are measured within each context.
- Generic counter fields use `totalMs`/`maxMs`; for `officialRequestTexts` and `snapshotCount` those fields contain string counts, not milliseconds. Read these as counters only.
- Counter query/reset happens outside timing windows. Each per-node performance.now/counter operation adds overhead. The original uninstrumented 3-trial baseline remains under sibling `short-node-baseline`.
- Source anchors are checked unique by prepare.mjs before replacement. `run-20k.mjs` uses separate profiles. Reproduction requires rerunning prepare then selecting corresponding workload; current product.snippet is the 20k pass. No dependency install, personal profiles, telemetry, process memory or Firefox runtime is involved.

The instrumented exploratory harness was retained in the local short-node-profile lab, not used to produce final acceptance times. The committed portable runner reproduces the uninstrumented acceptance comparison.
