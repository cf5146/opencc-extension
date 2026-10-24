import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.dirname(fileURLToPath(import.meta.url)),dist=path.join(root,'dist');
const m=JSON.parse(fs.readFileSync(path.join(dist,'engine-resources.json')));
assert.deepEqual(m,JSON.parse(fs.readFileSync(path.join(root,'artifact-lock.json'))),'Bundle matches reviewed artifact lock');
assert.equal(m.official.commit,'025f371dc76b598d77384fbdab90c937471844d8');
assert.equal(m.toolchain.emsdk,'4.0.22');
for(const a of [...m.resources,...m.artifacts]){
 const b=fs.readFileSync(path.join(dist,a.path));assert.equal(b.length,a.bytes,a.path+' size');
 assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256,a.path+' hash');
}
const node=JSON.parse(fs.readFileSync(path.join(root,'output/node.json'))),edge=JSON.parse(fs.readFileSync(path.join(root,'output/edge.json')));
const manifestSha256=createHash('sha256').update(JSON.stringify(m)).digest('hex');
assert.equal(node.manifestSha256,manifestSha256,'Node tested current bundle');
assert.equal(edge.init.manifestSha256,manifestSha256,'Edge tested current bundle');
for(const r of [node,edge]){assert.equal(r.corpus.tested,779);assert.equal(r.corpus.matched,r.corpus.tested);assert.equal(r.corpus.mismatches.length,0);assert.equal(r.long.length,40);}
const key=x=>`${x.config}:${x.chars}:${x.pattern}`;
const expectedKeys=['s2t','s2tw','s2twp','s2hk','tw2sp'].flatMap(c=>[c,c+'_jieba']).flatMap(config=>[100000,1000000].flatMap(chars=>['repeated-Han','mixed'].map(pattern=>key({config,chars,pattern})))).sort((a,b)=>a.localeCompare(b,'en'));
for(const [name,r] of [['Node',node],['Edge',edge]]){
 const keys=r.long.map(key);
 assert.equal(new Set(keys).size,expectedKeys.length,`${name} long coverage has duplicates or missing combinations`);
 assert.deepEqual(keys.sort((a,b)=>a.localeCompare(b,'en')),expectedKeys,`${name} long coverage must equal the complete required matrix`);
}
const nativeByKey=new Map(node.long.map(x=>[key(x),x]));
for(const actual of edge.long){const ref=nativeByKey.get(key(actual));assert.ok(ref);assert.equal(actual.sha256,ref.referenceSha256,JSON.stringify(actual));assert.equal(ref.matched,true);assert.equal(actual.outputUtf8Bytes,ref.outputUtf8Bytes);}
console.log(JSON.stringify({filesVerified:m.resources.length+m.artifacts.length,nodeParity:node.corpus.matched,edgeParity:edge.corpus.matched,nodeLong:node.long.length,edgeLong:edge.long.length,edgeLongNativeParity:'all full-output SHA256 and byte lengths matched'}));
