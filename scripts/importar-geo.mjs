// Imports the browser measurements of the GEO plan as the calibration series, and seeds each site's prompts and brand names.
// Usage: npm.cmd run importar-geo -- "C:\ruta\PLAN GEO LANDINGS ABOGADOS"   Running it again adds only new rows.
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'csv-parse/sync';
import {openStore} from '../lib/store.mjs';
import {newSite} from '../lib/site.mjs';
import {calibrationObservation,classifyAnswer,literalMention,mergeObservations} from '../lib/ai-panel.mjs';

const root=process.argv[2];
if(!root)throw Error('Indica la carpeta del plan GEO.');
const text=name=>readFile(join(root,name),'utf8');
const kinds={I:'informativa',R:'recomendacion',M:'marca'};
const bare=url=>new URL(url).hostname.replace(/^www\./,'');

const prompts=new Map([...(await text('plan-geo-abogados-2026.md')).matchAll(/^\| ([A-Z]{3}-M?\d) \| ([IRM]) \| (.+?) \|\s*$/gm)].map(m=>[m[1],{text:m[3].trim(),type:kinds[m[2]]}]));
const urls=new Map([...(await text('fase1/gsc.py')).matchAll(/"([A-Z]{3})": "(https:\/\/[^"]+)"/g)].map(m=>[m[1],m[2]]));
const brandBlock=(await text('fase0/baseline.py')).split('BRANDS = {')[1].split('\n}')[0];
const brands=new Map([...brandBlock.matchAll(/"([^"]+)": \[([^\]]+)\]/g)].map(m=>[m[1],[...m[2].matchAll(/"([^"]+)"/g)].map(x=>x[1])]));
if(!prompts.size||!urls.size||!brands.size)throw Error('No se reconoció el formato del plan GEO.');

const files=[];
for(const name of await readdir(join(root,'fase0')))if(/^(baseline|marca)_.*\.csv$/.test(name))files.push(join('fase0',name));
for(const name of await readdir(join(root,'fase0/seguimiento')).catch(()=>[]))if(name.endsWith('.csv'))files.push(join('fase0/seguimiento',name));
const rows=[];
for(const file of files)rows.push(...parse(await text(file),{columns:true,bom:true,skip_empty_lines:true,max_record_size:200000}));

const store=await openStore();
try{
  const state=await store.read({keys:['sites']});
  const fresh=[],bySite=new Map();
  for(const [code,url] of urls){
    let site=state.sites.find(s=>!s.demo&&bare(s.url)===bare(url));
    const names=brands.get(bare(url));
    if(!site){
      if(store.backend!=='sqlite'){console.log(code+': sin ficha en este almacén, se omite.');continue;}
      site=newSite({url,name:names[0],country:'Chile',business:'Servicios legales',services:names[0],authorized:true},{id:'importacion'});
      fresh.push(site);
    }
    bySite.set(code,{...site,aiBrands:site.aiBrands?.length?site.aiBrands:names});
  }
  const incoming=new Map();
  let classified=0;
  for(const row of rows){
    const code=row.prompt_id?.slice(0,3),site=bySite.get(code),prompt=prompts.get(row.prompt_id);
    if(!site||!prompt)continue;
    const known=new Set((site.aiObservations||[]).map(o=>o.id));
    const draft=calibrationObservation(row,site,prompt);
    if(known.has(draft.id))continue;
    let verdict=null;
    if(draft.status!=='rechazo'&&literalMention(row.respuesta,site)&&process.env.GEMINI_API_KEY){
      verdict=await classifyAnswer(row.respuesta,site);
      if(verdict)classified++;
      await new Promise(r=>setTimeout(r,7000));
    }
    if(!incoming.has(code))incoming.set(code,[]);
    incoming.get(code).push(calibrationObservation(row,site,prompt,verdict));
  }
  await store.mutate(s=>{
    s.sites.push(...fresh);
    for(const [code,{id,aiBrands}] of bySite){
      const site=s.sites.find(x=>x.id===id);
      site.aiBrands=aiBrands;
      if(!site.aiPrompts?.length)site.aiPrompts=[...prompts].filter(([pid])=>pid.startsWith(code+'-')).map(([,p])=>p);
      mergeObservations(site,incoming.get(code)||[]);
      site.analysisInputsAt=new Date().toISOString();
    }
  },{keys:['sites']});
  for(const [code,list] of incoming)console.log(code+': '+list.length+' respuestas nuevas');
  console.log(rows.length+' filas leídas de '+files.length+' archivos. Fichas creadas: '+fresh.length+'. Clasificadas con IA: '+classified+'.');
}finally{await store.close();}
