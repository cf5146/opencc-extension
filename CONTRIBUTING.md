# 貢獻指南 / Contributing

## 開發環境 / Development environment

使用 npm 與 package.json 的 engines 所列 Node.js 版本：^22.22.2、^24.15.0 或 >=26.0.0；CI 使用 Node.js 24。RTK 是選用的本機工具。
Use npm and a Node.js version allowed by package.json engines: ^22.22.2, ^24.15.0, or >=26.0.0. CI uses Node.js 24. RTK is optional local tooling.

```sh
npm ci --ignore-scripts
node_modules/.bin/wxt prepare
npm run dev
```

Firefox 與 Edge 開發模式分別使用 npm run dev:firefox 與 npm run dev:edge。WXT 將開發輸出寫入對應目錄，須手動載入及重新整理瀏覽器；目前停用自動啟動瀏覽器。
Use npm run dev:firefox or npm run dev:edge for those browsers. WXT writes development output to the corresponding directory. Load and reload the extension manually; automatic browser launch is disabled.

| 瀏覽器 / Browser | 建置 / Build          | 輸出 / Output        |
| ---------------- | --------------------- | -------------------- |
| Chrome           | npm run build:chrome  | .output/chrome-mv3/  |
| Firefox          | npm run build:firefox | .output/firefox-mv3/ |
| Edge             | npm run build:edge    | .output/edge-mv3/    |

Chrome 與 Edge 在擴充功能管理頁啟用開發人員模式，載入對應的未封裝目錄。Firefox 在 about:debugging 載入 firefox-mv3/manifest.json 作為暫用附加元件；目前沒有已簽署 XPI。
In Chrome or Edge, enable developer mode in extension management and load the matching unpacked directory. In Firefox, use about:debugging to load firefox-mv3/manifest.json as a temporary add-on; no signed XPI is currently provided.

## 驗證與封裝 / Verification and packaging

提交 PR 前執行完整檢查，包含官方資產雜湊、ESLint、TypeScript、Vitest，以及三個瀏覽器的建置與產物驗證。
Before opening a PR, run the complete gate: official asset hashes, ESLint, TypeScript, Vitest, and builds plus artifact verification for all three browsers.

```sh
npm run ci
```

個別檢查與格式檢查 / Individual checks and formatting:

```sh
npm run lint
npm run typecheck
npm test
npm run format:check
node scripts/verify-build-output.mjs chrome
node scripts/verify-official-assets.mjs chrome
```

單一產物驗證須先建置該目標。介面修改另以實際瀏覽器確認操作、明暗主題及狀態訊息；單元測試不能證明商店或實機相容性。
Build a target before verifying its artifacts. For UI changes, also check interaction, light/dark themes, and status messages in a browser. Unit tests do not establish store or live-browser compatibility.

npm run dist 重新建置並封裝三個目標；npm run package:built 只封裝既有產物，應在完整檢查通過後使用。後者會拒絕缺漏、無效或版本不一致的建置。
npm run dist rebuilds and packages all targets. npm run package:built packages existing outputs and should follow a successful complete gate; it rejects missing, invalid, or version-mismatched builds.

封裝輸出位於 .output/：opencc.chrome.zip、opencc.firefox.zip、opencc.edge.zip；package:built 另產生 SHA256SUMS。
Packages are written to .output/: opencc.chrome.zip, opencc.firefox.zip, and opencc.edge.zip. package:built also produces SHA256SUMS.

## 修改與提交 / Changes and pull requests

以 main 為基礎建立分支，集中處理一項問題，提交訊息使用 feat:、fix:、docs: 等前綴，向 main 提出 PR。保留既有未提交修改。
Create a branch from main, keep each change focused, use commit prefixes such as feat:, fix:, or docs:, and open a PR against main. Preserve existing uncommitted changes.

修改前先查看[術語](./GLOSSARY.md)；涉及執行流程或平台邊界時，閱讀[架構說明](./MV3_NOTES.md)。變更行為時同步更新相關測試與文件。
Consult the [glossary](./GLOSSARY.md) before changing terminology and the [architecture notes](./MV3_NOTES.md) for runtime or platform changes. Update relevant tests and documentation when behavior changes.

原生引擎比對另需安裝 scripts/opencc-feasibility 的依賴並執行 npm run verify:official:parity；重建程序見 [官方引擎指南](./scripts/opencc-feasibility/README.md)。
Native parity additionally requires dependencies under scripts/opencc-feasibility and npm run verify:official:parity; see the [official engine guide](./scripts/opencc-feasibility/README.md) for rebuilds.

CI 在 main/dev 的 push、以 main 為目標的 PR，以及手動執行時運作。verify 工作會檢查工作流程、安裝依賴、準備 WXT，再執行完整檢查與封裝；push 與手動執行會上傳保存 14 天的產物。
CI runs on pushes to main/dev, PRs targeting main, and manual dispatches. Its verify job checks workflows, installs dependencies, prepares WXT, runs the complete gate, and packages outputs. Push and manual runs upload artifacts retained for 14 days. A separate official-parity job runs the pinned native comparison on Windows.
另有 official-parity 工作在 Windows 執行固定原生參考比對。

## 發布 / Releases

