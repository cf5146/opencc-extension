const worker=new Worker('./worker.mjs',{type:'module'}),pending=new Map();let id=0;
worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(new Error(data.error)):p.resolve(data.result);};
worker.onerror=e=>{for(const p of pending.values())p.reject(new Error(e.message));pending.clear();};
window.runOfficial=(command,args={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});worker.postMessage({id:key,command,...args});});
