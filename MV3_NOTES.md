# 執行架構 / Runtime Architecture

本文件說明目前官方 OpenCC 執行路徑；開發與發布指令見[貢獻指南](./CONTRIBUTING.md)，產品用語見[術語表](./GLOSSARY.md)。
This document describes the current official OpenCC runtime. See the [contributing guide](./CONTRIBUTING.md) for commands and the [glossary](./GLOSSARY.md) for product terms.

## 模組責任 / Responsibilities

| 位置 / Location             | 責任 / Responsibility                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| entrypoints/                | WXT 背景、內容腳本、彈出視窗及設定頁。/ WXT background, content, popup, and options entrypoints.                              |
| src/application/official/   | 正式產品的設定、訊息、DOM 快照、批次及引擎橋接。/ Production settings, messaging, DOM snapshots, batching, and engine bridge. |
| public/opencc/              | 隨套件提供的 Worker、host、WASM、模型與聲明。/ Bundled Worker, host, WASM, models, and notices.                               |
| src/platform/               | 共用瀏覽器 API 邊界。/ Shared browser API boundary.                                                                           |
| src/build/manifest.ts       | 瀏覽器 Manifest 與權限。/ Browser manifests and permissions.                                                                  |
| scripts/opencc-feasibility/ | 固定來源重建、參考實作及驗證工具。/ Pinned-source rebuild, reference implementation, and verification tools.                  |

src/application/auto、conversion、runtime、ui 及 src/lib/opencc 等舊同步模組保留作回歸參考；正式入口使用 src/application/official，沒有匯入舊轉換引擎。
Legacy synchronous modules under src/application/auto, conversion, runtime, ui, and src/lib/opencc remain as regression references. Production entrypoints use src/application/official without importing the old conversion engine.

## 執行路徑與 Manifest / Runtime path and manifest

彈出視窗或內容腳本透過背景送出批次；Chromium 在 offscreen document 中管理序列化 Worker，Firefox 使用背景頁面。Worker 每次保留一組有效組態，組態變更、錯誤或閒置 60 秒後釋放。
Popup or content code sends batches through the background. Chromium hosts the serialized Worker in an offscreen document; Firefox uses its background page. The Worker holds one active configuration and is reclaimed on configuration changes, errors, or 60 seconds idle.

Chrome／Edge 使用 module service worker，Firefox 使用 module background.scripts。靜態內容腳本於 document_idle 在頂層 HTTP/HTTPS 網頁啟動。手動操作若找不到內容腳本，背景最多補注入一次並重試訊息。
Chrome/Edge use a module service worker; Firefox uses module background.scripts. Static content scripts start at document_idle on top-level HTTP/HTTPS pages. When a manual request cannot reach a content script, background code attempts one fallback injection and message retry.

共用權限為 storage、contextMenus、scripting、activeTab 及 HTTP/HTTPS 主機存取；Chromium 額外使用 offscreen。CSP 允許本機 WASM 編譯，Firefox ID 為 opencc-extension@cf5146。
Shared permissions are storage, contextMenus, scripting, activeTab, and HTTP/HTTPS host access. Chromium additionally uses offscreen. CSP permits local WASM compilation; the Firefox ID is opencc-extension@cf5146.

## 設定、DOM 與快取 / Settings, DOM, and caching

officialOpenCC 第 2 版設定保存預設組態、分詞方式、逐主機組態及移轉提示。舊設定保留但不套用；網站自動轉換必須逐個完全相同的主機名稱啟用。
Version-2 officialOpenCC settings store the default preset/mode, per-host configurations, and migration notice. Legacy settings remain stored but are not applied. Automatic conversion must be enabled for each exact hostname.

DOM 轉換擷取原文快照，以批次傳給 Worker；單一 Text 節點不會為批次而拆成多段。提交前重新檢查文字、設定、網址與節點有效性，選取範圍還檢查成員及端點；保留元素與事件處理器。
DOM conversion captures original snapshots and sends batches to the Worker. Batching does not split an individual Text node. Before writing, it revalidates text, settings, URL, and node state; selections also validate membership and endpoints. Elements and event handlers remain intact.

短文字請求會批次處理，自動轉換根節點會合併待處理工作。頁面本機 LRU 快取依組態與完整原文索引，最多 2,048 筆及約 512 KiB 的鍵／值 UTF-16 大小估計；不跨分頁共用。
Short-text requests are batched and pending automatic roots are grouped. A page-local LRU cache keys on configuration and exact input, retaining at most 2,048 entries and approximately 512 KiB of estimated UTF-16 key/value storage. It is not shared across tabs.

轉換後切換組態須重新載入頁面。頁面批次失敗時，先前完成的文字保留轉換，待處理原文不變。首次字典初始化及單一大型輸入仍可能耗時；歷史效能資料不是目前或跨瀏覽器保證。
Changing configuration after conversion requires reloading. On page-batch failure, completed text remains converted and pending originals remain unchanged. Cold dictionary initialization and large inputs can still be costly; historical performance is not a current or cross-browser guarantee.

## 引擎維護與驗證 / Engine maintenance and verification

引擎及模型受 scripts/opencc-feasibility/artifact-lock.json 與 manifest 雜湊約束。依[重建指南](./scripts/opencc-feasibility/README.md)準備固定來源與工具鏈，再執行 update:official、verify:official 及 verify:official:parity。
Engine and models are bound to scripts/opencc-feasibility/artifact-lock.json and manifest hashes. Follow the [rebuild guide](./scripts/opencc-feasibility/README.md) for pinned sources and tools, then run update:official, verify:official, and verify:official:parity.

一般建置只驗證與封裝已提交的引擎，不下載新版字典。刻意更新來源或工具鏈時，須審查鎖定檔、完整輸出比對、邊界測試及瀏覽器驗證，並保留所有第三方授權。
Normal builds verify and package committed engine files without downloading newer dictionaries. Intentional source/tool updates require lock review, full-output parity, boundary tests, browser checks, and preserved third-party notices.

CI 的 verify 工作檢查三個瀏覽器的建置與雜湊；official-parity 工作在 Windows 比對固定原生參考。文件中的歷史測試數與瀏覽器測量不取代本次執行結果。
CI’s verify job checks all three browser builds and hashes; official-parity compares the pinned native reference on Windows. Historical test counts and browser measurements do not replace results from the current run.
