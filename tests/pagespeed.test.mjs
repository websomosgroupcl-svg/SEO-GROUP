import test from 'node:test';
import assert from 'node:assert/strict';
import {pageSpeed} from '../lib/pagespeed.mjs';
import {openStore} from '../lib/store.mjs';
import {newSite} from '../lib/site.mjs';
import {manualReview,runNext} from '../lib/reviews.mjs';

const url='https://sitio.example/',key='clave-secreta';
const sample={lighthouseResult:{categories:{performance:{score:0.42},accessibility:{score:0.9},'best-practices':{score:null},seo:{score:1}},
  audits:{'largest-contentful-paint':{numericValue:4200},'cumulative-layout-shift':{numericValue:0.12},'total-blocking-time':{numericValue:310}}},
  originLoadingExperience:{overall_category:'SLOW',metrics:{LARGEST_CONTENTFUL_PAINT_MS:{percentile:3100},INTERACTION_TO_NEXT_PAINT:{percentile:240},CUMULATIVE_LAYOUT_SHIFT_SCORE:{percentile:12}}}};
const ok=async()=>({ok:true,json:async()=>sample});

test('resume móvil y escritorio, y distingue datos de origen',async()=>{
  const seen=[];
  const r=await pageSpeed(url,{key,fetcher:(u,o)=>{seen.push(new URL(u));return ok(u,o);}});
  assert.deepEqual(seen.map(u=>u.searchParams.get('strategy')).sort(),['desktop','mobile']);
  assert.equal(seen[0].searchParams.get('url'),url);
  assert.equal(seen[0].searchParams.getAll('category').length,4);
  assert.equal(r.mobile.performance,42);assert.equal(r.mobile.bestPractices,null);
  assert.deepEqual(r.mobile.lab,{lcpMs:4200,cls:0.12,tbtMs:310});
  assert.deepEqual(r.desktop.field,{scope:'origen',category:'SLOW',lcpMs:3100,inpMs:240,cls:0.12});
});

test('sin clave no consulta; un fallo no expone la clave y una estrategia caída conserva la otra',async()=>{
  assert.equal(await pageSpeed(url,{key:'',fetcher:()=>{throw Error('no debe consultar');}}),null);
  await assert.rejects(pageSpeed(url,{key,fetcher:async u=>{throw Error('fetch failed '+u);}}),err=>{
    assert.equal(err.message.includes(key),false);assert.equal(err.message,'PageSpeed no respondió.');return true;
  });
  await assert.rejects(pageSpeed(url,{key,fetcher:async()=>({ok:false,status:429})}),/HTTP 429/);
  const partial=await pageSpeed(url,{key,fetcher:async u=>u.includes('strategy=mobile')?{ok:false,status:500}:ok()});
  assert.equal(partial.mobile,null);assert.equal(partial.desktop.performance,42);
});

test('la revisión guarda la medición y adopta la variante donde responde la web',async()=>{
  const store=await openStore({databaseUrl:'',file:':memory:'});
  try{
    const site=newSite({url,name:'Sitio',country:'CL',business:'Muebles',services:'Mesas',authorized:true},{id:'1'});
    const home='https://www.sitio.example/',asked=[];
    await store.mutate(s=>{s.sites.push(site);manualReview(s,site);});
    const crawl=async()=>({pages:[{url:home,status:200,html:true,title:'T',links:[]}],errors:[],complete:true,cursor:null,robotsBlocked:0,home,notes:['aviso de robots']});
    const speed=async target=>{asked.push(target);return {at:'2026-11-06T00:00:00.000Z',url:target,mobile:null,desktop:null};};
    await runNext(store,{crawl,speed,backup:async()=>{}});
    let saved=(await store.read()).sites[0];
    assert.deepEqual(asked,[home]);assert.equal(saved.url,home);assert.equal(saved.pagespeed.url,home);
    assert.match(saved.reviews[0].message,/aviso de robots/);assert.equal(saved.reviews[0].status,'completa');
    // A later failure keeps the last measurement and shows why it is not fresh.
    await store.mutate(s=>{manualReview(s,s.sites[0]);});
    await runNext(store,{crawl,speed:async()=>{throw Object.assign(Error('PageSpeed respondió HTTP 429.'),{status:502});},backup:async()=>{}});
    saved=(await store.read()).sites[0];
    assert.equal(saved.pagespeed.url,home);assert.equal(saved.pagespeedError,'PageSpeed respondió HTTP 429.');assert.equal(saved.reviews[0].status,'completa');
  }finally{await store.close();}
});
