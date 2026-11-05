import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeDemoWorkshop} from '../lib/demo-taller.mjs';
import {editorialFor} from '../lib/editorial.mjs';

const base = 'https://maderasur.example/';
const at = '2025-05-23T12:00:00Z';
function legacySite() {
  const names = [['','Madera Sur'],['escritorios','Escritorios de madera'],['mesas-plegables','Mesas plegables'],['muebles-a-medida','Muebles a medida']];
  const pages = names.map(([path,name])=>({url:base+path,title:name,h1:name,status:200,html:true,links:[],canonical:base+path,description:path==='escritorios'?'':'Muebles de madera fabricados a medida en Santiago.',checkedAt:at}));
  const makeRow = date=>({query:'escritorio de madera para espacios pequeños',date,page:base+'escritorios',country:'Chile',device:'MOBILE',source:'Demostración',observed:true,clicks:2,impressions:42,position:12});
  const rows = ['2025-05-20','2025-05-21','2025-05-22'].map(makeRow);
  rows.push({...makeRow('2026-11-04'),source:'CSV'});
  return {id:'demo-test',name:'Madera Sur',url:base,business:'Taller de muebles para espacios pequeños',services:'escritorios de madera, mesas plegables',country:'Chile',demo:true,pages,rows,lastReviewAt:at,reviews:[{at,status:'demo'}],tasks:[{title:'Una tarea existente'}],aiObservations:[{engine:'manual'}]};
}

test('la muestra explica el enlazado, una mejora y una oportunidad de artículo durante sus fechas originales',()=>{
  const site = legacySite();
  const original = structuredClone(site);
  assert.equal(upgradeDemoWorkshop(site),true);
  assert.deepEqual(site.pages.map(p=>p.url),original.pages.map(p=>p.url));
  for (const page of site.pages) {
    assert.equal(page.source,'Demostración');
    assert.equal(page.synthetic,true);
    assert.equal(page.checkedAt,at);
    assert.equal(page.lang,'es-CL');
    assert.ok(page.images[0].alt);
    assert.equal(page.schema.invalid,0);
    assert.equal(page.schema.tested,1);
    assert.ok(page.outgoing.some(r=>r.internal && r.anchor && site.pages.some(p=>p.url===r.url)));
    assert.ok(page.wordCount>=30);
  }
  assert.deepEqual(site.audit.issues.map(i=>[i.url,i.rule]),[[base+'escritorios','description']]);
  assert.deepEqual(site.rows.slice(0,original.rows.length),original.rows);
  assert.deepEqual(site.rows.slice(original.rows.length).map(r=>r.date),['2025-05-20','2025-05-21','2025-05-22']);
  const ideas = editorialFor(site,site.rows,5,new Date(at)).ideas;
  const article = ideas.find(i=>i.action==='Proponer artículo complementario');
  assert.ok(article);
  assert.equal(article.page,base+'escritorios');
  assert.equal(article.evidence[0].source,'Demostración');
  for (const key of ['reviews','tasks','aiObservations','lastReviewAt']) assert.deepEqual(site[key],original[key]);
  const upgraded = structuredClone(site);
  assert.equal(upgradeDemoWorkshop(site),false);
  assert.deepEqual(site,upgraded);
});

test('respeta cambios de contenido, una observación previa y URLs nuevas del equipo',()=>{
  const site = legacySite();
  site.pages[1].description='Descripción editada por el equipo';
  site.pages[1].h1='Colección de escritorios';
  const extra = {url:base+'otra',title:'Página agregada',status:200};
  site.pages.push(extra);
  const edited = {...site.rows[0],query:'qué altura debe tener un escritorio para trabajar con una silla regulable',impressions:200};
  site.rows.push(edited);
  upgradeDemoWorkshop(site);
  assert.equal(site.pages[1].description,'Descripción editada por el equipo');
  assert.equal(site.pages[1].h1,'Colección de escritorios');
  assert.deepEqual(site.pages.at(-1),extra);
  assert.deepEqual(site.rows.filter(r=>r.date===edited.date && r.query===edited.query),[edited]);
});

test('no modifica sitios reales, variantes de URL ni demos previamente versionadas',()=>{
  for (const properties of [{demo:false},{demo:1},{url:base+'escritorios'},{url:base.slice(0,-1)},{demoWorkshopVersion:null},{demoWorkshopVersion:2}]) {
    const site = Object.assign(legacySite(),properties);
    const original=structuredClone(site);
    assert.equal(upgradeDemoWorkshop(site),false);
    assert.deepEqual(site,original);
  }
});
