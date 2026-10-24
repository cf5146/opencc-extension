# 專案代理指引 / Repository Agent Instructions

## 文件入口 / Documentation

使用者行為見 [README](../README.md)；修改執行流程先讀 [MV3_NOTES](../MV3_NOTES.md)；修改開發、CI 或發布先讀 [CONTRIBUTING](../CONTRIBUTING.md)；用語採用 [GLOSSARY](../GLOSSARY.md)。
Read [README](../README.md) for user behavior, [MV3_NOTES](../MV3_NOTES.md) before runtime changes, and [CONTRIBUTING](../CONTRIBUTING.md) before development, CI, or release changes. Use [GLOSSARY](../GLOSSARY.md) terminology.

## 程式邊界 / Code boundaries

- 正式入口使用 src/application/official/；舊同步模組僅供回歸參考。追蹤實際 entrypoints 匯入，避免將舊引擎誤認為正式路徑。
  Production entrypoints use src/application/official/. Legacy synchronous modules are regression references. Follow entrypoint imports to identify the active engine.
- Worker、offscreen 與 WASM 位於 public/opencc/；重建與鎖定資訊見 scripts/opencc-feasibility/README.md 及 artifact-lock.json。維持產物雜湊及第三方聲明。
  Worker, offscreen, and WASM files live under public/opencc/. Consult scripts/opencc-feasibility/README.md and artifact-lock.json for rebuilds and pins. Preserve artifact hashes and third-party notices.
- 自動轉換採逐主機 opt-in 與 officialOpenCC 第 2 版設定；舊語言配對、全域開關與正規表示式不套用。
  Automatic conversion uses exact-host opt-in and version-2 officialOpenCC settings. Legacy locale pairs, global toggles, and regex rules are not applied.
- DOM 非同步結果須驗證快照、網址、組態與取消狀態；選取轉換保留元素與事件處理器。單一 Text 節點維持完整輸入。
  Validate snapshots, URL, configuration, and cancellation before committing asynchronous DOM results. Preserve selection elements and event handlers; keep each Text-node input whole.
- 快取僅限頁面本機且有大小上限；瀏覽器訊息維持 callback-only Chromium 相容性。
  Keep caches page-local and bounded; preserve callback-only Chromium messaging compatibility.
- 保留使用者既有修改，新增文件採繁體中文與英文對照。
  Preserve existing user changes and write new documentation in Traditional Chinese and English.

## 驗證 / Verification

行為變更執行相關回歸測試及 npm run ci；引擎變更另執行原生 parity 與實機驗證。僅文件變更核對格式、連結、程式一致性與發布標題契約。
Run relevant regression tests and npm run ci for behavior changes. Engine changes also require native parity and browser checks. For documentation-only changes, check formatting, links, consistency with code, and release-heading contracts.

歷史效能數字須連到方法與證據，不得當成本次測量。GitHub 產物、建置檢查、實機驗證及商店簽署各自獨立，回報時精確區分。
Link historical performance figures to their methods and evidence rather than presenting them as current measurements. Distinguish GitHub artifacts, build checks, runtime acceptance, and store signing.
