import test from 'node:test';
import assert from 'node:assert/strict';
import {detail,newSite,taskView,versionPage} from '../lib/site.mjs';

test('detalle del sitio conserva la guía actual y expone todo el historial por páginas acotadas',()=>{
  const s=newSite({name:'Sitio',url:'https://ejemplo.example/',business:'Muebles',services:'mesas',country:'CL',authorized:true},{id:'editor'});
  const etc='m'.repeat(4000);
  const history=Array.from({length:23},(_,i)=>({brief:i+' '+etc,author:'Editora',at:new Date(Date.UTC(2026,9,i+1)).toISOString()}));
  s.tasks=[{id:'m',title:'Guía',brief:history.at(-1).brief,versions:history}];
  const view=detail(s,[]).tasks[0];
  assert.deepEqual(view,taskView(s.tasks[0]));assert.equal(view.brief,history[22].brief);
  assert.equal(view.versionCount,23);assert.equal(view.versions,undefined);
  const a=versionPage(s,'m'),b=versionPage(s,'m',10),c=versionPage(s,'m',20);
  assert.equal(a.total,23);assert.equal(a.versions.length,10);assert.equal(b.offset,10);
  assert.deepEqual([...a.versions,...b.versions,...c.versions],[...history].reverse());
  assert.equal(versionPage(s,'m',30).versions.length,0);
  assert.throws(()=>versionPage(s,'otra'),e=>e.status===404);
  assert.throws(()=>versionPage(s,'m',-1),e=>e.status===400);
});
