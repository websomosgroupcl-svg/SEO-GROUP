import test from 'node:test';
import assert from 'node:assert/strict';
import {crawlSite,extractPage,publicAddress,siteURL} from '../lib/crawl.mjs';
import {auditSite,opportunities,briefFor,evaluateChange} from '../lib/seo.mjs';

const site={url:'https://tienda.example.org/',name:'Tienda',services:'escritorios, sillas',country:'CL',authorized:true};
const home=site.url;
const reply=(status,body='',content='text/html',extra={})=>({status,body,headers:{'content-type':content,...extra}});
const good=(title,links='')=>'<html><head><title>'+title+'</title><meta name="description" content="Ficha"></head><body><h1>'+title+'</h1>'+links+'</body></html>';

test('rastreo reanudable respeta robots y nofollow, encuentra sitemap y enlaza incidencia 404',async()=>{
  const visited=[];
  const fixtures={
    [home+'robots.txt']:reply(200,'User-agent: *\nDisallow: /privado\n','text/plain'),
    [home+'sitemap.xml']:reply(200,'<urlset><url><loc>'+home+'catalogo</loc></url></urlset>','text/xml'),
    [home]:reply(200,good('Inicio','<a href="/error">Roto</a><a href="/privado">Privado</a><a rel="nofollow" href="/perfil">Perfil</a>')),
    [home+'catalogo']:reply(200,good('Catálogo')),
    [home+'error']:reply(404)
  };
  const opts={wait:async()=>{},request:async url=>{visited.push(url);assert.ok(fixtures[url],url);return fixtures[url];},maxPages:1};
  const a=await crawlSite(site,opts);
  assert.equal(a.pages.length,1);assert.ok(a.cursor);assert.equal(a.complete,false);
  const b=await crawlSite(site,{...opts,maxPages:10,cursor:a.cursor});
  assert.equal(b.robotsBlocked,1);assert.equal(b.complete,true);
  assert.equal(visited.includes(home+'privado'),false);assert.equal(visited.includes(home+'perfil'),false);
  assert.equal(visited.filter(x=>x===home).length,1);
  const audit=auditSite({...b,pages:[...a.pages,...b.pages]});
  assert.ok(audit.issues.some(x=>x.rule==='broken'&&x.url===home&&x.evidence.includes('404')));
  assert.equal(audit.coverage.partial,true);
  assert.equal(audit.coverage.eligible,2);
});

test('DNS rechaza destinos internos y metadatos en notación alternativa',()=>{
  for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','::ffff:127.0.0.1','fd00::1','192.168.1.1','::1','fe80::1','100.64.0.1','0.0.0.0','2002:7f00:1::']) assert.equal(publicAddress(address),false,address);
  for(const url of ['https://2130706433/','http://0x7f000001','https://localhost','https://usr@8.8.8.8','http://8.8.8.8:3000']) assert.throws(()=>siteURL(url));
  assert.ok(publicAddress('1.1.1.1'));assert.ok(publicAddress('2606:4700:4700::1111'));
});

test('el permiso de una carpeta excluye carpetas hermanas incluso en redirecciones, enlaces y sitemap',async()=>{
 const base=home+'cliente-a/',sibling=home+'cliente-b/privado',escaped=base+'x%2f..%2f..%2fcliente-b/privado';
 const visited=[];
 const fixtures={
   [home+'robots.txt']:reply(200,'Sitemap: '+home+'sitemap.xml','text/plain'),
   [home+'sitemap.xml']:reply(200,'<urlset><url><loc>'+sibling+'</loc></url><url><loc>'+base+'publico</loc></url></urlset>','text/xml'),
   [base]:reply(200,good('Inicio','<a href="'+sibling+'">B</a><a href="'+escaped+'">C</a><a href="'+base+'salto">Salto</a>')),
   [base+'publico']:reply(200,good('Interior')),
   [base+'salto']:reply(302,'','',{location:sibling})
 };
 const r=await crawlSite({...site,url:base},{priorityUrls:[sibling,home+'cliente-a-extra/'],wait:async()=>{},request:async url=>{
   visited.push(url);assert.ok(fixtures[url],url);return fixtures[url];
 }});
 assert.deepEqual(new Set(visited),new Set(Object.keys(fixtures)));
 assert.ok(r.errors.some(x=>x.url===base+'salto'&&x.message.includes('fuera del sitio')));
 assert.deepEqual(r.pages.find(p=>p.url===base).links,[base+'salto']);
 assert.deepEqual(r.pages.map(p=>p.url).sort(),[base,base+'publico'].sort());
});