GitHub Release 與商店發布／Firefox 簽署分開處理；Firefox ID 為 opencc-extension@cf5146，尚未向 AMO 提交。詳見[維護與發布識別](./docs/maintainer-and-release-identity.md)。
GitHub releases are separate from store submission and Firefox signing. The Firefox ID opencc-extension@cf5146 has not been submitted to AMO. See [maintainer and release identity](./docs/maintainer-and-release-identity.md).

### 準備與審查 / Prepare and review

1. 在 main 執行 **Prepare release**。version 留空會選擇高於套件版本及現有標籤的下一個修補版本；亦可指定不含 v 的版本及附加說明。
   Run **Prepare release** on main. An empty version selects the next patch above the package version and existing tags. Alternatively, specify a version without v and optional notes.
2. 工作流程更新套件版本、鎖定檔與兩份版本文件，建立 codex/release-vX.Y.Z 分支及 PR，並手動觸發該分支的 CI。
   The workflow updates package versions, the lockfile, and both release documents, creates codex/release-vX.Y.Z and a PR, and explicitly dispatches CI for that branch.
3. 審查差異與檢查結果後，透過正常 PR 流程合併。重新執行準備流程會沿用現有分支，不會覆寫審查中的編輯。
   Review the diff and checks, then merge through the normal PR process. Repeating preparation reuses the existing branch without overwriting review edits.

CHANGELOG.md 是精簡版本歷史；CHANGELOG_RELEASE.md 是發布程式讀取的最新說明，首行必須維持「## vX.Y.Z - YYYY-MM-DD」。CHANGELOG.md 的「# Changelog」標題也由產生器使用。準備流程會從提交訊息產生說明，審查時應整理成中英對照。
CHANGELOG.md holds concise version history. CHANGELOG_RELEASE.md is the current publication input and must begin with “## vX.Y.Z - YYYY-MM-DD”. The generator also relies on the “# Changelog” heading in CHANGELOG.md. Preparation generates notes from commits; edit them into bilingual form during review.

儲存庫須允許 GitHub Actions 建立 PR；準備流程使用 contents: write、pull-requests: write 與 actions: write。若組織政策禁止，先處理權限設定。
The repository must allow GitHub Actions to create PRs. Preparation uses contents: write, pull-requests: write, and actions: write. Resolve repository or organization policy restrictions before proceeding.

### 發布已審查的提交 / Publish the reviewed commit

1. 合併後在 main 執行 **Release**。expected_version 可用來確認版本，不會修改版本號。
   After merging, run **Release** on main. expected_version checks the intended version without changing it.
2. 建置工作鎖定該次執行的提交，驗證版本與說明，執行完整檢查並封裝相同產物。產物整理使用可信任的 Git 絕對路徑；託管流程設定 GIT_EXECUTABLE=/usr/bin/git。
   The build job freezes the dispatch commit, validates versions and notes, runs the complete gate, and packages those outputs. Artifact staging uses a trusted absolute Git path; the hosted workflow sets GIT_EXECUTABLE=/usr/bin/git.
3. 獨立發布工作下載產物並驗證中繼資料與雜湊；建立版本標籤及草稿 Release，上傳並驗證遠端檔案後公開。
   A separate publication job downloads artifacts and validates metadata and hashes. It creates the version tag and draft release, then uploads and verifies remote assets before publishing.

發布工作不執行儲存庫程式，不修改 main，也不自動上架瀏覽器商店。
The publication job executes no repository code, does not modify main, and does not submit to browser stores.

### 失敗復原 / Recovery

- 準備失敗：以相同版本重跑，沿用已建立的分支與 PR。
  Preparation failure: rerun with the same version to reuse the branch and PR.
- 發布失敗：在原執行使用 **Re-run failed jobs**，沿用成功建置的產物與提交；相符檔案會保留，缺漏檔案會補上。
  Publication failure: use **Re-run failed jobs** on the original run to reuse its successful build artifacts and commit. Matching assets are preserved and missing assets are uploaded.
- 產物在 14 天後過期：重跑原執行的所有工作，重建原本鎖定的提交。
  After artifacts expire at 14 days, rerun all jobs in the original run to rebuild its frozen commit.
- 標籤指向其他提交、說明或檔案內容衝突：先查明差異；流程不會自動移動標籤或覆寫已發布檔案。
  If tags, notes, or asset bytes conflict, investigate the mismatch. Workflows do not move tags or overwrite published assets automatically.

本機測試不代表託管權限已驗證；首次使用時，維護者須確認分支保護的 verify 檢查、PR 建立、CI 觸發及產物下載權限。
Local tests do not establish hosted permissions. On first use, maintainers must confirm the verify branch-protection check, PR creation, CI dispatch, and artifact download permissions.

## 問題、安全與授權 / Issues, security, and license

一般問題請提供瀏覽器版本、重現步驟及錯誤訊息，使用本維護版本的[問題追蹤](https://github.com/cf5146/opencc-extension/issues)。敏感漏洞使用[私人漏洞回報](https://github.com/cf5146/opencc-extension/security/advisories/new)。貢獻採 MIT 授權並保留原作者聲明。
For ordinary issues, provide the browser version, reproduction steps, and errors. Use this fork’s issue tracker and private vulnerability reporting for sensitive issues. Contributions use MIT with original attribution retained.
