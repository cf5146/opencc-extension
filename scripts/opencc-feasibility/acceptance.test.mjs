import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'dist');
test('official source-built runtime artifacts exist',()=>{
  for(const f of ['opencc.mjs','opencc.wasm','runtime.mjs','manifest.json'])assert.ok(fs.existsSync(path.join(out,f)),`missing built artifact: ${f}`);
});
test('complete UTF-8 inputs survive heap transfer, NULs, and lifecycle',async t=>{
  if(!fs.existsSync(path.join(out,'runtime.mjs')))return t.skip('artifacts not built yet');
  const {loadOpenCC}=await import(pathToFileURL(path.join(out,'runtime.mjs')));
  const session=await loadOpenCC();
  for(const mode of ['s2twp','s2twp_jieba']){
    assert.equal(session.convert(mode,''),'');
    assert.equal(session.convert(mode,'汉字😀'),'漢字😀');
    assert.throws(()=>session.convert(mode,'汉\0字😀'),/Embedded NUL/);
    assert.throws(()=>session.convert(mode,'汉\ud800字'),/Malformed UTF-16/);
    for(const n of [100000,1000000]){
      const input='汉'.repeat(n);const actual=session.convert(mode,input);
      assert.equal(actual,'漢'.repeat(n),`${mode}: complete ${n}-character output`);
    }
  }
  assert.throws(()=>session.convert('missing','汉'));
  session.close();session.close();
  assert.throws(()=>session.convert('s2twp','汉'),/closed/);
});
