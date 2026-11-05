import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editorialFor} from '../lib/editorial.mjs';
import {newSite,evidenceRows,addTask,editTask,measure} from '../lib/site.mjs';
import {buildAnalysis,analysisFor,updateAnalysis,orderWithOllama} from '../lib/analyst.mjs';
import {openStore} from '../lib/store.mjs';

const now = new Date('2026-11-04T13:00:00Z');
const date = '2026-11-03';
const owner = {id:'editor',name:'Equipo editorial'};
function site(){
  const s=newSite({url:'https://taller.example/',name:'Muebles del sur',country:'Chile',language:'es',business:'Venta de mesas',services:'mesas plegables',authorized:true},owner);
  s.businessGoal='Solicitudes de presupuesto';
  s.pages=[{url:s.url+'mesas',status:200,html:true,noindex:false,title:'Catálogo de mesas',h1:'Mesas plegables',h2:[],links:[]}];
  return s;
}
const row=(s,overrides={})=>({page:s.pages[0].url,query:'mesa plegable para cocina',source:'Search Console',date,impressions:100,clicks:2,position:11,country:'chl',device:'MOBILE',observed:true,...overrides});
const ideas=(s,rows,limit=20)=>editorialFor(s,evidenceRows({...s,rows}),limit,now).ideas;

test('encargos requieren observaciones fechadas, finales, pertinentes y propias',()=>{
  const s=site(); const good=row(s);
  for(const bad of [{page:''},{page:'https://externo.example/mesas'},{date:''},{date:'2026-09-01'},{date:'2026-11-05'},{source:'Modelo generativo'},
    {source:'Demostración'},{observed:false},{isFinal:false},{preliminary:true},{impressions:null},{clicks:null},{clicks:101},{query:'precio de bicicletas eléctricas'}]){
    assert.deepEqual(ideas(s,[{...good,...bad}]),[],JSON.stringify(bad));
  }
  s.pages[0].noindex=true;assert.deepEqual(ideas(s,[good]),[]);
  s.pages[0].noindex=false;
  const list=ideas(s,[good]);assert.equal(list.length,1);
  assert.equal(list[0].potential.estimatedClicks,null);
  assert.equal(list[0].keyword,good.query);
  assert.equal(list[0].evidence[0].startDate,date);assert.equal(list[0].evidence[0].source,'Search Console');
  assert(list[0].longTail.every(v=>v.observed&&v.source==='Search Console'));
});

test('cada evidencia editorial corresponde a una sola URL aunque se repita la consulta',()=>{
  const s=site(), other=s.url+'otra-mesa';
  s.pages.push({...s.pages[0],url:other});
  const list=ideas(s,[row(s,{impressions:710,clicks:7}),row(s,{impressions:280,clicks:21,page:other})]);
  assert.ok(list.length);
  const check=new Map([[s.pages[0].url,[710,7]],[other,[280,21]]]);
  for(const i of list){
    assert.ok(i.evidence.length);for(const proof of i.evidence){
      assert.equal(proof.page,i.page);assert.deepEqual([proof.impressions,proof.clicks],check.get(i.page));
    }
  }
});

test('el escenario CTR requiere diez consultas distintas comparables por país y contexto',()=>{
  const s=site(),seed=row(s,{clicks:20,impressions:1000});
  const peer=(i,country='chl',suffix='')=>row(s,{query:'mesa plegable para cocina modelo '+i,page:s.url+'modelo-'+i+suffix,impressions:100,clicks:8,country});
  const peers=Array.from({length:9},(_,i)=>peer(i));
  const noisy=[...peers,peer(0,'chl','-otro'),...Array.from({length:18},(_,i)=>peer(i+30,'arg'))];
  const potential=data=>ideas(s,[seed,...data]).find(i=>i.keyword===seed.query)?.potential;
  assert.equal(potential(noisy)?.estimatedClicks,null);
  assert.equal(potential([...noisy,peer(9)])?.estimatedClicks,60);
});

test('convertir dos veces el mismo encargo conserva la edición y el responsable',t=>{
  t.mock.timers.enable({apis:['Date'],now});
  const s=site();s.rows=[row(s)];
  const first=ideas(s,s.rows)[0];
  const draft=addTask(s,{editorialId:first.id},owner);assert.ok(draft.brief.includes(first.keyword));
  editTask(s,draft.id,{brief:'Guía editada por el equipo.',responsible:'Claudia',expectedUpdatedAt:draft.updatedAt},owner);
  const same=addTask(s,{editorialId:first.id},owner);
  assert.equal(s.tasks.length,1);assert.equal(same.id,draft.id);assert.equal(same.brief,'Guía editada por el equipo.');
  assert.equal(same.responsible,'Claudia');assert.equal(same.versions.length,2);
});

