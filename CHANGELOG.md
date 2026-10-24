# Changelog

版本紀錄 / Version history。最新發布輸入見 [CHANGELOG_RELEASE.md](./CHANGELOG_RELEASE.md)。
Current publication input: [CHANGELOG_RELEASE.md](./CHANGELOG_RELEASE.md).

## v0.6.1 - 2026-10-23

[比較版本 / Compare changes](https://github.com/cf5146/opencc-extension/compare/v0.6.0...v0.6.1)

### 候選狀態 / Candidate status

供審查與測試；尚不代表建立標籤、公開 Release、商店上架或 Firefox 簽署。Chrome／Firefox 有建置檢查，Firefox 實機驗收仍待完成。
Prepared for review and testing. This does not create a tag, publish a release, submit to stores, or sign Firefox packages. Chrome/Firefox have build checks; Firefox runtime acceptance remains open.

- 採用官方 OpenCC 1.4.2、離線字典與 WASM Jieba，提供五種預設組態；預設 s2twp/Jieba，mmseg 可手動選擇。
  Adopt official OpenCC 1.4.2, offline dictionaries, and WASM Jieba with five presets; default to s2twp/Jieba with mmseg as an explicit alternative.
- 以序列化 Worker 執行轉換，Chromium 使用 offscreen document，Firefox 使用背景頁面。文字與模型留在本機。
  Run conversions in a serialized Worker using a Chromium offscreen document or Firefox background page. Text and models stay local.
- 批次處理短文字與自動轉換根節點，使用有上限的頁面本機快取；歷史量測與限制見[效能證據](./docs/short-node-performance.md)。
  Batch short text and automatic roots with a bounded page-local cache; see [performance evidence](./docs/short-node-performance.md) for historical measurements and limits.
- 丟棄過時的文字、選取範圍、網址或設定結果，保留元素與事件處理器，保護輸入法組字及非同步預覽。
  Discard stale text, selection, URL, or settings results; preserve elements and handlers, IME composition, and asynchronous preview correctness.
- 採 officialOpenCC 第 2 版獨立設定，逐主機重新啟用自動轉換；舊設定保留但不套用。已轉換頁面切換組態須重新載入。
  Use separate version-2 officialOpenCC settings with exact-host opt-in; legacy settings remain stored but are not applied. Reload converted pages before changing configuration.
- 由 cf5146 獨立維護並保留 Tony Chan 原始聲明。Firefox ID 改為 opencc-extension@cf5146，未確認 AMO 識別或提供已簽署 XPI；原商店安裝不自動移轉。
  Independently maintained by cf5146 with Tony Chan’s attribution retained. Firefox uses opencc-extension@cf5146 without AMO confirmation or a signed XPI; original store installations do not migrate automatically.
- 移除有風險的選用 web-ext 啟動器依賴鏈；開發模式維持編譯與監看，改為手動載入。見[依賴評估](./docs/dependency-risk-assessment.md)。
  Remove the risky optional web-ext launcher dependency chain. Development still compiles and watches; load manually. See the [dependency assessment](./docs/dependency-risk-assessment.md).

### 已知限制 / Known limits

Chrome／Edge 需要 runtime.getContexts（116+）。Jieba 首次初始化可能需數秒，歷史量測約 111 MiB WASM 線性記憶體，另有程序與暫存成本；大型輸入可能持續增長至 Worker 終止。
Chrome/Edge require runtime.getContexts (116+). Jieba initialization may take seconds; a historical measurement used about 111 MiB WASM linear memory, excluding process and transient overhead. Large inputs can grow memory until Worker termination.

文字節點之間不共享語境；內嵌 NUL 及不合法 UTF-16 會拒絕。頁面失敗時已完成批次仍維持轉換，待處理原文保留。歷史量測有兩個冷啟動情境約慢 8%，更大的根節點集合尚未量測。
Context does not cross Text-node boundaries. Embedded NUL and malformed UTF-16 are rejected. On page failure, completed batches remain converted and pending originals stay intact. Two historical cold-start cells were about 8% slower; larger root sets remain unmeasured.

## v0.6.0 - 2026-10-18

[比較版本 / Compare changes](https://github.com/cf5146/opencc-extension/compare/v0.5.11...v0.6.0)

- 改善動態文字轉換，重整彈出視窗、設定、CI 與發布流程。
  Improved dynamic text conversion and redesigned the popup, settings, CI, and release workflows.
- 修復介面配置、依賴升級相容性及安全／可靠性檢查問題，更新開發相依套件。
  Fixed interface layout, dependency-upgrade compatibility, and security/reliability check issues; updated development dependencies.

## v0.5.11 - 2026-09-01

[比較版本 / Compare changes](https://github.com/cf5146/opencc-extension/compare/v0.5.10...v0.5.11)

- 採用 WXT，統一 Chrome、Firefox 與 Edge 的 Manifest V3 建置。
  Adopted WXT for shared Chrome, Firefox, and Edge Manifest V3 builds.
- 分離瀏覽器平台 API、背景與內容執行流程，以及自動轉換控制器。
  Separated browser platform APIs, background/content runtimes, and the automatic conversion controller.
- 改善建置產物驗證、錯誤處理、CI 與相依套件。
  Improved artifact validation, error handling, CI, and dependencies.
