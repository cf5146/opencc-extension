async(page)=>{
 if(!page.url().startsWith('chrome-extension://'))throw new Error('Navigate to the probe extension first');
 await page.reload();
 await page.waitForFunction(()=>typeof window.runOfficial==='function');
 const result={edgeVersion:page.context().browser().version(),init:await page.evaluate(()=>window.runOfficial('init'))};
 result.corpus=await page.evaluate(()=>window.runOfficial('corpus'));
 result.long=[];
 for(const config of ['s2t','s2tw','s2twp','s2hk','tw2sp'].flatMap(c=>[c,c+'_jieba']))result.long.push(...await page.evaluate(config=>window.runOfficial('long',{config}),config));
 result.warm=[];
 for(const config of ['s2twp','s2twp_jieba'])result.warm.push(await page.evaluate(config=>window.runOfficial('warm',{config}),config));
 await page.evaluate(()=>window.runOfficial('close'));
 return result;
}
