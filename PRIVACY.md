# 隱私政策 / Privacy Policy

## 本機處理 / Local processing

擴充功能使用隨套件提供的官方 OpenCC 引擎、字典及模型，在本機 Worker 轉換網頁、選取範圍及彈出視窗文字。轉換不下載模型或使用 CDN，也不將文字或瀏覽紀錄傳送至伺服器；沒有分析追蹤或廣告服務。
The extension converts pages, selections, and popup text in a local Worker using bundled official OpenCC engine files, dictionaries, and models. Conversion downloads no models, uses no CDN, and sends no text or browsing history to servers. It includes no analytics, tracking, or advertising services.

## 儲存資料 / Stored data

設定使用 storage.local 中的 officialOpenCC 第 2 版資料，包括預設組態、分詞方式、啟用的網站主機名稱及其組態、移轉提示。舊設定資料保留供檢視或回復，但不套用於目前自動轉換。
Settings use version-2 officialOpenCC data in storage.local: default preset, segmentation mode, enabled site hostnames and their configurations, and migration notice. Legacy settings remain for review or rollback but are not applied to current automatic conversion.

彈出視窗輸入與結果不持久儲存，關閉後即清除。轉換快取只存在記憶體中；Worker 在組態變更、錯誤或閒置後終止。「複製結果」會將文字寫入系統剪貼簿。
Popup input and results are not persisted and are cleared on close. Conversion caches live only in memory; the Worker terminates after configuration changes, errors, or idle time. Copy Result writes text to the system clipboard.

## 權限 / Permissions

| 權限 / Permission                 | 用途 / Purpose                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| storage                           | 儲存本機設定與逐站規則。/ Store local settings and per-site rules.                                                |
| activeTab                         | 處理使用者要求的目前分頁操作。/ Handle user-requested active-tab operations.                                      |
| scripting                         | 內容腳本未就緒時補注入一次。/ Attempt one fallback content-script injection.                                      |
| contextMenus                      | 轉換選取文字的右鍵選單。/ Provide selection conversion in the context menu.                                       |
| offscreen（Chromium）             | 在背景承載本機轉換 Worker。/ Host the local conversion Worker in the background.                                  |
| HTTP/HTTPS 主機存取 / Host access | 在一般頂層網頁執行內容腳本與自動轉換。/ Run content scripts and automatic conversion on ordinary top-level pages. |

不要求廣泛的 tabs 權限。Firefox manifest 宣告不蒐集資料；主機存取不代表將網頁上傳。
The broad tabs permission is not requested. The Firefox manifest declares no data collection; host access does not upload pages.

## 聯絡 / Contact

一般問題請使用[此維護版本的問題追蹤](https://github.com/cf5146/opencc-extension/issues)；敏感漏洞請使用[私人漏洞回報](https://github.com/cf5146/opencc-extension/security/advisories/new)。
Use [this fork’s issue tracker](https://github.com/cf5146/opencc-extension/issues) for ordinary questions and [private vulnerability reporting](https://github.com/cf5146/opencc-extension/security/advisories/new) for sensitive issues.
