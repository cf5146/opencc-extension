# Short-node performance acceptance

Run serially on the same machine with an installed Edge and installed Playwright CLI. The runner uses dedicated headless profiles, never an existing user profile. It does not install packages or browsers.

1. Prepare two independent source directories at exact recorded commits. Build each with `npm ci` and `npm run build:edge`. An exported baseline may share an already installed matching dependency tree for the build; record this in provenance. Keep both outputs unchanged during timing.
2. Set these PowerShell environment variables (use your actual absolute paths):

```powershell
$env:SHORT_NODE_LAB = 'C:\bench\short-node-run-1'
$env:SHORT_NODE_BASELINE_ROOT = 'C:\bench\baseline-source'
$env:SHORT_NODE_BASELINE_SHA = 'fd37dac3925092c403ac1f6695a157ec8ec01217'
$env:SHORT_NODE_CANDIDATE_ROOT = 'C:\code\candidate-source'
$env:GIT_EXECUTABLE = 'C:\Program Files\Git\cmd\git.exe'
$env:PLAYWRIGHT_CLI = 'C:\tools\node_modules\@playwright\cli\playwright-cli.js'
node scripts/performance-short-nodes/run.mjs
node scripts/performance-short-nodes/summarize.mjs
```

GIT_EXECUTABLE must name a trusted absolute Git executable path (on Linux, for example, /usr/bin/git); PATH lookup is rejected. The results directory must be fresh. The baseline root must contain `.output/edge-mv3/manifest.json`; the candidate has the same layout. Candidate root defaults to this repository. Baseline SHA is metadata: the caller must build the stated revision; the runner inventories both loaded artifacts and candidate tracked source files so they can be audited. It snapshots both artifacts before timing and refuses to overwrite an existing run.

40 serial Edge sessions run five alternating baseline/candidate trial pairs per mode (`mmseg`, `jieba`) and input (`unique`, `repeated`). Each session records:

- First manual conversion of 1,000 nodes: recorded, not a performance gate. Fresh browser/worker, not an OS-cold guarantee.
- Warm manual conversion of 20,000 new nodes, replacing the first fixture.
- Warm automatic insertion of 1,000 independent `p` roots via one DocumentFragment, after enabling the exact-host rule.

Inputs use `勇敢的士兵在软件开发中心使用鼠标。`, with a decimal index appended for unique inputs. Repeated inputs omit the index, so the two input classes have different byte counts. Repeated warm scenarios may hit the candidate page-local cache populated by the earlier case; unique automatic inputs 0-999 follow manual inputs 0-19999 and are outside the final 2,048-entry LRU working set.

Completion requires a SHA256 match of the entire output array against the frozen baseline official engine for the exact fixture. This checks integration parity, not independent linguistic correctness. Automatic elapsed includes fixture creation, 20 ms debounce, and polling at 20 ms. Manual elapsed is the extension request round trip after fixture creation. Timing windows include 80 ms after completion to collect timer drift. Long Tasks may omit isolated content-script work; zero is not proof of no blocking.

`summary.json`/`RESULTS.md` contain medians and ranges. Every one of eight warm scenario cells must reduce completion median by at least 50% and keep the median of per-trial maximum timer drift <= baseline + 10 ms. The summarizer exits nonzero if any gate fails. No p95 or statistical significance claim is made. A failed session is saved separately; incomplete runs cannot pass summarization.

Firefox runtime, actual browser RAM, real website overlap and simultaneous-tab contention are outside this benchmark. Firefox build/tests are part of the normal project CI. Functional browser checks are recorded separately from timing.

After timing, run `node scripts/performance-short-nodes/functional.mjs` with the same environment for the separate six-check operational validation against the frozen candidate artifact. It uses another dedicated profile and refuses to overwrite existing functional evidence. After saving the observations, it exits nonzero if any expected check fails, is missing, duplicated or renamed.
