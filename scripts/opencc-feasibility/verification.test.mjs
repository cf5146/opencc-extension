import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
function runWithEvidence(mutate){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'opencc-verifier-'));
 try{
  fs.mkdirSync(path.join(temp,'output'));
  for(const f of ['verify.mjs','artifact-lock.json'])fs.copyFileSync(path.join(root,f),path.join(temp,f));
  const node=JSON.parse(fs.readFileSync(path.join(root,'output/node.json'))),edge=JSON.parse(fs.readFileSync(path.join(root,'output/edge.json')));
  mutate(node,edge);
  for(const [f,r] of [['node.json',node],['edge.json',edge]])fs.writeFileSync(path.join(temp,'output',f),JSON.stringify(r));
  return spawnSync(process.execPath,[path.join(temp,'verify.mjs'),path.join(root,'dist')],{encoding:'utf8'});
 }finally{
  // Delete only the exact child directory created above in the system temp root.
  assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(temp).startsWith('opencc-verifier-'));
  fs.rmSync(temp,{recursive:true});
 }
}
test('real complete matrix is accepted',()=>assert.equal(runWithEvidence(()=>{}).status,0));
test('duplicate rows cannot replace missing long-input coverage',()=>{
 const r=runWithEvidence((node,edge)=>{node.long.fill(node.long[0]);edge.long.fill(edge.long[0]);});
 assert.notEqual(r.status,0,'duplicated evidence must fail verification');
 assert.match(r.stderr,/coverage/);
});
