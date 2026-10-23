import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),cli=process.env.PLAYWRIGHT_CLI;
if(!cli)throw new Error('Set PLAYWRIGHT_CLI to the installed @playwright/cli 0.1.22 entrypoint');
const run=(args,json=false)=>{const r=spawnSync(process.execPath,[cli,'-s=opencc-official',...(json?['--json']:[]),...args],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:15*1024*1024,windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw new Error(r.stdout+r.stderr);if(!json)return r.stdout;const raw=JSON.parse(r.stdout);return typeof raw.result==='string'?JSON.parse(raw.result):raw.result;};
fs.mkdirSync(path.join(root,'output'),{recursive:true});
fs.cpSync(path.join(root,'dist'),path.join(root,'probe/engine'),{recursive:true});
fs.writeFileSync(path.join(root,'edge-cli.json'),JSON.stringify({browser:{browserName:'chromium',userDataDir:path.join(root,'edge-profile'),launchOptions:{channel:'msedge',headless:true,args:[`--disable-extensions-except=${path.join(root,'probe')}`,`--load-extension=${path.join(root,'probe')}`]}},outputDir:path.join(root,'output/playwright')},null,2));
try{
 run(['open','edge://extensions','--config','edge-cli.json']);
 const extensions=run(['run-code','async(page)=>await page.evaluate(()=>new Promise(resolve=>chrome.developerPrivate.getExtensionsInfo({includeDisabled:true,includeTerminated:true},resolve)))'],true);
 const ext=extensions.find(x=>x.name==='Official OpenCC source feasibility probe');if(!ext||ext.state!=='ENABLED')throw new Error('Probe extension did not load');
 run(['goto',`chrome-extension://${ext.id}/index.html`]);
 for(const [snippet,out] of [['edge-run.snippet','edge.json'],['edge-startup.snippet','edge-startup.json']]){
  console.log(`Running ${snippet}`);
  const result=run(['run-code',`--filename=${snippet}`],true);
  fs.writeFileSync(path.join(root,'output',out),JSON.stringify(result,null,2));
 }
 console.log('Edge results saved.');
}finally{run(['close']);}