test('sin fuentes el análisis aporta una acción de cobertura y no atribuye resultados',()=>{
  const s=site();s.pages=[];
  const report=buildAnalysis(s,now);
  assert.deepEqual(report.findings.map(f=>f.id),['search-source']);assert.equal(report.automatic,false);
  assert.equal(report.mode,'estadistico-local');assert.ok(report.statistics.series.every(s=>s.forecast===null));assert.equal(report.lastRunAt,null);
  assert.match(report.findings[0].next,/Search Console/);assert.equal(report.findings[0].source,'Cobertura de búsquedas');
});

test('una URL editorial nueva tiene referencia posterior propia sin atribuirle el rendimiento de su categoría', t=>{
  t.mock.timers.enable({apis:['Date'],now});
  const s=site(),query='cómo medir una mesa para un pasillo muy angosto';
  s.rows=[row(s,{query})];
  const idea=ideas(s,s.rows)[0];
  assert.equal(idea.newPage,true);assert.equal(idea.potential.estimatedClicks,null);
  const draft=addTask(s,{editorialId:idea.id},owner);
  assert.equal(draft.page,'');
  draft.page=s.url+'blog/medir-pasillo';draft.appliedAt='2026-11-04';
  s.rows.push(row(s,{query,page:draft.page,date:'2026-11-06',impressions:12,clicks:1}));
  measure(s,draft,new Date('2026-12-06T15:00:00Z'));
  assert.match(draft.result.message,/Impresiones: 12. Clics: 1. Días con datos: 1/);
  assert.equal(draft.result.channels.google.deltaClicks,null);
});

test('Ollama no disponible conserva el informe estadístico y deja libre la siguiente revisión', async t=>{
  const old=process.env.SEO_OLLAMA_MODEL;
  process.env.SEO_OLLAMA_MODEL='modelo-local:prueba';
  t.after(()=>{if(old===undefined)delete process.env.SEO_OLLAMA_MODEL;else process.env.SEO_OLLAMA_MODEL=old;});
  const db=await openStore({databaseUrl:null,file:':memory:'});t.after(()=>db.close());
  const s=site();s.lastReviewAt=now.toISOString();
  await db.mutate(st=>{st.sites.push(s);});
  let calls=0;const request=async()=>{calls++;return new Response(null,{status:503});};
  await updateAnalysis(db,s.id,{now,request});
  let actual=(await db.read()).sites[0];assert.equal(calls,1);
  assert.equal(actual.analysisRun.mode,'estadistico-local');assert.ok(actual.analysisRun.statistics);assert.ok(actual.analysisRun.findings.length>=2);
  assert.match(actual.analysisRun.aiStatus,/guardó el análisis/);
  await db.mutate(st=>{st.sites[0].lastReviewAt=new Date(+now+300000).toISOString();});
  await updateAnalysis(db,s.id,{now:new Date(+now+300000),request});
  actual=(await db.read()).sites[0];assert.equal(calls,1);assert.equal(actual.analysisHistory.length,2);
});

test('la misma revisión no duplica el historial y otra revisión diaria sí crea una entrada',async()=>{
  const db=await openStore({databaseUrl:null,file:':memory:'});
  try{
    const s=site();s.lastReviewAt=now.toISOString();
    await db.mutate(st=>{st.sites.push(s);});
    await updateAnalysis(db,s.id,{now,allowModel:false});
    await updateAnalysis(db,s.id,{now:new Date(+now+180000),allowModel:false});
    let stored=(await db.read()).sites[0];
    assert.equal(stored.analysisHistory.length,1);assert.equal(analysisFor(stored,now).automatic,true);
    const tomorrow=new Date(+now+86400000);
    await db.mutate(st=>{st.sites[0].lastReviewAt=tomorrow.toISOString();});
    await updateAnalysis(db,s.id,{now:tomorrow,allowModel:false});stored=(await db.read()).sites[0];
    assert.equal(stored.analysisHistory.length,2);assert.equal(stored.analysisRun.lastRunAt,tomorrow.toISOString());
  }finally{await db.close();}
});

test('IA local solo reordena evidencia existente y rechaza IDs inventados y modelos remotos',async()=>{
  const facts=[{id:'uno',title:'Estado',evidence:'HTTP 200'},{id:'dos',title:'Consulta',evidence:'80 impresiones'}];
  const fake=(order,remote=false)=>async(url)=>{
    assert.equal(new URL(url).origin,'http://127.0.0.1:11434');
    return Response.json(url.endsWith('/show')?(remote?{remote_host:'cloud'}:{model_info:{family:'fixture'}}):{message:{content:JSON.stringify({order})}});
  };
  const ordered=await orderWithOllama(facts,'modelo:local',{request:fake(['dos'])});
  assert.deepEqual(ordered,[facts[1],facts[0]]);
  for(const order of [['inventado'],['uno','uno'],[]])await assert.rejects(()=>orderWithOllama(facts,'modelo:local',{request:fake(order)}));
  await assert.rejects(()=>orderWithOllama(facts,'modelo:local',{request:fake(['dos'],true)}));
});
