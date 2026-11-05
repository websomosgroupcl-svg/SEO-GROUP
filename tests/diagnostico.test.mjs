import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnose} from '../lib/diagnostico.mjs';
import {extractPage} from '../lib/crawl.mjs';
import {handle} from '../lib/api.mjs';
import {openStore} from '../lib/store.mjs';
import {createUser,login,sessionCookie} from '../lib/auth.mjs';

const url='https://taller.example/', page=url+'mesas';
const native='\uFEFFConsultas principales,Clics,Impresiones,CTR,Posición\r\nmesa para cocina pequeña,3,120,2.5%,9.8';
const detail='Query;Page;Date;Clicks;Impressions;Position;Country;Device\nmesa para cocina pequeña;'+page+';20261101;3;120;9,8;CHL;MOBILE';
const search='mesa para cocina pequeña';
const never=()=>{throw Error('El flujo de archivos intentó un rastreo.');};

test('acepta el CSV nativo de Consultas sin fingir URL ni fechas, también en una sesión demo',async()=>{
  const r=await diagnose({gscCsv:native},{demo:true,crawl:never});
  assert.equal(r.demo,false);assert.equal(r.sessionDemo,true);assert.equal(r.technical,null);assert.equal(r.url,null);
  assert.equal(r.keywords[0].keyword,search);assert.equal(r.keywords[0].longTail,true);
  assert.equal(r.keywords[0].position,9.8);assert.equal(r.keywords[0].ctr,.025);assert.equal(r.keywords[0].page,null);
  assert.equal(r.keywords[0].start,null);assert.deepEqual(r.gaps,[]);assert.match(r.limitations.join(' '),/sin fecha/);
});

test('respeta autorización, alcance, robots y límites del rastreo; conserva errores junto a la evidencia',async()=>{
  let called=0;
  const crawl=async(site,options)=>{
    called++;assert.deepEqual(site,{url,authorized:true});assert.equal(options.maxPages,4);assert(options.timeBudgetMs<=10000);
    const html='<html lang="es"><head><title>Catálogo</title></head><body><h1>Mesas</h1><main><p>Elige una medida de nuestro catálogo.</p></main></body></html>';
    return {pages:[extractPage(html,page)],complete:false,errors:[{url:url+'caida',message:'HTTP 503'}],skipped:[url+'privada'],robotsBlocked:1};
  };
  for(const data of [{url},{url:'http://127.0.0.1',authorized:true},{url:'https://foo.local',authorized:true},{url:'https://a:b@c.example',authorized:true},{url:'file:///C:/secreto',authorized:true}]){
    await assert.rejects(()=>diagnose(data,{crawl}),e=>e.status===400);
  }
  await assert.rejects(()=>diagnose({url,authorized:true},{crawl,demo:true}),e=>e.status===403);
  await assert.rejects(()=>diagnose({url,authorized:true,gscCsv:detail.replace(page,'https://otro.example/hola')},{crawl}),e=>e.status===400);
  assert.equal(called,0);
  const r=await diagnose({url,authorized:true,gscCsv:detail},{crawl});
  assert.equal(called,1);assert.equal(r.keywords[0].start,'2026-11-01');assert.equal(r.keywords[0].page,page);
  assert(r.technical.score<100);assert(r.technical.coverage.partial);assert(r.technical.issues.some(i=>i.rule==='description'));
  assert.equal(r.gaps[0].keyword,search);assert.match(r.gaps[0].evidence,/sin coincidencia literal/);
  assert.equal(r.technical.errors[0].message,'HTTP 503');assert.deepEqual(r.technical.blocked,[url+'privada']);
});

test('no atribuye la consulta a otra URL, a un noindex o a una búsqueda ya cubierta',async()=>{
  const pages=[{url:page,status:200,noindex:true,title:'Mesas'}, {url:url+'otra',status:200,title:'Muebles'}];
  const data={url,authorized:true,gscCsv:detail};
  const crawl=async()=>({pages,complete:true});
  assert.deepEqual((await diagnose(data,{crawl})).gaps,[]);
  pages[0]={url:page,status:200,title:'Catálogo',h2:['¿Buscas una mesa para cocina pequeña?']};
  assert.deepEqual((await diagnose(data,{crawl})).gaps,[]);
  pages.shift();assert.deepEqual((await diagnose(data,{crawl})).gaps,[]);
});

