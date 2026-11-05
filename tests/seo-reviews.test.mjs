import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore,claimJob} from '../lib/store.mjs';
import {newSite} from '../lib/site.mjs';
import {schedule,runNext,localDay} from '../lib/reviews.mjs';

const make=()=>newSite({url:'https://shop.example.org/',name:'Tienda',country:'CL',business:'Muebles',services:'Mesas',authorized:true},{id:'1'});
const page=(url,title)=>({url,title,h1:'Mesas',description:'Muebles',html:true,imageCount:0,status:200,links:[]});
const snap=(pages,opts={})=>({pages,errors:[],complete:true,cursor:null,robotsBlocked:0,...opts});
async function drain(store,ctx){let n=0;while(await runNext(store,ctx)){if(++n>10)throw Error('Repetición indefinida');}return n;}
const later=(d,h=12)=>new Date('2026-09-'+String(d).padStart(2,'0')+'T'+String(h).padStart(2,'0')+':00:00Z');

test('dos ciclos simulados con reloj inyectado, cursor recuperado y errores de fuente sin caída SEO',async()=>{
 const st=await openStore({databaseUrl:'',file:':memory:'});
 try {
   const s=make();s.gscProperty='sc-domain:shop.example.org';await st.mutate(v=>v.sites.push(s));
   const seen=[], apiCalls=[];let p=0;
   const crawls=[
     snap([page(s.url,'')],{complete:false,cursor:{queue:[s.url+'dos'],visited:[s.url]}}),
     snap([page(s.url+'dos','Dos')]),
     snap([],{complete:false,errors:[{url:s.url,message:'Error de origen'}]})
   ];
   const crawl=async(site,opts)=>{seen.push(opts.cursor);return crawls[p++];};
   const source=async(site,{now})=>{
     apiCalls.push(localDay(now));
     if(apiCalls.length>1)throw Error('error simulado');
     return {totals:[{date:'2026-09-01',clicks:2,impressions:20}],rows:[{date:'2026-09-01',query:'mesas',page:s.url,source:'Search Console',clicks:2,impressions:20}],capped:[]};
   };
   const ctx={now:later(5),crawl,source,backup:async()=>{}};
   await st.mutate(v=>schedule(v,ctx));
   await st.mutate(v=>schedule(v,ctx));
   assert.equal((await st.read()).jobs.length,2);
   // Process died after claiming a job. The next hourly trigger acquires an expired lease.
   await st.mutate(v=>claimJob(v,{now:ctx.now,leaseMs:1000}));
   ctx.now=later(5,13);await drain(st,ctx);
   const issue=(await st.read()).sites[0].audit.issues.find(i=>i.rule==='title');
   assert.ok(issue);
   await st.mutate(v=>v.sites[0].tasks.push({origin:'issue:'+issue.id,page:s.url,status:'en_curso'}));
   ctx.now=later(5,14);await st.mutate(v=>schedule(v,ctx));await drain(st,ctx);
   assert.equal(seen[1].queue[0],s.url+'dos');assert.equal(apiCalls.length,1);
   const second=(await st.read()).sites[0];
   assert.equal(second.crawlCursor,null);assert.equal(second.rows.length,1);
   assert.equal(second.audit.issues.find(i=>i.id===issue.id).checkedAt,later(5,13).toISOString());
   ctx.now=later(6);
   await st.mutate(v=>schedule(v,ctx));await drain(st,ctx);
   const v=await st.read(),site=v.sites[0];
   assert.equal(v.jobs.filter(j=>j.type==='daily'&&j.status==='done').length,2);
   assert.equal(site.audit.score,null);assert.equal(site.audit.coverage.pages,0);
   assert.equal(site.rows[0].clicks,2);assert.equal(site.totals[0].impressions,20);
   assert.equal(site.reviews[0].status,'parcial');
   assert.equal(site.audit.issues.find(i=>i.id===issue.id).pendingCheck,true);
   assert.notEqual(site.tasks[0].verification?.state,'revisada');
 }finally{await st.close();}
});

test('no declara corregido un enlace roto por no revisar su destino durante un lote',async()=>{
 const st=await openStore({databaseUrl:'',file:':memory:'});
 try{
   const site=make();await st.mutate(v=>v.sites.push(site));
   const root={...page(site.url,'Mesas'),links:[site.url+'roto']};
   let current=snap([root,{...page(site.url+'roto',''),status:404}]);
   const ctx={now:later(3),backup:async()=>{},crawl:async()=>current};
   await st.mutate(v=>schedule(v,ctx));await drain(st,ctx);
   const issue=(await st.read()).sites[0].audit.issues.find(i=>i.rule==='broken');
   await st.mutate(v=>v.sites[0].tasks.push({origin:'issue:'+issue.id,page:root.url,status:'aplicada'}));
   ctx.now=later(4);current=snap([root],{complete:false,cursor:{visited:[root.url],queue:[site.url+'roto']}});
   await st.mutate(v=>schedule(v,ctx));await drain(st,ctx);
   const s=(await st.read()).sites[0];assert.ok(s.audit.issues.find(i=>i.id===issue.id));assert.notEqual(s.tasks[0].verification?.state,'revisada');
   ctx.now=later(11);current=snap([root,page(site.url+'roto','Recuperada')]);await st.mutate(v=>schedule(v,ctx));await drain(st,ctx);
   assert.equal((await st.read()).sites[0].tasks[0].verification.state,'revisada');
 } finally {await st.close();}
});
