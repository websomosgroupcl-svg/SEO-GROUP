import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverGoogle,googleStatus,indexSummary,inspectPages,matchSite} from '../lib/google-status.mjs';
import {identifyStream} from '../lib/analytics.mjs';
import {extractPage} from '../lib/crawl.mjs';
import {openStore} from '../lib/store.mjs';
import {newSite,detail} from '../lib/site.mjs';
import {runNext} from '../lib/reviews.mjs';

const now=new Date('2026-11-06T12:00:00Z'),root='https://sitio.example/';
const json=body=>({ok:true,status:200,json:async()=>body});
const pass={inspectionResult:{indexStatusResult:{verdict:'PASS',coverageState:'Enviada e indexada',googleCanonical:root,userCanonical:root}}};
const page=(path,extra={})=>({url:root+path,status:200,html:true,...extra});
const token=async kind=>'token-'+kind;
const wait=async()=>{};
const site={url:root,gscProperty:'sc-domain:sitio.example',ga4PropertyId:'145'};

function google(calls=[],overrides={}){
  return async(url,init)=>{
    calls.push({url,method:init.method,auth:init.headers.Authorization,body:init.body&&JSON.parse(init.body)});
    for(const [part,reply] of Object.entries(overrides))if(url.includes(part))return reply;
    if(url.includes('urlInspection'))return json(pass);
    if(url.endsWith('/sitemaps'))return json({sitemap:[{path:root+'sitemap.xml',errors:'2',warnings:'0',lastDownloaded:'2026-11-05',contents:[{submitted:'40'},{submitted:'2'}]}]});
    if(url.endsWith('/v2/accounts'))return json({account:[{path:'accounts/1'}]});
    if(url.endsWith('accounts/1/containers'))return json({container:[{publicId:'GTM-AAAA1',name:'Sitio',path:'accounts/1/containers/9'},{publicId:'GTM-OTRO9',name:'Ajeno',path:'accounts/1/containers/8'}]});
    if(url.endsWith('containers/9/versions:live'))return json({containerVersionId:'7',name:'Versión',tag:[{name:'GA4 WhatsApp',type:'gaawe',parameter:[{key:'eventName',value:'click_whatsapp'}]},{name:'Pausada',type:'gaawe',paused:true,parameter:[{key:'eventName',value:'envio_formulario'}]}],trigger:[{},{}]});
    if(url.endsWith('/keyEvents'))return json({keyEvents:[{eventName:'purchase'},{eventName:'click_whatsapp'},{eventName:'envio_formulario'}]});
    throw Error('Llamada inesperada: '+url);
  };
}

