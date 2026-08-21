import { chromium } from '@playwright/test';
const BASE=process.argv[2], OUT=process.argv[3];
const b=await chromium.launch(); const errors=[];
async function run(name,vp){
  const c=await b.newContext({viewport:vp}); const p=await c.newPage();
  p.on('console',m=>{if(m.type()==='error')errors.push(`[${name}] ${m.text()}`);});
  p.on('pageerror',e=>errors.push(`[${name}] ${e.message}`));
  const t0=Date.now();
  await p.goto(`${BASE}/dev/landing-preview`,{waitUntil:'networkidle',timeout:120000});
  const load=Date.now()-t0; await p.waitForTimeout(2200);
  const info=await p.evaluate(()=>{const r=document.querySelector('[data-landing-root]');return{root:!!r,scroll:r?.scrollHeight,h1:document.querySelector('h1')?.textContent,xoverflow:document.documentElement.scrollWidth>window.innerWidth,reveals:document.querySelectorAll('[data-reveal]').length,hiddenReveals:[...document.querySelectorAll('[data-reveal]')].filter(e=>getComputedStyle(e).opacity==='0').length};});
  await p.screenshot({path:`${OUT}/v-${name}-top.png`});
  for(const sel of ['#demo','#why','#platform','#workflow','#data','#resources']){
    if(!(await p.$(sel)))continue;
    await p.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'start'}),sel);
    await p.waitForTimeout(1300);
    await p.screenshot({path:`${OUT}/v-${name}-${sel.slice(1)}.png`});
  }
  await p.evaluate(()=>document.querySelector('[data-landing-root]').scrollTo(0,0));
  await p.screenshot({path:`${OUT}/v-${name}-full.png`,fullPage:true});
  await c.close(); return {name,load,...info};
}
const r=[]; r.push(await run('desktop',{width:1440,height:900})); r.push(await run('mobile',{width:390,height:844}));
await b.close(); console.log(JSON.stringify({r,errors},null,1));
