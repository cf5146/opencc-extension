# OpenCC 瀏覽器擴充功能 / OpenCC Browser Extension

由 [cf5146](https://github.com/cf5146/opencc-extension) 獨立維護，源自 Tony Chan 的擴充功能，採用官方 BYVoid/OpenCC 1.4.2 與 WebAssembly Jieba。引擎、字典及模型皆隨擴充功能提供，文字在本機處理。
Independently maintained by [cf5146](https://github.com/cf5146/opencc-extension), based on Tony Chan’s extension, using official BYVoid/OpenCC 1.4.2 and WebAssembly Jieba. Engine, dictionaries, and models are bundled; text is processed locally.

## 取得與安裝 / Distribution and installation

從本儲存庫的 [Releases](https://github.com/cf5146/opencc-extension/releases) 取得產物，或依[貢獻指南](./CONTRIBUTING.md)自行建置。此獨立版本未提供已驗證的 Chrome、Edge 或 Firefox 商店連結。
Get artifacts from this repository’s [Releases](https://github.com/cf5146/opencc-extension/releases), or build using the [contributing guide](./CONTRIBUTING.md). No verified Chrome, Edge, or Firefox store listing is provided for this independently maintained version.

Firefox ID 為 opencc-extension@cf5146，尚未經 AMO 提交或簽署。舊版安裝與設定不會跨 ID 自動移轉；ZIP 不代表一般 Firefox 可安裝的已簽署版本。詳細所有權與上架事項見[維護與發布識別](./docs/maintainer-and-release-identity.md)。
The Firefox ID is opencc-extension@cf5146 and has not been submitted to AMO or signed. Old installations and settings do not migrate across IDs; a ZIP is not a signed package for ordinary Firefox installations. See [maintainer and release identity](./docs/maintainer-and-release-identity.md).

Chrome／Edge 需要 runtime.getContexts（116+）。Chrome、Firefox 有建置檢查，歷史實機驗證以 Edge 為主；這不代表目前各瀏覽器均已通過實機驗收。
Chrome/Edge require runtime.getContexts (116+). Chrome and Firefox have build checks; historical live-browser evidence primarily covers Edge. This does not establish current runtime acceptance for every browser.

## 轉換設定 / Conversion options

| 預設組態 / Preset | 方向 / Direction                                                 |
| ----------------- | ---------------------------------------------------------------- |
| s2t               | 簡體 → 繁體 / Simplified → Traditional                           |
| s2tw              | 簡體 → 臺灣正體 / Simplified → Taiwan standard                   |
| s2twp             | 簡體 → 臺灣詞彙，預設 / Simplified → Taiwan vocabulary, default  |
| s2hk              | 簡體 → 香港繁體 / Simplified → Hong Kong standard                |
| tw2sp             | 臺灣正體 → 簡體詞彙 / Taiwan Traditional → Simplified vocabulary |

分詞方式預設為 Jieba，也可手動選擇 mmseg。發生錯誤不會自動切換方式。
Jieba is the default segmentation mode; mmseg is an explicit alternative. Errors do not switch modes automatically.

## 使用方式 / Usage

1. 在彈出視窗選擇預設組態與分詞方式，再按「轉換目前網頁」。
   Choose a preset and segmentation mode in the popup, then select Convert Current Page.
2. 在「原文」欄輸入文字，預覽並複製「轉換結果」；原文保留，關閉視窗後文字清除。
   Enter text in Original to preview and copy Result. Original input stays intact; popup text is cleared on close.
3. 選取網頁文字後，使用右鍵選單轉換；既有元素及事件處理器會保留。
   Use the context menu to convert selected page text while preserving existing elements and event handlers.
4. 勾選「對此主機名稱自動轉換」，儲存此網站的組態並處理後續動態內容。規則只適用於完全相同的主機名稱，子網域須另行啟用。
   Enable automatic conversion for the exact hostname to save its configuration and process dynamic content. Subdomains must be enabled separately.

新設定使用獨立的 officialOpenCC 第 2 版儲存鍵。舊全域自動轉換、自由語言配對及正規表示式排除規則不再套用；舊資料保留供檢視或回復，請逐站重新啟用。
New settings use the separate officialOpenCC version-2 storage key. Legacy global auto-conversion, arbitrary locale pairs, and regex exclusions are not applied. Their stored data is retained for review or rollback; re-enable sites explicitly.

## 限制與疑難排解 / Limits and troubleshooting

- 已轉換的頁面變更組態前須重新載入。停用自動轉換不會還原已替換的文字。
  Reload a converted page before applying another configuration. Disabling automatic conversion does not restore replaced text.
- 受保護頁面無法轉換；內容腳本只處理頂層 HTTP/HTTPS 頁面。script/style、code/pre、編輯區域及 translate=no 內容會略過。
  Protected pages are unavailable. Content scripts handle top-level HTTP/HTTPS pages, skipping script/style, code/pre, editable regions, and translate=no.
- 每個 Text 節點獨立轉換，跨節點語境不會合併。內嵌 NUL 或不合法 UTF-16 會被拒絕。
  Each Text node is converted independently without joining linguistic context across nodes. Embedded NUL and malformed UTF-16 are rejected.
- 首次 Jieba 初始化可能需要數秒，WASM 記憶體可能隨大型輸入增長。組態變更、Worker 失敗或閒置 60 秒會終止 Worker。
  Initial Jieba setup may take seconds and large inputs can grow WASM memory. Configuration changes, Worker failure, or 60 seconds idle terminate the Worker.
- 文字、選取範圍、網址或設定改變後，過時結果會丟棄。失敗時待處理原文保留，先前已完成的頁面批次仍維持轉換。
  Stale results are discarded after text, selection, URL, or settings changes. On failure, pending originals remain intact and earlier completed page batches stay converted.

## 文件與授權 / Documentation and license

- [開發、驗證與發布 / Development, verification, and releases](./CONTRIBUTING.md)
- [執行架構 / Runtime architecture](./MV3_NOTES.md)
- [產品術語 / Product glossary](./GLOSSARY.md)
- [隱私政策 / Privacy policy](./PRIVACY.md)
- [版本紀錄 / Changelog](./CHANGELOG.md)
- [官方引擎重建 / Official engine rebuild](./scripts/opencc-feasibility/README.md)
- [效能方法與歷史證據 / Performance methods and historical evidence](./docs/short-node-performance.md)

應用程式採用 [MIT 授權](./LICENSE.txt)，保留 Tony Chan 原始版權。官方 OpenCC 與封裝元件的授權見[第三方聲明](./public/opencc/THIRD_PARTY_NOTICES.md)。
The application uses the [MIT license](./LICENSE.txt), retaining Tony Chan’s original copyright. See [third-party notices](./public/opencc/THIRD_PARTY_NOTICES.md) for official OpenCC and bundled components.