test('extrae los contenedores del HTML sin confundir otro texto',()=>{
  const p=extractPage('<html><head><script>x("GTM-AB12CD")</script></head><body>GTM-AB12CD ngtm-x GTM-</body></html>',root);
  assert.deepEqual(p.gtmIds,['GTM-AB12CD']);
});
test('reúne indexación, sitemaps y etiquetas solo con lecturas y solo del contenedor del sitio',async()=>{
  const calls=[],r=await googleStatus(site,[page('',{gtmIds:['GTM-AAAA1']}),page('a'),page('error',{status:404})],{now,token,wait,request:google(calls)});
  assert.deepEqual(r.errors,[]);
  assert.deepEqual(Object.keys(r.indexed).sort(),[root,root+'a']);
  assert.equal(r.indexed[root].verdict,'PASS');
  assert.deepEqual(r.sitemaps[0],{path:root+'sitemap.xml',lastSubmitted:null,lastDownloaded:'2026-11-05',errors:2,warnings:0,pending:false,urls:42});
  assert.deepEqual(r.gtm.containers.map(c=>[c.id,c.version,c.tagCount,c.triggerCount]),[['GTM-AAAA1','7',2,2]]);
  assert(!calls.some(c=>c.url.includes('containers/8/')),'no lee otro contenedor');
  // A paused tag does not send its event, so that key event deserves a check.
  assert.deepEqual(r.gtm.missingKeyEvents,['envio_formulario']);
  for(const c of calls){
    assert(c.method==='GET'||c.url.includes('urlInspection'),'solo lecturas: '+c.url);
    assert.match(c.auth,c.url.includes('tagmanager')?/tags/:c.url.includes('analyticsadmin')?/analytics/:/search/);
  }
});
test('rota las páginas, se detiene ante la cuota y cada fuente falla por su cuenta',async()=>{
  const pages=Array.from({length:30},(_,i)=>page('p'+i));
  const fresh=await inspectPages(site,pages,{token,now,request:google()});
  assert.equal(Object.keys(fresh.results).length,25);
  const known=Object.fromEntries(pages.slice(0,5).map(p=>[p.url,{checkedAt:'2026-11-01'}]));
  const asked=[];
  await inspectPages({...site,indexStatus:known},pages,{token,now,limit:5,request:async(u,i)=>{asked.push(JSON.parse(i.body).inspectionUrl);return json(pass);}});
  assert(!asked.some(u=>known[u]),'primero las nunca inspeccionadas');
  const limited=await inspectPages(site,pages,{token,now,request:async()=>({ok:false,status:429})});
  assert.match(limited.error,/cuota/);assert.equal(Object.keys(limited.results).length,0);
  const partial=await googleStatus(site,[page('',{gtmIds:['GTM-AAAA1']})],{now,token,wait,request:google([],{'/sitemaps':{ok:false,status:500},'/v2/accounts':{ok:false,status:403}})});
  assert.equal(partial.indexed[root].verdict,'PASS');assert.equal(partial.sitemaps,undefined);assert.equal(partial.gtm,undefined);
  assert.equal(partial.errors.length,2);assert.match(partial.errors.join(' '),/Sitemaps: Google respondió HTTP 500/);
});
test('GTM se lee una vez por semana y un contenedor sin acceso se informa',async()=>{
  const calls=[],recent={...site,gtm:{at:'2026-11-03T12:00:00Z'}};
  await googleStatus(recent,[page('',{gtmIds:['GTM-AAAA1']})],{now,token,wait,request:google(calls)});
  assert(!calls.some(c=>c.url.includes('tagmanager')));
  const r=await googleStatus(site,[page('',{gtmIds:['GTM-AAAA1','GTM-SINACC']})],{now,token,wait,request:google()});
  assert.deepEqual(r.gtm.notFound,['GTM-SINACC']);
});
test('el resumen separa indexadas, por revisar y canónicas que Google cambió',()=>{
  const s=indexSummary({a:{verdict:'PASS',googleCanonical:'x',userCanonical:'x'},b:{verdict:'NEUTRAL',coverage:'Rastreada: sin indexar'},c:{verdict:'PASS',googleCanonical:'y',userCanonical:'z'},d:{verdict:null}},now);
  assert.deepEqual([s.checked,s.indexed,s.problemCount,s.canonicalCount],[4,2,1,1]);
  assert.equal(s.problems[0].coverage,'Rastreada: sin indexar');assert.equal(s.canonical[0].googleCanonical,'y');
});
test('la revisión diaria guarda el estado y no lo envía completo a la ficha',async()=>{
  const store=await openStore({databaseUrl:'',file:':memory:'});
  try{
    const s=newSite({url:root,name:'Sitio',country:'Chile',business:'Muebles',services:'Mesas',authorized:true},{id:'1'});
    await store.mutate(v=>{v.sites.push(s);v.jobs.push({id:'d',siteId:s.id,day:'2026-11-06',type:'daily',status:'pending',attempts:0,createdAt:now.toISOString(),nextRunAt:now.toISOString()});});
    const crawl=async()=>({pages:[],errors:[],complete:true,cursor:null,robotsBlocked:0});
    const status=async()=>({indexed:{[root]:{verdict:'PASS',checkedAt:now.toISOString()}},sitemaps:[],errors:['Etiquetas: sin respuesta.']});
    await runNext(store,{now,crawl,status,panel:async()=>null,speed:async()=>null,backup:async()=>{}});
    const saved=(await store.read()).sites[0];
    assert.equal(saved.indexSummary.indexed,1);assert.equal(saved.googleStatusError,'Etiquetas: sin respuesta.');assert.equal(saved.reviews[0].status,'completa');
    const view=detail(saved,[]);
    assert.equal(view.indexStatus,undefined);assert.equal(view.indexSummary.checked,1);
  }finally{await store.close();}
});
test('descubre lo que la cuenta puede leer y lo empareja con cada web por dominio',async()=>{
  const found=await discoverGoogle({token,request:async url=>{
    if(url.endsWith('/webmasters/v3/sites'))return json({siteEntry:[{siteUrl:'https://a.example/',permissionLevel:'siteOwner'},{siteUrl:'https://b.example/',permissionLevel:'siteUnverifiedUser'}]});
    if(url.includes('accountSummaries'))return json({accountSummaries:[{propertySummaries:[{property:'properties/1',displayName:'Vacía'},{property:'properties/2',displayName:'A'}]}]});
    if(url.endsWith('properties/1/dataStreams?pageSize=200'))return json({});
    if(url.endsWith('properties/2/dataStreams?pageSize=200'))return json({dataStreams:[{name:'properties/2/dataStreams/20',type:'WEB_DATA_STREAM',webStreamData:{defaultUri:'https://a.example'}},{name:'properties/2/dataStreams/21',type:'ANDROID_APP_DATA_STREAM'}]});
    return {ok:false,status:403};
  }});
  assert.deepEqual(found.gsc,['https://a.example/'],'sin la propiedad no verificada');
  assert.deepEqual(found.ga4.map(p=>p.streams.length),[0,1]);
  assert.equal(found.gtm,undefined);assert.match(found.errors[0],/Tag Manager/);
  // A www site matches its bare-domain stream, but Search Console prefixes stay exact.
  const www=matchSite({url:'https://www.a.example/'},found);
  assert.deepEqual(www,{gscProperty:null,stream:{propertyId:'2',streamId:'20'},ambiguous:[]});
  assert.equal(matchSite({url:'https://a.example/'},{gsc:['sc-domain:a.example','https://a.example/']}).gscProperty,'https://a.example/');
  const twin={id:'3',streams:[{id:'30',uri:'https://a.example/'}]};
  assert.deepEqual(matchSite({url:'https://a.example/'},{ga4:[...found.ga4,twin]}),{gscProperty:null,stream:null,ambiguous:['2','3']});
  assert.equal(matchSite({url:'https://a.example/cliente/'},found).stream,null,'GA4 solo en la raíz');
});
test('identifyStream acepta un flujo sin www para una web con www',async()=>{
  const request=async()=>json({dataStreams:[{name:'properties/2/dataStreams/20',type:'WEB_DATA_STREAM',webStreamData:{defaultUri:'https://a.example'}}]});
  assert.deepEqual(await identifyStream({url:'https://www.a.example/'},'2',{token:async()=>'t',request}),{ga4PropertyId:'2',ga4StreamId:'20'});
});
