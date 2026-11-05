import test from 'node:test';
import assert from 'node:assert/strict';
import {metricsFor} from '../lib/dashboard.mjs';
import {shiftDay} from '../lib/sources.mjs';

const end='2026-11-03',options={now:new Date('2026-11-04T15:00Z')};
const sequence=(n,fn)=>Array.from({length:n},(_,i)=>({date:shiftDay(end,i+1-n),...fn(i)}));
const site=extra=>({rows:[],totals:[],tasks:[],...extra});
const calc=(s,days=7)=>metricsFor(s,days,options);

test('los totales oficiales no se suman al detalle o a otro origen, posición y CTR ponderados',()=>{
  const totals=sequence(14,i=>({clicks:i===13?50:5,impressions:i===13?200:100,position:i===13?1:4}));
  const rows=[{date:end,source:'CSV',query:'comprar sillas',clicks:70,impressions:1000},{date:end,source:'Search Console',query:'cómo medir una silla',clicks:2,impressions:10}];
  const result=calc(site({totals,rows,gscProperty:'sc-domain:site.example'}));
  assert.equal(result.source,'Search Console');
  assert.equal(result.kpis.clicks.value,80);assert.equal(result.kpis.clicks.previous,35);
  assert.equal(result.kpis.ctr.value,10);assert.equal(result.kpis.ctr.delta,5);
  assert.equal(result.kpis.position.value,3.25);assert.equal(result.series.length,7);
  assert.deepEqual(result.intent,[{label:'informacional',impressions:10,share:100}]);
  assert.equal(result.highlights[0].kind,'peak');assert.equal(result.highlights[0].date,end);
});
test('días con cero, ausentes o preliminares y comparaciones insuficientes',()=>{
  const totals=sequence(14,i=>({clicks:i===13?0:5,impressions:200,position:10}));totals.splice(10,1);totals[10].preliminary=true;
  const r=calc(site({totals,rows:[{date:shiftDay(end,-3),source:'CSV',query:'cosa',clicks:8,impressions:10}]}));
  assert.equal(r.series.at(-1).clicks,0);assert.equal(r.series.at(-4).clicks,null);
  assert.equal(r.coverage.current,5);assert.equal(r.kpis.clicks.previous,null);
  assert.equal(r.kpis.clicks.delta,null);assert.equal(r.highlights.length,0);
});
test('detalle CSV y muestra demo del mismo día conservan una granularidad y excluyen candidatos',()=>{
  const base={date:end,source:'Demostración',query:'precio de silla',country:'CHL',clicks:1,impressions:10,position:10};
  const rows=[base,{...base,page:'/1'},{...base,page:'/1',clicks:2},{...base,page:'/2',impressions:20},{...base,query:'otro',date:'',impressions:100},{...base,query:'otra',observed:false}];
  const r=calc(site({rows,demo:true}));assert.equal(r.kpis.clicks.value,3);assert.equal(r.kpis.impressions.value,30);assert.equal(r.intent[0].impressions,30);
  assert.equal(r.connections.search.status,'demo');
});
test('GA4 mantiene usuarios diarios y muestras de IA incluyen negativas y desconocidos',()=>{
  const analyticsDays=sequence(14,i=>({sessions:3,activeUsers:2,keyEvents:i%2}));
  const aiObservations=[{date:end,engine:'Motor A',mentioned:true,cited:false},{date:end,engine:'Motor A',mentioned:false,cited:true},{date:end,engine:'Motor B',mentioned:null,cited:false},{date:'2024-01-01',engine:'Motor B',mentioned:true,cited:true}];
  const r=calc(site({analyticsDays,aiObservations,ga4PropertyId:'123',gscProperty:'pendiente',tasks:[{id:'m',title:'Cambio',page:'/1',appliedAt:end,verification:{at:end+'T13:00:00Z',message:'Comprobado'}}]}));
  assert.equal(r.kpis.sessions.value,21);assert(!('activeUsers' in r.kpis));assert.equal(r.series[0].activeUsers,2);
  assert.equal(r.ai.samples,3);assert.equal(r.ai.mentionRate,50);assert.equal(r.ai.citationRate,33.33);
  assert.equal(r.ai.engines[0].samples,2);assert.equal(r.annotations.length,2);
  assert.equal(r.connections.search.status,'connected');assert.equal(r.connections.search.lastDate,null);assert.equal(r.kpis.impressions.value,null);
});
test('sin registros, huecos completos, conteos IA sin inferencias y límites de rango',()=>{
  const r=calc(site({}),90);
  assert.equal(r.series.length,90);assert.equal(r.end,'2026-11-04');assert.equal(r.ai.citationRate,null);assert.equal(r.kpis.clicks.value,null);
  for(const v of [0,6,91,'error',1.7])assert.throws(()=>calc(site({}),v));
});
test('destaca series concretas sin imputar huecos de GA4 ni mezclar señales',()=>{
  const analyticsDays=sequence(14,i=>({sessions:i===13?150:60,activeUsers:3,keyEvents:i===12?1:12}));
  const totals=sequence(14,i=>({clicks:5,impressions:i===13?350:100,position:5}));
  const r=calc(site({analyticsDays,totals}));
  assert.deepEqual(r.highlights.map(x=>[x.metric,x.kind]),[['impressions','peak'],['sessions','peak'],['keyEvents','drop']]);
  assert(r.highlights.every(x=>x.baseline>0&&x.detail.includes('siete días')));
  analyticsDays.splice(10,1);
  assert.deepEqual(calc(site({analyticsDays,totals})).highlights.map(x=>x.metric),['impressions']);
});
