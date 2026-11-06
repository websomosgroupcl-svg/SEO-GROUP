import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrationObservation,classifyAnswer,mergeObservations,panelSettings,runAiPanel} from '../lib/ai-panel.mjs';
import {wilson} from '../lib/ai-measure.mjs';
import {metricsFor} from '../lib/dashboard.mjs';
import {newSite} from '../lib/site.mjs';
import {openStore} from '../lib/store.mjs';
import {manualReview,runNext} from '../lib/reviews.mjs';

const key='clave-secreta',classifierKey='clave-gemini',now=new Date('2026-11-06T12:00:00Z'),day='2026-11-06';
const base={id:'s',url:'https://www.abogadosmunicipales.cl/',country:'Chile',aiBrands:['Abogados Municipales'],aiObservations:[]};
const site=(prompts,extra={})=>({...base,aiPrompts:prompts,...extra});
const reply=body=>({ok:true,status:200,json:async()=>body});
const own='https://www.abogadosmunicipales.cl/multas?utm_source=openai',other='https://competidor.cl/x?utm_source=openai';
const answer=(text,urls=[],status='completed')=>reply({status,output:[{type:'web_search_call',action:{query:'abogado municipal'}},{type:'message',content:[{type:'output_text',text,annotations:urls.map(url=>({type:'url_citation',url}))}]}]});
const verdict=(refersToBrand,stance)=>reply({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({refersToBrand,stance})}]}}]});
// Routes each request: OpenAI answers with Search and Gemini only classifies.
const engines=(respond,judge,seen=[])=>async(url,init)=>{
  seen.push({url,init});
  return url.includes('api.openai.com')?respond(JSON.parse(init.body)):judge();
};
const run=(prompts,fetcher,opts={})=>runAiPanel(site(prompts),{now,day,key,classifierKey,fetcher,wait:async()=>{},...opts});
const q=(text,type='recomendacion')=>({text,type});

