import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeStatistics} from '../lib/estadistica.mjs';
import {analysisFor} from '../lib/analyst.mjs';
import {makeDemo} from '../lib/site.mjs';
import {shiftDay} from '../lib/sources.mjs';

const now=new Date('2026-11-04T16:00:00Z'),start='2026-08-20';
const n=74,daily=i=>22+2*i+[8,14,29,1,32,4,7][i%7];
function fixture(){
 return {totals:Array.from({length:n},(_,i)=>({date:shiftDay(start,i),clicks:daily(i),impressions:4*daily(i)})),analyticsDays:[]};
}
test('aprende un patrón semanal con tendencia propia y lo valida hacia delante al mismo horizonte',()=>{
 const s=analyzeStatistics(fixture(),now),c=s.series[0];
 assert.equal(c.status,'proyeccion');assert.equal(c.confidence,'alta');
 const first=(Date.parse(c.forecast.start)-Date.parse(start))/86400000;
 const correct=Array.from({length:7},(_,i)=>daily(first+i)).reduce((a,b)=>a+b);
 assert.equal(c.forecast.estimate,correct);
 assert.equal(c.forecast.start,'2026-11-05');assert.equal(c.forecast.end,'2026-11-11');
 assert.equal(c.lastDataAt,shiftDay(start,n-1));
 assert(c.backtest.weeks>=6);assert.equal(c.backtest.mae,0);assert(c.backtest.baselineMae>0);
 assert(c.forecast.low<correct&&c.forecast.high>correct);
 assert.equal(c.change.current-c.change.previous,c.change.delta);
 assert.equal(s.series[2].forecast,null);
});
test('se abstiene con huecos, datos antiguos o casi sin eventos sin inventar mediciones',()=>{
 const s=fixture();s.totals.at(-4).preliminary=true;
 const missed=analyzeStatistics(s,now).series[0];assert.equal(missed.availableDays,3);assert.equal(missed.forecast,null);
 assert.equal(missed.change,null);
 const stale=analyzeStatistics(fixture(),new Date('2026-12-04T16:00:00Z')).series[0];assert.equal(stale.forecast,null);assert.equal(stale.change.end,stale.lastDataAt);assert.match(stale.reason,/Actualizar/);
 const noEvents=analyzeStatistics({analyticsDays:fixture().totals.map(r=>({date:r.date,keyEvents:0}))},now).series[3];
 assert.equal(noEvents.forecast,null);assert.equal(noEvents.change.current,0);assert.equal(noEvents.change.percent,null);
});
test('separa series, fechas de cierre y datos preliminares, sin completar días con una fuente distinta',()=>{
 const f=fixture(),base=analyzeStatistics(f,now);
 f.totals.push({date:'2026-12-04',clicks:987654321,impressions:987654321},{date:base.series[0].lastDataAt,clicks:887999,isFinal:false},{date:'2026-11-04',clicks:999});
 f.analyticsDays=f.totals.slice(0,n).map(r=>({date:r.date,sessions:15}));
 const post=analyzeStatistics(f,now);
 assert.deepEqual(base.series[0],post.series[0]);assert.equal(post.series[2].forecast.estimate,105);
 assert.equal(post.series[2].source,'Google Analytics 4');
 assert.equal(post.series[3].forecast,null);
});
test('holdout rechaza un modelo impredecible y calcula banda a partir de errores reales',()=>{
 const s=fixture();s.totals=s.totals.map((r,i)=>({...r,clicks:[12,10,200,1,20,390][Math.floor(i/7)%6]}));
 const c=analyzeStatistics(s,now).series[0];
 assert.equal(c.status,'observacion');assert.equal(c.forecast,null);assert(c.backtest.wape>40||c.backtest.mae>1+1.25*c.backtest.baselineMae);
 const f=fixture();f.totals=f.totals.map((r,i)=>({...r,clicks:r.clicks+Math.floor(i/8)%4}));
 const noise=analyzeStatistics(f,now).series[0];
 assert(noise.backtest.mae>0);assert(noise.forecast.high-noise.forecast.low>2);
});
test('la demo muestra el analista integrado sin depender de un servicio o modelo',()=>{
 const s=makeDemo({id:'lector',name:'Equipo'}),report=analysisFor(s,new Date());
 assert.equal(report.mode,'estadistico-local');assert.equal(report.statistics.series.length,4);
 assert(report.statistics.series.every(s=>s.source.startsWith('Demostración')));
 assert(report.statistics.series.some(s=>s.forecast));assert(report.findings.some(f=>f.id.startsWith('modelo-')));
});

test('presenta el CSV como muestra de consultas y excluye días truncados del detalle de búsqueda',()=>{
 const chart={source:'CSV',series:fixture().totals},s={totals:[],rows:[]};
 const csv=analyzeStatistics(s,now,chart).series[0];
 assert.equal(csv.source,'Muestra de consultas · CSV');assert.ok(csv.forecast);
 chart.source='Detalle de Search Console';s.cappedDays=[shiftDay(csv.lastDataAt,-3)];
 assert.equal(analyzeStatistics(s,now,chart).series[0].forecast,null);
});
