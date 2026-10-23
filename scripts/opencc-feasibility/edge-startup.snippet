async(page)=>{
 const results=[],url=page.url();await page.context().setOffline(true);
 try{for(let i=0;i<3;i++)for(const config of ['s2twp','s2twp_jieba']){
  await page.goto(url);
  await page.waitForFunction(()=>typeof window.runOfficial==='function');
  const init=await page.evaluate(()=>window.runOfficial('init'));
  const first=await page.evaluate(config=>window.runOfficial('first',{config}),config);
  const warm=await page.evaluate(config=>window.runOfficial('warm',{config}),config);
  results.push({iteration:i,config,init,first,warm,offline:true});
 }}finally{await page.context().setOffline(false);}
 return results;
}