test('separa GA4 por páginas y fechas; acepta ES/EN y metadatos, omite totales/sin asignar',async()=>{
  const es='# Inicio del informe\n# Fecha de inicio: 20261001\n# Fecha de finalización: 20261031\nPágina de destino + cadena de consulta;Sesiones;Eventos clave;Total de ingresos\n;50;5;0\n(not set);5;0;0\n/mesas?color=rojo;45;5;0';
  const r=await diagnose({ga4Csv:es,gscCsv:native},{crawl:never});
  assert.deepEqual(r.analytics.period,{start:'2026-10-01',end:'2026-10-31'});assert.equal(r.analytics.omitted,2);
  assert.deepEqual(r.analytics.rows,[{path:'/mesas?color=rojo',date:'',sessions:45,keyEvents:5}]);
  assert.equal(r.keywords[0].keyEvents,undefined);assert.equal(r.keywords[0].page,null);
  const en='Landing page + query string,Sessions,Key events,Date\n/mesas,0,,20261101';
  const english=await diagnose({ga4Csv:en},{crawl:never});assert.deepEqual(english.analytics.rows,[{path:'/mesas',date:'2026-11-01',sessions:0,keyEvents:null}]);
});

test('valida filas/cabeceras y conserva el resto del informe ante fallo del rastreo',async()=>{
  for(const data of [{},{gscCsv:native.replace(',3,120,',',130,120,')},{ga4Csv:'Landing page,Active users\n/a,3'},{gscCsv:'Consulta,Consulta\na,b'},
    {ga4Csv:'Landing page,Sessions\n//extrano.example/,3'},{gscCsv:'x'.repeat(750001)}])await assert.rejects(()=>diagnose(data,{crawl:never}),e=>e.status===400);
  const r=await diagnose({url,authorized:true,gscCsv:native},{crawl:async()=>{throw Error('DNS no público');}});
  assert.equal(r.technical.score,null);assert.equal(r.technical.errors[0].message,'DNS no público');assert.equal(r.keywords.length,1);
});

test('el ejemplo es explícito, autocontenido y no se mezcla con archivos reales',async()=>{
  const r=await diagnose({example:true},{demo:true,crawl:never});
  assert.equal(r.demo,true);assert(r.technical.coverage.pages>0);assert(r.keywords.length>0);assert(r.analytics.rows.length>0);
  await assert.rejects(()=>diagnose({example:true,gscCsv:native},{crawl:never}),e=>e.status===400);
});

test('la ruta exige sesión y el diagnóstico real autorizado no crea sitios ni trabajos',async()=>{
  const store=await openStore({databaseUrl:null,file:':memory:'});
  try{
    const data={url,authorized:true,gscCsv:detail};
    const post=cookie=>new Request('http://localhost/api/diagnostico',{method:'POST',headers:{'Content-Type':'application/json',...cookie&&{cookie}},body:JSON.stringify(data)});
    const denied=await handle(post(),{store});assert.equal(denied.status,401);
    const credentials={email:'diagnostico@equipo.example',password:'solo-para-las-pruebas-2026'};
    await createUser(store,{...credentials,name:'Editora'});
    const session=await login(store,credentials);
    const diagnostic=(input,options)=>diagnose(input,{...options,crawl:async()=>({pages:[extractPage('<html><title>Muebles</title><h1>Catálogo</h1></html>',page)],complete:true})});
    const r=await handle(post(sessionCookie(session.token).split(';')[0]),{store,diagnostic});
    assert.equal(r.status,200);const report=await r.json();assert.equal(report.demo,false);assert.equal(report.technical.coverage.pages,1);
    const saved=await store.read();assert.deepEqual(saved.sites,[]);assert.deepEqual(saved.jobs,[]);
  }finally{await store.close();}
});
test('el informe descargable conserva las filas posteriores a la vista previa',async()=>{
  const csv='Consulta,Clics,Impresiones\n'+Array.from({length:120},(_,i)=>'consulta modelo '+i+',1,12').join('\n');
  const report=await diagnose({gscCsv:csv});
  assert.equal(report.counts.keywords,120);
  assert.equal(report.keywords.length,120);
  assert.ok(report.limitations.some(x=>x.includes('todos los resultados procesados')));
});
