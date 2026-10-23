import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {parse} from 'jsonc-parser';
import Native from 'opencc';
import 'opencc-jieba';
import assert from 'node:assert/strict';
import {loadOpenCC} from './dist/runtime.mjs';
const bases=['s2t','s2tw','s2twp','s2hk','tw2sp'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const cases=[];
const native=new Map();
const get=c=>{if(!native.has(c))native.set(c,new Native(c+'.json',{includeTofuRiskDictionaries:true}));return native.get(c);};
for(const file of ['./fixtures/official-testcases.json','./fixtures/official-jieba-testcases.json']){
 const raw=fs.readFileSync(new URL(file,import.meta.url));
 for(const c of parse(raw.toString()).cases)for(const config of Object.keys(c.expected)){
  const base=config.replace('_jieba','');if(!bases.includes(base))continue;
  for(const cfg of config.endsWith('_jieba')?[config]:[config,config+'_jieba'])cases.push({id:c.id,source:file,config:cfg,input:c.input,expected:get(cfg).convertSync(c.input)});
 }
}
assert.equal(Native.version,'1.4.2');
const t=performance.now(),session=await loadOpenCC();
const result={nativeVersion:Native.version,initializationMs:performance.now()-t,corpus:{tested:cases.length,matched:0,mismatches:[]},long:[],memoryAfterLoad:session.memoryBytes};
for(const c of cases){const actual=session.convert(c.config,c.input);if(actual===c.expected)result.corpus.matched++;else result.corpus.mismatches.push({...c,actual});}
for(const config of bases.flatMap(x=>[x,x+'_jieba']))for(const chars of [100000,1000000])for(const pattern of ['汉','勇敢的士兵在软件开发中心使用鼠标，研究生命起源。 OpenCC 😀\n']){
 const input=pattern.repeat(Math.ceil(chars/pattern.length)).slice(0,chars);
 // Avoid a split UTF-16 surrogate at the requested boundary.
 const text=input.isWellFormed()?input:input.slice(0,-1);
 const expected=get(config).convertSync(text),start=performance.now(),actual=session.convert(config,text),ms=performance.now()-start;
 result.long.push({config,chars:text.length,pattern:pattern==='汉'?'repeated-Han':'mixed',inputUtf8Bytes:Buffer.byteLength(text),outputUtf8Bytes:Buffer.byteLength(actual),sha256:hash(actual),referenceSha256:hash(expected),matched:actual===expected,ms,memoryBytes:session.memoryBytes});
}
const manifest=JSON.parse(fs.readFileSync(new URL('./dist/manifest.json',import.meta.url)));
result.manifestSha256=hash(JSON.stringify(manifest));
result.package={selectedFiles:manifest.resources.length+manifest.artifacts.length,bytes:0,sumIndividualGzipBytes:0};
for(const a of [...manifest.resources,...manifest.artifacts]){const b=fs.readFileSync(new URL('./dist/'+a.path,import.meta.url));result.package.bytes+=b.length;result.package.sumIndividualGzipBytes+=gzipSync(b).length;}
result.fixtures=['./fixtures/official-testcases.json','./fixtures/official-jieba-testcases.json'].map(file=>({file,sha256:hash(fs.readFileSync(new URL(file,import.meta.url)))}));
assert.deepEqual(result.fixtures.map(x=>x.sha256),['3f8273c5f432090ec1a8a01bd4d545046ad5a28e69eb41a081c5e3e54d3e402b','962babe39228b398f425b039c99255941a62c232815727da92c231159aee52f6']);
fs.mkdirSync(new URL('./output/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./dist/cases.json',import.meta.url),JSON.stringify(cases));
fs.writeFileSync(new URL('./output/node.json',import.meta.url),JSON.stringify(result,null,2));
session.close();
assert.equal(result.corpus.matched,result.corpus.tested);assert.ok(result.long.every(x=>x.matched));
console.log(JSON.stringify({...result,long:result.long.map(x=>({config:x.config,chars:x.chars,pattern:x.pattern,matched:x.matched,ms:x.ms,memoryBytes:x.memoryBytes}))},null,2));
