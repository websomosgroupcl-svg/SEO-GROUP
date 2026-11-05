import test from 'node:test';
import assert from 'node:assert/strict';
import {searchTrend} from '../lib/performance.mjs';
import {evaluateChange} from '../lib/seo.mjs';
import {shiftDay} from '../lib/sources.mjs';

const end='2026-10-25',at='2026-10-28T12:00:00Z';
function sample(oldClicks,newClicks,oldImpressions=100,newImpressions=100){
 const totals=Array.from({length:14},(_,i)=>({date:shiftDay(end,i-13),clicks:i<7?oldClicks:newClicks,impressions:i<7?oldImpressions:newImpressions}));
 return {url:'https://tienda.example/',totals,rows:totals.map(r=>({...r,source:'Search Console',page:'https://tienda.example/mesas'}))};
}
test('alerta por caída o subida con semanas comparables y evidencia del sitio',()=>{
 const s=sample(10,5),r=searchTrend(s,end,at);
 assert.equal(r.alerts.length,1);assert.equal(r.alerts[0].direction,'caída');
 assert.equal(r.alerts[0].before,70);assert.equal(r.alerts[0].after,35);
 assert.equal(r.alerts[0].url,s.rows[0].page);
 assert.equal(r.alerts[0].period.beforeStart,'2026-10-12');
 assert.deepEqual(searchTrend({...s,performanceState:r.state},end,at).alerts,[]);
 const up=searchTrend({...sample(5,10),performanceState:r.state},end,at);
 assert.equal(up.alerts[0].direction,'subida');
 assert.equal(searchTrend({...s,cappedDays:[end]},end,at).alerts[0].url,s.url);
});
test('fechas ausentes, muestras pequeñas y datos parciales o desactualizados no producen alerta',()=>{
 const s=sample(10,3,50,50);
 for(const totals of [s.totals.slice(1),s.totals.map(r=>({...r,impressions:20})),s.totals.map((r,i)=>({...r,final:i!==5}))]){
   assert.deepEqual(searchTrend({...s,totals},end,at).alerts,[]);
 }
 assert.deepEqual(searchTrend(s,end,'2026-11-04T12:00:00Z').alerts,[]);
 assert.equal(searchTrend(sample(10,9),end,at).alerts.length,0);
});
test('seguimiento editorial recomienda acciones condicionadas a tráfico, visibilidad y cobertura',()=>{
 const change='2026-08-01';
 const batch=(start,clicks,impressions)=>Array.from({length:28},(_,i)=>({date:shiftDay(change,start+i),clicks,impressions}));
 const before=batch(-28,4,20);
 for(const [after,expected] of [[batch(1,2,20),'Mejorar'],[batch(1,2,10),'Revisar'],[batch(1,6,40),'Mantener'],[batch(1,1,20).slice(0,12),'Observar']]){
   assert.equal(evaluateChange({appliedAt:change,before,after,now:new Date(at)}).recommendation,expected);
 }
});