test('no accede a redirecciones fuera de alcance; robots no disponible impide rastreo',async()=>{
  let calls=0;
  const blocked=await crawlSite(site,{wait:async()=>{},request:async()=>{calls++;return reply(503);}});
  assert.equal(calls,1);assert.equal(auditSite(blocked).score,null);assert.equal(blocked.complete,false);
  const urls=[];
  const batch=await crawlSite(site,{wait:async()=>{},request:async url=>{
    urls.push(url);return url===home?reply(302,'','',{location:'http://169.254.169.254/latest'}):reply(404);
  }});
  assert.equal(urls.length,3);assert.equal(batch.errors.length,1);assert.equal(batch.pages.length,0);
  await assert.rejects(crawlSite({...site,authorized:false},{request:async()=>assert.fail('forbidden')}));
});

test('HTML distingue alt vacío decorativo de atributo faltante',()=>{
 const p=extractPage(good('Mesas','<img src="/1" alt=""><img src="/2">'),home,200,{'x-robots-tag':'noindex'});
 assert.equal(p.noindex,true);assert.equal(p.missingAlt,1);assert.equal(p.imageCount,2);
 const a=auditSite({pages:[p],complete:true});assert.ok(a.score>0&&a.score<100);
 assert.ok(a.issues.find(x=>x.rule==='alt'));assert.ok(a.issues.find(x=>x.rule==='noindex'));
});

test('preserva país, origen e intención y calcula posición ponderada sin fabricar volumen',()=>{
  const base={query:'escritorios para espacios pequeños',page:home+'escritorios',source:'Search Console',date:'2026-10-01',country:'CL',device:'MOBILE',impressions:40,clicks:2,position:8};
  const obs=[base,base,{...base,date:'2026-10-02',impressions:10,position:18,clicks:1},{...base,country:'PE'},{...base,source:'CSV'},
   {query:'escritorios sin cajones',observed:false,source:'CSV'},{...base,query:'escritorios',clicks:null}];
  const out=opportunities(site,obs);
  const k=out.find(x=>x.keyword===base.query&&x.source===base.source&&x.country==='CL');
  assert.equal(k.impressions,50);assert.equal(k.clicks,3);assert.equal(k.position,10);assert.equal(k.volume,null);assert.equal(k.longTail,true);
  assert.equal(out.filter(x=>x.keyword===base.query).length,3);assert.equal(out.find(x=>x.keyword==='escritorios sin cajones').observed,false);
  assert.equal(out.find(x=>x.keyword==='escritorios').clicks,null);
  assert.match(briefFor(site,k),/escritorios para espacios pequeños/);
  assert.ok(out.every(x=>x.observed||x.volume===null&&x.clicks===null));
});

test('seguimiento usa ventanas completas y conserva observación con muestra parcial',()=>{
 const change='2026-09-07', now=new Date('2026-10-25'), day=86400000;
 const series=(offset,v)=>Array.from({length:28},(_,i)=>({date:new Date(Date.parse(change)+(i+offset)*day).toISOString().slice(0,10),clicks:v,impressions:10}));
 const before=series(-28,1), after=series(1,2);
 assert.equal(evaluateChange({appliedAt:change,before,after,now}).deltaClicks,28);
 assert.equal(evaluateChange({appliedAt:change,before,after:after.slice(1),now}).state,'insuficiente');
 assert.equal(evaluateChange({appliedAt:change,before,after,now:new Date('2026-09-09')}).state,'esperando');
});

test('un encabezado rastreado es evidencia del tema pero no de su volumen de búsquedas',()=>{
 const p=extractPage(good('Escritorios de madera','<h2>Escritorios para habitaciones pequeñas</h2>'),home);
 const strong={query:'cómo medir mi escritorio para el dormitorio',page:home,source:'Search Console',date:'2026-10-01',country:'CL',impressions:180,clicks:24,position:2};
 const batch=opportunities(site,[strong,{...strong,query:'cómo medir un escritorio para una pieza pequeña'}],[p]);
 const observed=batch.find(x=>x.keyword===strong.query),suggested=batch.find(x=>x.source==='Encabezado del sitio');
 assert.equal(observed.action,'Mantener');
 assert.ok(suggested);assert.equal(suggested.observed,false);assert.equal(suggested.impressions,null);
 assert.equal(suggested.volume,null);assert.equal(suggested.evidence.page,home);assert.equal(suggested.evidence.heading,p.h2[0]);
 const brief=briefFor(site,observed);
 assert.ok(brief.includes('cómo medir un escritorio para una pieza pequeña (Search Console, observada)'));assert.ok(brief.includes(home));
});
