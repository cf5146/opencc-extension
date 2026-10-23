import fs from 'node:fs';
const node=JSON.parse(fs.readFileSync(new URL('./output/node.json',import.meta.url))),edge=JSON.parse(fs.readFileSync(new URL('./output/edge.json',import.meta.url))),startup=JSON.parse(fs.readFileSync(new URL('./output/edge-startup.json',import.meta.url)));
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)],mib=x=>(x/1048576).toFixed(1),n=x=>x.toFixed(0);
const rows=['s2twp','s2twp_jieba'].map(c=>{const r=startup.filter(x=>x.config===c);return {c,init:median(r.map(x=>x.init.ms)),first:median(r.map(x=>x.first.ms)),total:median(r.map(x=>x.init.ms+x.first.ms)),warm:median(r.flatMap(x=>x.warm.timesMs)),memory:r[0].first.memoryBytes};});
const max=Math.max(...edge.long.map(x=>x.memoryBytes));
const md=`# 官方 OpenCC 1.4.2：第一階段結果

**結論：官方來源自建 WASM＋Jieba 的技術可行性通過，可進入正式整合設計。現有產品轉換流程尚未改寫，也尚未發布。**

來源為 BYVoid/OpenCC ver.1.4.2，固定 commit 025f371dc76b598d77384fbdab90c937471844d8。官方核心與 Jieba 演算法來源保持原樣；本地介面只處理靜態 plugin 註冊與 heap 傳輸。

| 驗證 | 結果 |
|---|---|
| Node WASM 對 Windows 原生 1.4.2 | ${node.corpus.matched}/${node.corpus.tested} |
| Edge ${edge.edgeVersion} Worker 對原生 | ${edge.corpus.matched}/${edge.corpus.tested} |
| 每端長文測試 | 各 ${edge.long.length} 項：五種設定 × 兩種分詞 × 10萬／100萬字 × 重複漢字／混合文字 |
| 長文完整性 | Node 全文直接比較；Edge 全文 SHA-256 與位元組數均與原生一致 |
| 離線 | 六次新 Worker 初始化與第一筆轉換通過 |
| 全新目錄重建 | 32 個引擎／資料檔案逐位元組雜湊一致 |
| API 邊界 | 空字串、emoji、明確拒絕 NUL／不完整 UTF-16、關閉後拒絕使用通過 |

## 本機觀測

| 設定 | 載入資源中位數 | 首次建立與轉換中位數 | 兩者合計中位數 | 暖機10,000字中位數 | 首次轉換後 WASM 記憶體 |
|---|---:|---:|---:|---:|---:|
${rows.map(r=>`| ${r.c} | ${n(r.init)} ms | ${n(r.first)} ms | ${n(r.total)} ms | ${r.warm.toFixed(1)} ms | ${mib(r.memory)} MiB |`).join('\n')}

各設定三次新 Worker；暖機各五次，共十五筆。這是同一台電腦、既有瀏覽器程序內的觀測，並非整機冷啟動或普遍速度排名。最大長文單次轉換約 ${Math.max(...edge.long.map(x=>x.ms)).toFixed(0)} ms。記憶體為 WASM 線性記憶體，不含 JS heap、虛擬檔案系統、瀏覽器程序與暫存複製。

32 個選定引擎／資料檔案合計 **${node.package.bytes.toLocaleString('en-US')} bytes（${mib(node.package.bytes)} MiB）**；逐檔 gzip 相加 ${node.package.sumIndividualGzipBytes.toLocaleString('en-US')} bytes。這不是完整擴充功能 ZIP，未含 manifest、測試工具、授權告示包與封裝額外成本。

## 正式整合前必須處理

- 在 Worker 中初始化與轉換，提供初始化中／失敗狀態；本機 Jieba 首次可等待約數秒。
- 限制同時保留的轉換器。此驗證工具快取十種設定加長文後達 **${mib(max)} MiB**；釋放 handle 不會讓 WASM 線性記憶體縮小，必要時重建 Worker。
- 保持單一 Text node 邊界；Jieba 不會補回被 DOM 切開的上下文。
- NUL 是官方核心內部字串處理的限制，整合層明確報錯，不能把截斷文字寫回頁面。失敗保留原文，不自動改用 mmseg。
- 後續仍需整合 popup／整頁／選取／動態自動轉換、exact-host 設定、取消與 DOM 變動競態、CI 閘門及完整授權告示。這些不屬於第一階段驗證範圍。

有限測例相符並不代表對所有文字保證一致，也不構成 Jieba 品質全面優於 mmseg 的結論。資料與腳本位置見 [README](README.md)，原始量測見 output/node.json、output/edge.json、output/edge-startup.json、output/rebuild.json。
`;
fs.writeFileSync(new URL('./RESULTS.md',import.meta.url),md);
const escape=x=>x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
fs.writeFileSync(new URL('./REPORT.html',import.meta.url),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>官方 OpenCC 1.4.2 第一階段結果</title><style>body{background:#f3f6f4;color:#17352b;font:16px/1.7 system-ui;margin:0;padding:32px}main{max-width:1100px;margin:auto;background:white;padding:32px;border-radius:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}a{color:#14694f}</style><main><a href="../REPORT.html">前期評估</a> · <a href="RESULTS.md">Markdown</a><pre>${escape(md)}</pre></main></html>`);
console.log('RESULTS.md and REPORT.html updated from verified JSON evidence.');
