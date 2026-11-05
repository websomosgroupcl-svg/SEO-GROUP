import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDemo,siteOpportunities,addTask,measure} from '../lib/site.mjs';
import {shiftDay} from '../lib/sources.mjs';

const user={id:'u',name:'Ana'},date='2026-08-14',now=new Date('2026-10-12T16:00:00Z'),prompt='¿Dónde comprar una mesa plegable de madera?';
const page='https://maderasur.example/mesas-plegables';
function fixture(){
  const s=makeDemo(user);s.demo=false;s.rows=[];s.aiObservations=[];
  const add=(engine,offset,hit,url,other=prompt)=>s.aiObservations.push({date:shiftDay(date,offset),engine,prompt:other,cited:hit,citedUrl:url});
  for(const d of [-12,-6,-1])add('Gemini',d,false);
  add('Gemini',2,true,page);add('Gemini',6,true,page);add('Gemini',15,true,s.url+'escritorios');
  add('Gemini',8,false,null,'¿Qué mesa plegable comprar?');
  for(let i=0;i<5;i++)add('Copilot',4,true,page);
  add('Gemini',35,false);add('Gemini',-30,false);
  return s;
}
test('convierte la pregunta con citas faltantes en propuesta de IA con muestra y fecha, sin volumen',()=>{
  const s=fixture(),op=siteOpportunities(s).find(o=>o.keyword===prompt&&o.target==='ia');
  assert.equal(op.source,'Observaciones manuales de IA');assert.equal(op.aiEvidence.samples,13);assert.equal(op.aiEvidence.missingCitations,5);
  assert.equal(op.page,page);assert.equal(op.clicks,null);assert.equal(op.volume,null);assert.deepEqual(op.aiEvidence.engines,['Copilot','Gemini']);
  const t=addTask(s,{opportunityId:op.id},user);assert.equal(t.target,'ia');assert.equal(t.aiContext.prompt,prompt);
  assert(siteOpportunities(makeDemo(user)).some(o=>o.target==='ia'&&o.source.includes('ejemplo')));
  s.aiObservations=s.aiObservations.filter(r=>r.cited);assert(!siteOpportunities(s).some(o=>o.aiEvidence));
});
test('evalúa citas de una URL para la misma pregunta y motor en dos ventanas equivalentes',()=>{
  const s=fixture(),t={keyword:prompt,target:'ia',page,appliedAt:date};measure(s,t,now);
  assert.equal(t.result.state,'medido');assert(!('google' in t.result.channels));
  const g=t.result.engines.find(e=>e.engine==='Gemini');assert.equal(g.before.n,3);assert.equal(g.after.n,3);assert.equal(g.after.hits,2);
  assert.equal(t.result.engines.find(e=>e.engine==='Copilot').comparable,false);assert.doesNotMatch(t.result.message,/clics/i);
  s.aiObservations=s.aiObservations.filter(r=>r.date>date);measure(s,t,now);assert.equal(t.result.state,'insuficiente');
});
test('la recomendación de ambos conserva resultados independientes y distingue muestras insuficientes',()=>{
  const s=fixture(),t={target:'ambos',keyword:prompt,page,appliedAt:date};
  s.rows=Array.from({length:57},(_,i)=>({query:prompt,page,country:'Chile',device:'',source:'CSV',date:shiftDay(date,i-28),clicks:i<=28?5:1,impressions:20}));
  measure(s,t,now);assert.equal(t.result.state,'medido');assert.equal(t.result.channels.google.recommendation,'Mejorar');assert.equal(t.result.channels.ia.recommendation,'Revisar la muestra');
  s.aiObservations=[];measure(s,t,now);assert.equal(t.result.state,'parcial');assert.match(t.result.message,/Muestra de IA insuficiente/);
  t.target='ia';measure(s,t,now);assert.equal(t.result.state,'insuficiente');assert.doesNotMatch(t.result.message,/clics/i);
});
