import test from 'node:test';
import assert from 'node:assert/strict';
import {crawlSite,extractPage} from '../lib/crawl.mjs';
import {auditSite} from '../lib/seo.mjs';
import {auditComparison,auditForSite,auditReport,rememberAudit} from '../lib/audit-report.mjs';

const root='https://furniture.example/', page=root+'product', at='2026-11-06T09:00:00.000Z';
const reply=(status,body='',headers={})=>({status,body,headers:{'content-type':'text/html',...headers}});
const text=Array.from({length:41},(_,i)=>'palabra'+i).join(' ');
const body=(extra='')=>'<html lang="es"><head><title>Catálogo</title><meta name="description" content="Breve resumen"><link rel="alternate" hreflang="en" href="/english"><link rel="canonical" href="/product"><script type="application/ld+json">{"@type":"Product"}</script></head><body><main><h1>Catálogo</h1><h2>Medidas</h2><p>'+text+'</p></main>'+extra+'</body></html>';
test('inventario y ficha: profundidad, enlaces, nofollow externo sin solicitar, 301/302, HTTP final y metadatos',async()=>{
 const site={url:root,authorized:true},seen=[];
 const fixtures={
  [root+'robots.txt']:reply(404),[root+'sitemap.xml']:reply(404),
  [root]:reply(200,body('<a href="/a">Producto</a><a href="/err">Error</a><a href="https://external.example/" rel="nofollow">Referencia</a>')),
  [root+'a']:reply(301,'',{location:'/b'}),[root+'b']:reply(302,'',{location:page}),
  [page]:reply(200,body('<img src="/imagen.png"><img src="/vacia.svg" alt="">'),{'x-robots-tag':'noindex'}),
  [root+'err']:reply(404)};
 const batch=await crawlSite(site,{request:async u=>{seen.push(u);assert(fixtures[u]);return fixtures[u]},wait:async()=>{}});
 assert(!seen.includes('https://external.example/'));assert.equal(batch.errors.length,0);
 const pages=batch.pages.map(p=>({...p,checkedAt:at})),audit=auditSite({...batch,pages});
 assert(audit.issues.some(i=>i.rule==='chain'));assert(audit.issues.some(i=>i.rule==='duplicate-title'));
 assert.equal(audit.dimensions.length,5);assert(audit.checks.every(r=>r.dimension&&r.weight>0));
 Object.assign(site,{pages,audit});rememberAudit(site,batch,pages,audit,true,at);
 const rpt=auditReport(site,{url:page}),item=rpt.page;
 assert.equal(item.schema.types[0],'Product');assert.equal(item.indexability,'noindex');assert.equal(item.depth,1);
 assert.deepEqual(item.headings.map(x=>x.level),[1,2]);
 assert.deepEqual(item.images.map(x=>x.alt),[null,'']);assert.equal(item.hreflang[0].lang,'en');
 assert.equal(item.redirects.length,2);assert.equal(item.headerRobots,'noindex');
 const redirect=auditReport(site,{url:root+'a',status:'3xx'});assert.equal(redirect.inventory.total,2);
 assert.equal(redirect.page.status,301);assert.equal(redirect.page.finalUrl,page);
 const source=auditReport(site,{url:root}).page;
 assert.equal(source.outgoing.find(x=>x.anchor==='Producto').status,301);
 assert.equal(source.outgoing.find(x=>x.anchor==='Referencia').status,null);
 assert.equal(auditReport(site,{url:root+'err'}).page.incoming[0].anchor,'Error');
 assert.equal(auditReport(site,{status:'4xx',q:'err'}).inventory.rows.length,1);
});
test('JSON-LD malformado, enlaces hreflang sin retorno, dos canónicas y contenidos duplicados',()=>{
 const p=extractPage(body().replace('<title>','<link rel="canonical" href="/"><title>').replace('{"@type":"Product"}','{'),'https://furniture.example/product');
 const en=extractPage(body().replace(/<link rel="alternate"[^>]+>/,''),root+'english');
 const audit=auditSite({pages:[p,en],complete:true,checkedAt:at});
 for(const rule of ['schema-json','multiple-canonical','hreflang-back','duplicate-content'])assert(audit.issues.some(x=>x.rule===rule),rule);
 assert.equal(p.schema.invalid,1);
});
test('dos rastreos completos de idéntica cobertura prueban cambios; cobertura distinta o parcial no declara resultados',()=>{
 const site={url:root},p=extractPage('<html lang="es"><h1>Corrección</h1></html>',root),good={...p,title:'Título corregido'};
 const batch=(pages,when,complete=true)=>{site.pages=pages.map(x=>({...x,checkedAt:when}));const b={pages:site.pages,complete,errors:[],checkedAt:when};site.audit=auditSite(b);rememberAudit(site,b,site.pages,site.audit,complete,when);};
 batch([p],at);assert.equal(auditReport(site).comparison.comparable,false);
 batch([good],at.replace('06T','07T'));assert(auditReport(site).comparison.resolved.some(x=>x.rule==='title'));
 batch([{...good,status:404}],at.replace('06T','08T'),false);assert(!auditReport(site).comparison.added.some(x=>x.rule==='http'));
 batch([good,{...good,url:page}],at.replace('06T','09T'));assert.equal(auditReport(site).comparison.comparable,false);
});
test('el historial guarda dos listas compactas y evita comparar una muestra por tamaño',()=>{
 const site={url:root},pages=[{url:root,checkedAt:at}],batch={pages};
 const longPath='á'.repeat(900);
 const issues=Array.from({length:400},(_,i)=>({id:String(i),title:'Título',rule:'title',severity:'media',url:root+longPath+i}));
 for(const day of ['06','07','08']){
   rememberAudit(site,batch,pages,{version:'test',issues},true,at.replace('06T',day+'T'));
 }
 assert.equal(site.auditHistory.length,2);
 for(const h of site.auditHistory){
   assert.equal(h.truncated,true);
   assert(Buffer.byteLength(JSON.stringify(h.issues))<=256*1024);
   assert(h.issues.length>0);
 }
 assert.equal(auditComparison(site).comparable,false);
 assert.match(auditComparison(site).reason,/256 KiB/);
});
test('la ficha del inspector y la auditoría de sitios anteriores muestran los mismos identificadores',()=>{
 const site={url:root,pages:[extractPage('<h1>Guía</h1>',root)],audit:{version:'previa',coverage:{partial:false},issues:[{id:'anterior'}]}};
 const current=auditForSite(site);
 assert.deepEqual(auditReport(site,{url:root}).page.issues.map(i=>i.id),current.issues.map(i=>i.id));
 site.audit=current;
 assert.equal(auditForSite(site),current);
});
test('la nota distingue dos fallos entre muchas comprobaciones de un resultado perfecto',()=>{
 const pages=Array.from({length:100},(_,i)=>({url:root+i,status:200,html:true,h1:'Título '+i,title:'Ficha '+i,description:'Resumen '+i,lang:'es',links:[]}));
 const before=auditSite({pages,complete:true});
 assert.equal(before.score,100);
 pages[1].title=pages[0].title;
 const after=auditSite({pages,complete:true});
 assert.equal(after.coverage.failed,2);
 assert.ok(after.score>=99&&after.score<100);
});
