import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const source=process.argv[2]||path.join(root,'source/OpenCC');
const commit='025f371dc76b598d77384fbdab90c937471844d8';
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==commit)throw new Error('Unexpected source commit');
if(execFileSync('git',['-C',source,'status','--porcelain'],{encoding:'utf8'}).trim())throw new Error('Modified official source');
const dist=path.join(root,'dist'),resources=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const names=new Set();
const visit=x=>{if(!x||typeof x!=='object')return;if(x.file)names.add(x.file);for(const v of Object.values(x))visit(v);};
for(const name of ['s2t','s2tw','s2twp','s2hk','tw2sp'].flatMap(c=>[c,`${c}_jieba`])){
  const relative=`resources/config/${name}.json`;
  const original=`${name.endsWith('_jieba')?'plugins/jieba/data/config':'data/config'}/${name}.json`;
  // Git blob bytes are stable across Windows autocrlf and Linux checkouts.
  const bytes=execFileSync('git',['-C',source,'show',`${commit}:${original}`]);
  await fs.writeFile(path.join(dist,relative),bytes);visit(JSON.parse(bytes));
}
for(const file of await fs.readdir(path.join(dist,'resources/dict')))if(!names.has(file))await fs.unlink(path.join(dist,'resources/dict',file));
for(const dir of ['config','dict','jieba_dict'])for(const file of (await fs.readdir(path.join(dist,'resources',dir))).sort()){
  const p=`resources/${dir}/${file}`,b=await fs.readFile(path.join(dist,p));
  resources.push({path:p,virtualPath:`/data/${dir==='jieba_dict'?'config/jieba_dict':dir}/${file}`,bytes:b.length,sha256:hash(b)});
}
const artifacts=[];
for(const p of ['opencc.mjs','opencc.wasm','runtime.mjs']){const b=await fs.readFile(path.join(dist,p));artifacts.push({path:p,bytes:b.length,sha256:hash(b)});}
const adapter=[];
for(const p of (await fs.readdir(path.join(root,'adapter'))).sort()){const b=await fs.readFile(path.join(root,'adapter',p));adapter.push({path:`adapter/${p}`,sha256:hash(b)});}
const manifest={schema:1,official:{repository:'https://github.com/BYVoid/OpenCC',tag:'ver.1.4.2',commit,sourceUnmodified:true},toolchain:{emsdk:'4.0.22',emsdkCommit:'15915cad554b707837024dc2758b6a1c5b94b036',emscriptenSdkHash:'bebaf7e50e31865b0724f17eaa52e161e2dfef5a',python:'3.13.9',cmake:'3.31.10',ninja:'1.13.0',hostCompiler:'GCC 14 (Debian 13.6 x86_64)'},policy:{includeTofuRiskDictionaries:true,segmentation:['mmseg','jieba'],input:'complete UTF-8 heap buffer; explicit byte length; no chunks or fallback'},adapter,artifacts,resources};
await fs.writeFile(path.join(dist,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({resources:resources.length,resourceBytes:resources.reduce((n,r)=>n+r.bytes,0),artifactBytes:artifacts.reduce((n,r)=>n+r.bytes,0)}));
