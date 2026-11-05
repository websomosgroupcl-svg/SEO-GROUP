import test from 'node:test';
import assert from 'node:assert/strict';
import {intentGraphic,compareGraphic,enginesGraphic,healthGraphic} from '../public/graficos.js';

test('el anillo utiliza como denominador las impresiones de consultas observadas',()=>{
  const html=intentGraphic([{label:'informacional',impressions:2},{label:'comercial',impressions:6},{label:'sin datos',impressions:null}]);
  assert.match(html,/2 de 8 impresiones/);
  assert.match(html,/25 %/);
  assert.equal((html.match(/data-gfx-select=/g)||[]).length,2);
  assert.doesNotMatch(intentGraphic([]),/data-gfx-slice/);
});

test('una medición desconocida no recibe una barra de cero',()=>{
  const data={days:7,kpis:{clicks:{value:0,previous:null,coverage:{current:7,previous:2,expected:7}}}};
  const comparison=compareGraphic(data,[['clicks','Clics de Google']]);
  assert.match(comparison,/Sin comparar/);
  assert.match(comparison,/2\/7 días/);
  assert.match(comparison,/width:0%/);
  assert.match(comparison,/gfx-track is-unknown/);
  const ai=enginesGraphic([{engine:'Motor A',samples:3,citations:0,citationsKnown:0,citationRate:null,mentions:0,mentionsKnown:3,mentionRate:0}]);
  assert.match(ai,/Menciones en 0 de 3 respuestas evaluadas/);
  assert.match(ai,/Faltan respuestas evaluadas para citas/);
  assert.match(ai,/Sin evaluar/);
});

test('el gráfico técnico muestra reglas y limita su consejo a fallos confirmados',()=>{
  const audit={dimensions:[{id:'content',label:'Contenido',score:70,passed:3,failed:1,skipped:2}],
    checks:[{dimension:'content',label:'Descripción',passed:3,failed:1,skipped:2}],
    issues:[{dimension:'content',title:'Pendiente',pendingCheck:true},{dimension:'content',title:'Descripción ausente',fix:'Escribe un resumen propio.'}]};
  const html=healthGraphic(audit);
  assert.match(html,/70 \/ 100/);
  assert.match(html,/Descripción ausente/);
  assert.match(html,/Ver reglas/);
  assert.doesNotMatch(html,/Pendiente/);
});