test('el rango refleja la incertidumbre real de una muestra pequeña',()=>{
  assert.deepEqual(wilson(2,50),{low:1.1,high:13.5});
  assert.deepEqual(wilson(0,5),{low:0,high:43.4});
  assert.equal(wilson(0,0),null);
});
test('mide cita, mención y recomendación por separado y las claves no viajan en la URL',async()=>{
  const seen=[],r=await run([q('¿Qué abogado municipal recomiendas?')],engines(()=>answer('Te recomiendo Abogados Municipales.',[own,other]),()=>verdict(true,'recomienda'),seen));
  const o=r.observations[0];
  assert.equal(r.error,'');
  assert.deepEqual([o.mentioned,o.cited,o.recommended,o.stance],[true,true,true,'recomienda']);
  assert.equal(o.citedUrl,'https://www.abogadosmunicipales.cl/multas');assert.equal(o.series,'api');assert.equal(o.date,day);assert.equal(o.engine,'OpenAI API · gpt-5.4-nano');
  assert.deepEqual(o.sources,['abogadosmunicipales.cl','competidor.cl']);assert.equal(o.grounded,true);assert.deepEqual(o.queries,['abogado municipal']);
  assert(seen.every(c=>!c.url.includes(key)&&!c.url.includes(classifierKey)));
  assert.equal(seen[0].init.headers.Authorization,'Bearer '+key);assert.equal(seen[1].init.headers['x-goog-api-key'],classifierKey);
  const body=JSON.parse(seen[0].init.body);
  assert.equal(body.tool_choice,'required');assert.equal(body.max_tool_calls,1);assert.equal(o.searches,1);assert.equal(body.store,false);assert.equal(body.tools[0].user_location.country,'CL');
});
test('una frase genérica no cuenta como la marca y sin coincidencia literal no se gasta el clasificador',async()=>{
  const generic=await run([q('Pregunta')],engines(()=>answer('Consulta a Abogados Municipales de tu comuna.'),()=>verdict(false,'neutral')));
  assert.deepEqual([generic.observations[0].mentioned,generic.observations[0].recommended],[false,false]);
  let judged=0;
  const none=await run([q('Pregunta')],engines(()=>answer('Hay varios abogados municipales.',[other]),()=>{judged++;return verdict(true,'neutral');}));
  assert.equal(judged,0);assert.deepEqual([none.observations[0].mentioned,none.observations[0].cited],[false,false]);
});
test('sin clasificador la mención literal se conserva y la recomendación queda sin clasificar',async()=>{
  const r=await run([q('Pregunta')],engines(()=>answer('Abogados Municipales atiende en Santiago.'),()=>({ok:false,status:500})));
  assert.deepEqual([r.observations[0].mentioned,r.observations[0].recommended,r.observations[0].stance],[true,null,null]);
  assert.equal(await classifyAnswer('texto',base,{key:''}),null);
});
test('la pregunta de marca no suma mención, un rechazo no cuenta y una cuota detiene el panel sin exponer la clave',async()=>{
  const brand=await run([q('¿Qué es Abogados Municipales?','marca')],engines(()=>answer('Abogados Municipales es un estudio.',[own]),()=>verdict(true,'neutral')));
  assert.deepEqual([brand.observations[0].mentioned,brand.observations[0].cited,brand.observations[0].recommended],[null,true,null]);
  const refused=await run([q('Pregunta')],engines(()=>answer('',[],'incomplete'),()=>verdict(true,'neutral')));
  assert.deepEqual([refused.observations[0].cited,refused.observations[0].mentioned,refused.observations[0].status],[null,null,'rechazo']);
  let calls=0;
  const quota=await run([q('Uno'),q('Dos')],async()=>{calls++;return {ok:false,status:429};});
  assert.equal(calls,1);assert.equal(quota.observations.length,0);assert.match(quota.error,/saldo/);assert(!quota.error.includes(key));
  const down=await run([q('Uno')],async u=>{throw Error('fetch failed '+u+key);});
  assert.equal(down.error,'OpenAI no respondió.');assert(!down.error.includes(key));
});
test('sin clave ni preguntas no consulta, no repite una pregunta y respeta el intervalo entre pasadas',async()=>{
  const never=()=>{throw Error('no debe consultar');};
  assert.equal(await runAiPanel(site([q('Uno')]),{key:'',fetcher:never}),null);
  assert.equal(await runAiPanel(site([]),{key,fetcher:never}),null);
  const first=await run([q('Uno')],engines(()=>answer('Nada.'),never));
  const again=await runAiPanel(site([q('Uno')],{aiObservations:first.observations}),{now,day,key,fetcher:never,wait:async()=>{}});
  assert.equal(again.observations.length,0);
  // Spend control: no new pass until the interval has passed, and a pass cut short resumes the same day.
  const seeded=date=>site([q('Uno')],{aiObservations:[{id:'previa',series:'api',date}]});
  const onDay=(date,everyDays=7)=>runAiPanel(seeded(date),{now,day,key,fetcher:engines(()=>answer('Nada.'),never),wait:async()=>{},everyDays});
  assert.equal(await onDay('2026-11-01'),null);
  assert.equal((await onDay('2026-10-30')).observations.length,1);
  assert.equal((await onDay('2026-11-05',1)).observations.length,1);
  assert.equal((await onDay(day)).observations.length,1);
});
test('valida el panel y conserva las observaciones manuales al recortar las automáticas',()=>{
  assert.deepEqual(panelSettings({brands:[' Baja  Deuda '],prompts:[q('Uno'),q('Uno')]}),{aiBrands:['Baja Deuda'],aiPrompts:[q('Uno')]});
  for(const bad of [{brands:[],prompts:[q('Uno')]},{brands:['AB'],prompts:[]},{brands:['Marca'],prompts:[q('Uno','otro')]},{brands:['Marca'],prompts:Array.from({length:13},(_,i)=>q('P'+i))},{brands:'Marca',prompts:[]}])
    assert.throws(()=>panelSettings(bad));
  const s={aiObservations:[{id:'manual'}]};
  mergeObservations(s,Array.from({length:2001},(_,i)=>({id:'a'+i,series:'api'})));
  mergeObservations(s,[{id:'a2000',series:'api'}]);
  assert.equal(s.aiObservations.length,2001);assert.equal(s.aiObservations[0].id,'manual');assert.equal(s.aiObservations.at(-1).id,'a2000');
});
test('la calibración detecta solo la marca de este sitio y excluye los rechazos',()=>{
  const row={superficie:'ChatGPT',prompt_id:'MUN-1',rep:'2',fecha_hora:'2026-11-09T10:00:00',notas:'',respuesta:'Te sugiero Defensa TGR.',cita_url_propia:'https://defensatgr.com/x',dominios_citados:'defensatgr.com sii.cl'};
  const prompt=q('¿Qué abogado?');
  const foreign=calibrationObservation(row,base,prompt);
  assert.deepEqual([foreign.mentioned,foreign.cited,foreign.engine,foreign.series,foreign.date],[false,false,'ChatGPT (app)','app','2026-11-09']);
  const mine=calibrationObservation({...row,respuesta:'Abogados Municipales.',cita_url_propia:'https://abogadosmunicipales.cl/y'},base,prompt,{refersToBrand:true,stance:'advierte',model:'m'});
  assert.deepEqual([mine.mentioned,mine.cited,mine.recommended,mine.stance],[true,true,false,'advierte']);
  assert.equal(calibrationObservation({...row,notas:'rechazo: la superficie no respondió'},base,prompt).cited,null);
  assert.notEqual(calibrationObservation({...row,rep:'3'},base,prompt).id,foreign.id);
});
test('el informe separa motor y tipo, da rangos y suma las visitas desde IA del período',()=>{
  const row=(engine,promptType,mentioned,cited,date='2026-11-04')=>({date,engine,promptType,mentioned,cited,recommended:mentioned,series:'api'});
  const aiObservations=[row('Gemini API','recomendacion',true,true),row('Gemini API','recomendacion',false,false),row('Gemini API','marca',null,true),row('ChatGPT (app)','recomendacion',false,false),{date:'2026-11-04',engine:'Gemini API',promptType:'recomendacion',mentioned:null,cited:null,recommended:null,status:'rechazo',series:'api'}];
  const ga4AiDays=[{date:'2026-11-04',source:'chatgpt.com',sessions:7},{date:'2026-11-03',source:'gemini.google.com',sessions:3},{date:'2026-10-20',source:'chatgpt.com',sessions:2}];
  const r=metricsFor({url:base.url,aiObservations,ga4AiDays,rows:[],totals:[],tasks:[]},7,{now:new Date('2026-11-05T12:00:00Z')});
  const row1=r.ai.engines.find(e=>e.engine==='Gemini API · recomendacion');
  assert.deepEqual([row1.samples,row1.mentionsKnown,row1.mentions,row1.refused],[3,2,1,1]);
  assert.deepEqual(row1.mentionRange,wilson(1,2));assert.equal(row1.recommendRate,50);
  const brand=r.ai.engines.find(e=>e.engine==='Gemini API · marca');assert.equal(brand.mentionsKnown,0);assert.equal(brand.mentionRange,null);assert.equal(brand.citationRate,100);
  assert(r.ai.engines.some(e=>e.engine==='ChatGPT (app) · recomendacion'));
  assert.deepEqual([r.ai.visits.sessions,r.ai.visits.sources[0].source],[10,'chatgpt.com']);
  assert.equal(r.connections.ai.status,'panel');
});
test('solo la revisión diaria hace la pasada, y un error del panel no daña la revisión',async()=>{
  const store=await openStore({databaseUrl:'',file:':memory:'});
  try{
    const s=newSite({url:base.url,name:'Municipales',country:'Chile',business:'Abogados',services:'Multas',authorized:true},{id:'1'});
    await store.mutate(v=>v.sites.push(s));
    const asked=[],crawl=async()=>({pages:[],errors:[],complete:true,cursor:null,robotsBlocked:0});
    const panel=async(_,o)=>{asked.push(o.day);return {observations:[{id:'x',series:'api',engine:'OpenAI',date:o.day,prompt:'P',cited:false,mentioned:false}],error:'OpenAI sin saldo.'};};
    const ctx={crawl,panel,speed:async()=>null,backup:async()=>{}};
    await store.mutate(v=>{manualReview(v,v.sites[0]);});
    await runNext(store,ctx);
    assert.equal(asked.length,0);
    await store.mutate(v=>{v.jobs.push({id:'d',siteId:s.id,day,type:'daily',status:'pending',attempts:0,createdAt:now.toISOString(),nextRunAt:now.toISOString()});});
    await runNext(store,ctx);
    const saved=(await store.read()).sites[0];
    assert.deepEqual(asked,[day]);assert.equal(saved.aiObservations.length,1);assert.equal(saved.aiPanelError,'OpenAI sin saldo.');assert.equal(saved.reviews.length,2);
  }finally{await store.close();}
});
