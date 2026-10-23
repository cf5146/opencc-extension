import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "docs/evidence/performance-pr76");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const engine = read("engine.json"),
  products = read("product.json"),
  sizes = read("packages.json"),
  env = read("environment.json");
const variants = ["legacy", "mmseg", "jieba"],
  labels = ["PR 前：自訂 JS", "PR 後：官方 mmseg", "PR 後：官方 Jieba（預設）"];
const median = (a) => {
  const s = [...a].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const range = (a) => `${median(a).toFixed(1)} [${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}]`;
const group = (data, v) => data.filter((x) => x.variant === v);
for (const v of variants) {
  assert.equal(group(engine.samples, v).length, 5);
  assert.equal(group(products, v).length, 5);
  assert.deepEqual(
    group(products, v)
      .map((x) => x.trial)
      .sort(),
    [0, 1, 2, 3, 4],
  );
  for (const s of group(engine.samples, v)) {
    assert.ok(Number.isFinite(s.coldRoundTripMs));
    assert.deepEqual(
      s.rows.map((x) => x.size),
      [100, 10000, 100000, 1000000],
    );
    for (const row of s.rows) {
      assert.equal(row.timesMs.length, 5);
      assert.equal(
        new Set(group(engine.samples, v).map((x) => x.rows.find((r) => r.size === row.size).outputSha256)).size,
        1,
      );
    }
  }
  for (const s of group(products, v)) {
    assert.equal(s.cases.length, 3);
    assert.equal(s.previews.length, 4);
    assert.ok(s.cases.every((x) => x.converted));
    assert.equal(s.cases[0].response.count, 1000);
    assert.equal(s.cases[1].response.count, 20000);
    assert.equal(s.cases[2].response.kind, "no-op");
  }
}
const engineRow = (title, get) =>
  `| ${title} | ${variants.map((v) => range(group(engine.samples, v).map(get))).join(" | ")} |`;
const productRow = (title, get) =>
  `| ${title} | ${variants.map((v) => range(group(products, v).map(get))).join(" | ")} |`;
const tableHeader = `| 指標 | ${labels.join(" | ")} |\n|---|---:|---:|---:|`;
const warm = (v) => median(group(products, v).map((x) => x.cases[1].roundTripMs));
const cold = (v) => median(group(engine.samples, v).map((x) => x.coldRoundTripMs));
const drift = (v) => median(group(products, v).map((x) => x.cases[1].maxTimerDriftMs));
const m = (x) => (x / 1048576).toFixed(2);
const memory = variants
  .map((v, i) => {
    const s = group(engine.samples, v);
    return `| ${labels[i]} | ${m(median(s.map((x) => x.retainedHeap.usedSize)))} | ${m(median(s.map((x) => x.retainedHeap.backingStorageSize)))} | ${v === "legacy" ? "—" : m(median(s.map((x) => x.firstWasmLinearBytes)))} | ${v === "legacy" ? "—" : m(median(s.map((x) => x.wasmLinearBytes)))} |`;
  })
  .join("\n");
const report = `# PR #76：前後效能評估

比較 **${env.baseline.slice(0, 7)} → ${env.head.slice(0, 7)}** 的產品程式碼；效能報告提交不改動產品實作。量測日期 ${env.measuredAt.slice(0, 10)}。

## 結論

官方引擎增加載入成本與資源體積，預設 Jieba 的冷啟動中位數為 **${cold("jieba").toFixed(0)} ms**，舊版為 **${cold("legacy").toFixed(0)} ms（${(cold("jieba") / cold("legacy")).toFixed(1)}×）**。新增 20,000 個節點的完成時間由 **${warm("legacy").toFixed(0)} ms** 變為 mmseg **${warm("mmseg").toFixed(0)} ms**、Jieba **${warm("jieba").toFixed(0)} ms**。這份 PR 應視為官方語意、Jieba 與隔離執行的採用，不能宣稱整體加速。

同一工作負載的最大計時器延遲中位數由 **${drift("legacy").toFixed(0)} ms** 變為 mmseg **${drift("mmseg").toFixed(0)} ms**、Jieba **${drift("jieba").toFixed(0)} ms**。它反映頁面主執行緒與排版／排程停頓；完成時間與回應性須分開判斷。完整原始值、輸出雜湊與逐次結果見 [原始 JSON](evidence/performance-pr76/)。

## 方法與可比性

- ${env.cpu.trim()}，${env.logicalCPUs} logical CPUs，${m(env.totalMemoryBytes / 1024)} GiB RAM；${env.os}；Node ${env.node}；headless Microsoft Edge ${engine.edgeVersion}。同機、同一套鎖定依賴、無 CPU／網路節流；測試期間不並行跑其他測試。系統背景工作仍可能造成波動。
- 每種實作做 5 次試驗，奇偶輪反轉實作順序。引擎層每次建立新 Worker；產品層每次重新啟動專用瀏覽器。這是新執行環境的冷啟動，**不是冷 OS／冷磁碟快取**。
- 舊版明確選 cn→twp；新版明確選 s2twp/mmseg 或 s2twp/Jieba。**三者不保證輸出相同**：舊版與官方 mmseg 的首次範例為「${group(engine.samples, "legacy")[0].firstOutput}」／「${group(engine.samples, "mmseg")[0].firstOutput}」，Jieba 為「${group(engine.samples, "jieba")[0].firstOutput}」。同一實作各輪的完整輸出 SHA-256 必須一致；不把不同語意當作等價演算法速度競賽。
- 表格時間單位 ms，為 **5 次試驗的中位數 [最小–最大]**；沒有用 5 次樣本宣稱統計顯著或 p95；0.0 代表低於顯示精度，不代表零成本。引擎暖機每個新 Worker、每種長度先跑 1 次，再取 5 次的中位數，表中再彙整 5 個 Worker。純引擎不使用產品字串結果快取。
- 引擎層以固定混合文字「勇敢的士兵在软件开发中心使用鼠标。 OpenCC 」重複／裁切至指定 UTF-16 長度。舊版精確基準來源被打包為 Worker 載入，官方 runtime／WASM／資料逐位元組複製自被評估的 Edge 包；這層比較引擎成本，**不是舊版的實際主執行緒配置**。
- 產品層使用真正的未修改擴充功能：先建立 1,000 段唯一文字作首次頁面轉換，再在同頁新增 20,000 段文字、再次轉換，最後做未變更 no-op。所有節點必須完成轉換。此層涵蓋設定讀取、遍歷、背景／offscreen／Worker 訊息與 DOM 提交；回傳 round-trip 不包含事先建立 fixture 的時間。新頁面首次轉換不先暖機引擎。
- 頁面 4 ms 計時器的最壞漂移從請求前量到回應後 80 ms，故包含提交後排版、計時器夾制與系統排程；它**不是純 JS task duration 或輸入延遲保證**。Long Tasks observer 在此隔離 content-script 測試未產生可用紀錄，不能將其 0 解讀為沒有阻塞，故不以該數據作結論。

## 引擎層

${tableHeader}
${engineRow("新 Worker 到首次結果（含模組載入／初始化）", (x) => x.coldRoundTripMs)}
${engineRow("初始化（舊版含 trie 建立；官方配置首次建立另列）", (x) => x.initMs)}
${engineRow("首次實際 convert", (x) => x.firstMs)}
${[100, 10000, 100000, 1000000].map((size) => engineRow("暖機 " + size.toLocaleString("en-US") + " UTF-16 單位", (x) => median(x.rows.find((r) => r.size === size).timesMs))).join("\n")}

## 真實產品路徑

${tableHeader}
${productRow("首次 1,000 節點：訊息往返", (x) => x.cases[0].roundTripMs)}
${productRow("新增 20,000 節點：訊息往返", (x) => x.cases[1].roundTripMs)}
${productRow("同頁未變更 no-op：訊息往返", (x) => x.cases[2].roundTripMs)}
${productRow("首次 1,000 節點：最大計時器漂移", (x) => x.cases[0].maxTimerDriftMs)}
${productRow("新增 20,000 節點：最大計時器漂移", (x) => x.cases[1].maxTimerDriftMs)}
${[100, 10000, 100000, 1000000].map((size) => productRow("Popup " + size.toLocaleString("en-US") + " UTF-16 單位：輸入至結果", (x) => x.previews.find((r) => r.size === size).inputToResultMs)).join("\n")}

Popup 轉換在頁面測試後量測，故其引擎已暖機；數字包含兩版均存在的 **250 ms debounce**、輸入／輸出處理與 IPC，不能當成純引擎速度。原始資料的 popupReadyMs 只等待 textarea 可用，兩版初始化方式不同，不能視為等價的完整 UI readiness，因此不列入前後比較。

百萬字 Popup 是刻意的極端 UI 工作負載：三種實作的觀測均達約 20 秒量級（範圍見表），遠高於純引擎耗時；結果涵蓋 textarea／訊息／排程等整體成本，未單獨量測排版或文字控制項，不應把全部延遲歸因於轉換演算法。

原始碼上，舊版在 content script 同步執行轉換；新版每批最多 128 個節點，逐批透過 background／offscreen／Worker 並讓出主執行緒，20,000 個新節點需要 157 批。IPC、分批提交與讓出排程可能累積成本；本測試未將各項耗時單獨分解，這是程式結構支持的解釋，並非額外因果量測。

## 記憶體與包體

每個引擎 Worker 完成百萬字工作負載後，透過 CDP 強制 GC，再讀取 [Runtime.getHeapUsage](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-getHeapUsage)。這是隔離引擎的保留用量，**不是瀏覽器總 RSS、峰值或全產品跨頁總量**。WASM 數字由 runtime 的線性記憶體 buffer 直接回報；JS heap、backing storage 與 WASM 分列，**不相加成單一總量**。

| 實作 | GC 後 JS used heap MiB | GC 後 backing storage MiB | 首次轉換後 WASM MiB | 百萬字後 WASM MiB |
|---|---:|---:|---:|---:|
${memory}

舊版 JS 引擎沒有 WASM 線性記憶體，並不代表零記憶體。新版 Worker 終止後可回收其資源；60 秒閒置、配置切換與錯誤的終止政策，意味下次可能重新付出冷啟動成本。本測試未等滿 60 秒量測閒置後再次請求。

| Edge 包 | PR 前 | PR 後 | 比例 |
|---|---:|---:|---:|
| 完整未壓縮檔案總和 | ${sizes.baseline.unpackedBytes.toLocaleString("en-US")} bytes | ${sizes.head.unpackedBytes.toLocaleString("en-US")} bytes | ${(sizes.head.unpackedBytes / sizes.baseline.unpackedBytes).toFixed(2)}× |
| 同一 createZip 實作產生的完整 ZIP | ${sizes.baseline.zipBytes.toLocaleString("en-US")} bytes | ${sizes.head.zipBytes.toLocaleString("en-US")} bytes | ${(sizes.head.zipBytes / sizes.baseline.zipBytes).toFixed(2)}× |

包含引擎、資料、manifest、產品程式碼與授權告示；沒有用逐檔 gzip 相加代替完整 ZIP。包體只量 Edge；未從這組資料推論 Chrome／Firefox 的實際執行效能。

## 判斷

- 若接受官方引擎／Jieba 的行為及離線資料成本，這份 PR 的取捨可被明確審查；**不能以改善整體速度作合併理由**。
- mmseg 能降低首次使用成本，但在本組大量短節點測試中仍比舊版慢，不能把切換模式當作完整的效能修復。
- 冷啟動與大量短節點的完成時間、Worker 的線性記憶體及包體，是主要需要接受的成本。前景頁面回應性應依上表漂移量測判斷，不能只看背景引擎耗時。
- 本次只評估並記錄，不改寫／調參產品程式碼。後續若要優化，應沿用相同工作負載驗證完整輸出及取消語意，避免以改分詞模式、截斷輸入或取消驗證換取速度。

## 重現

1. 使用基準 ${env.baseline} 的 git archive 解壓到專用 PERF_LAB/baseline；用該版本 package-lock 安裝依賴。以相同依賴版本在基準及被評估 head 各執行 npm run build:edge。此輪兩份 package-lock 相同，基準透過本機 junction 共用已安裝依賴；沒有對原 checkout 的未提交變更操作。
2. 設 PERF_LAB 為專用絕對路徑，PLAYWRIGHT_CLI 為已安裝 @playwright/cli 的 JavaScript 入口；從 repo 執行 node scripts/performance-pr76/run.mjs。需要已安裝 Microsoft Edge；profile 與 fixture 只存於專用目錄，不讀取使用者網頁／profile。完整實驗應用新的專用目錄重跑，不能平行量測。
3. 將 environment.json、engine.json、product.json、packages.json 放入 docs/evidence/performance-pr76，再執行 node scripts/performance-pr76/summarize.mjs。腳本會驗證各實作的輪數、輸出雜湊穩定性與頁面完成數。
`;
fs.writeFileSync(path.join(root, "docs/pr76-performance.md"), report);
const summary = {
  baseline: env.baseline,
  head: env.head,
  coldEngineMs: Object.fromEntries(variants.map((v) => [v, cold(v)])),
  warm20000NodesMs: Object.fromEntries(variants.map((v) => [v, warm(v)])),
  warm20000MaxTimerDriftMs: Object.fromEntries(variants.map((v) => [v, drift(v)])),
  sizes,
};
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
