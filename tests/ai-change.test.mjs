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
// A daily panel: one answer per day, cited or not, in the windows around the change.
function daily(s,engine,hitsBefore,hitsAfter,{other=prompt,promptType}={}){
  for(let d=1;d<=24;d++){
    s.aiObservations.push({date:shiftDay(date,-d),engine,prompt:other,promptType,cited:d<=hitsBefore,citedUrl:d<=hitsBefore?page:''});
    s.aiObservations.push({date:shiftDay(date,d),engine,prompt:other,promptType,cited:d<=hitsAfter,citedUrl:d<=hitsAfter?page:''});
  }
}
test('un cambio solo se declara cuando los rangos de las dos ventanas no se cruzan',()=>{
  const reading=(before,after,engine='Gemini')=>{const s=fixture();s.aiObservations=[];daily(s,engine,before,after);const t={keyword:prompt,target:'ia',page,appliedAt:date};measure(s,t,now);return t.result;};
  assert.equal(reading(0,12).recommendation,'Mejora demostrada');
  assert.equal(reading(12,0).recommendation,'Caída demostrada');
  const noise=reading(1,3);assert.equal(noise.state,'medido');assert.equal(noise.recommendation,'Sin cambio demostrable');assert.match(noise.message,/se cruzan/);
  const drift=fixture();drift.aiObservations=[];daily(drift,'Gemini',0,12);daily(drift,'Gemini',0,12,{other:'Pregunta de control',promptType:'control'});
  const t={keyword:prompt,target:'ia',page,appliedAt:date};measure(drift,t,now);
  assert.equal(t.result.recommendation,'Revisar la muestra');assert.match(t.result.message,/control/);
});
test('tres respuestas ya no bastan para medir una cita',()=>{
 const s=fixture(),t={keyword:prompt,target:'ia',page,appliedAt:date};measure(s,t,now);
  assert.equal(t.result.state,'insuficiente');assert(!('google' in t.result.channels));assert.match(t.result.message,/al menos 20 respuestas/);
  const g=t.result.engines.find(e=>e.engine==='Gemini');assert.equal(g.before.n,3);assert.equal(g.after.n,3);assert.equal(g.after.hits,2);assert.equal(g.comparable,false);
  assert.equal(t.result.engines.find(e=>e.engine==='Copilot').comparable,false);assert.doesNotMatch(t.result.message,/clics/i);
});
test('la recomendación de ambos conserva resultados independientes y distingue muestras insuficientes',()=>{
  const s=fixture(),t={target:'ambos',keyword:prompt,page,appliedAt:date};
  s.rows=Array.from({length:57},(_,i)=>({query:prompt,page,country:'Chile',device:'',source:'CSV',date:shiftDay(date,i-28),clicks:i<=28?5:1,impressions:20}));
  s.aiObservations=[];daily(s,'Gemini',1,3);
  measure(s,t,now);assert.equal(t.result.state,'medido');assert.equal(t.result.channels.google.recommendation,'Mejorar');assert.equal(t.result.channels.ia.recommendation,'Sin cambio demostrable');
  s.aiObservations=[];measure(s,t,now);assert.equal(t.result.state,'parcial');assert.match(t.result.message,/Muestra de IA insuficiente/);
  t.target='ia';measure(s,t,now);assert.equal(t.result.state,'insuficiente');assert.doesNotMatch(t.result.message,/clics/i);
});
