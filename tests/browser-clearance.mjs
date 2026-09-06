import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page = await browser.newPage();
 page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/?test=1');
 await page.waitForFunction(()=>window.pinball?.getRenderInfo().loaded);
 const result=await page.evaluate(async()=>{
   const {sweepTable}=await import('/tests/clearance-sweep.js');
   return sweepTable(window.__pinballTest.game);
 });
 await mkdir('test-results',{recursive:true});
 await writeFile('test-results/clearance-browser.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
 expect(errors).toEqual([]);
 if(process.env.CLEARANCE_ENFORCE === '1') expect(result.traps).toEqual([]);
} finally {await browser.close();}
