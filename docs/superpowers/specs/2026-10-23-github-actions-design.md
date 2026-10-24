# GitHub Actions 設計 / GitHub Actions design

使用者已在訪談中核准以下設計；既有未提交修改須保留。
The user approved this design in the interview; preserve existing uncommitted work.

- 四個工作流程：CI、手動準備發布 PR、自動發布、共用驗證建置。
  Four workflows: CI, manual release preparation, automatic publication, and reusable validation/build.
- 每個 PR 與 main push 執行 CI；Ubuntu、Node 24，品質檢查與三瀏覽器矩陣平行執行，最後以 verify 彙總。
  CI covers every PR and main push on Ubuntu/Node 24, with parallel quality and three-browser builds and a final verify gate.
- PR 套件保存 7 天，main 套件保存 14 天。
  Retain PR packages for 7 days and main packages for 14 days.
- 手動準備支援版本、說明及預設下一個修補版本；合格的同儲存庫發布 PR 合併至 main 後自動發布。
  Manual preparation accepts version/notes and defaults to the next patch; publish after an eligible same-repository release PR merges into main.
- 發布重建確切合併提交，檢查準備來源、版本、鎖定檔、說明及雜湊；僅發布 GitHub Releases。
  Rebuild the exact merge commit, validate preparation provenance, version, lockfile, notes and hashes, and publish only to GitHub Releases.
- 保留安全重試與獨立寫入權限；透過原工作流程重跑復原，不移動標籤或覆寫衝突產物。
  Keep safe retries and isolated write permissions; recover through original workflow reruns without moving tags or overwriting conflicting assets.

## 方案 / Approaches

選用共用驗證工作流程，發布自行重建；較容易獨立重跑，但發布合併時會多建置一次。
Choose a reusable validation workflow and a self-contained release rebuild: simpler recovery, with one extra build per release merge.
另一方案是重用 main CI 產物，可節省建置但增加跨執行尋找與保存期限耦合。
Reusing main CI artifacts saves builds but couples publication to cross-run discovery and retention.

## 實作裁量 / Implementation discretion

例行命名、步驟拆分及測試實作由代理決定；不變更託管設定、不提交商店、不發布實際版本。
Routine naming, step boundaries and test implementation are delegated to the agent. Hosted settings, store submission and actual publication are outside this implementation.
