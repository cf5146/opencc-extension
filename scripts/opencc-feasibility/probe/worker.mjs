import {loadOpenCC} from './engine/runtime.mjs';
let session;
const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))),b=>b.toString(16).padStart(2,'0')).join('');
self.onmessage=async({data})=>{try{
 let result;const start=performance.now();
 if(data.command==='init'){session?.close();session=await loadOpenCC();result={ms:performance.now()-start,memoryBytes:session.memoryBytes,manifestSha256:await sha(JSON.stringify(session.manifest))};}
 else if(data.command==='corpus'){
  const cases=await(await fetch('./engine/cases.json')).json();let matched=0;const mismatches=[];
  for(const c of cases){const actual=session.convert(c.config,c.input);if(actual===c.expected)matched++;else mismatches.push({...c,actual});}
  result={tested:cases.length,matched,mismatches,ms:performance.now()-start,memoryBytes:session.memoryBytes};
 }else if(data.command==='long'){
  result=[];
  for(const chars of [100000,1000000])for(const pattern of ['汉','勇敢的士兵在软件开发中心使用鼠标，研究生命起源。 OpenCC 😀\n']){
   let input=pattern.repeat(Math.ceil(chars/pattern.length)).slice(0,chars);if(!input.isWellFormed())input=input.slice(0,-1);
   const t=performance.now(),output=session.convert(data.config,input),ms=performance.now()-t;
   result.push({config:data.config,chars:input.length,pattern:pattern==='汉'?'repeated-Han':'mixed',inputUtf8Bytes:new TextEncoder().encode(input).length,outputUtf8Bytes:new TextEncoder().encode(output).length,sha256:await sha(output),ms,memoryBytes:session.memoryBytes});
  }
 }else if(data.command==='first'){
  const output=session.convert(data.config,'勇敢的士兵汉字😀');
  result={config:data.config,output,ms:performance.now()-start,memoryBytes:session.memoryBytes};
 }else if(data.command==='warm'){
  const text='勇敢的士兵在软件开发中心使用鼠标。'.repeat(600).slice(0,10000),times=[];
  session.convert(data.config,text);
  for(let i=0;i<5;i++){const t=performance.now();session.convert(data.config,text);times.push(performance.now()-t);}
  result={config:data.config,timesMs:times,memoryBytes:session.memoryBytes};
 }else if(data.command==='close'){session?.close();result=true;}else throw new Error('Unknown command');
 self.postMessage({id:data.id,result});
 }catch(e){self.postMessage({id:data.id,error:e.message});}};

