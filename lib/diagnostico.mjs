import {parse} from 'csv-parse/sync';
import {crawlSite,siteURL} from './crawl.mjs';
import {classify,opportunities} from './seo.mjs';
import {technicalAudit} from './technical-audit.mjs';
import {evidenceRows,makeDemo} from './site.mjs';
import {inSite,problem,validDay} from './sources.mjs';

const maxBytes=750000, maxRows=5000, visible=80;
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
const phrase=s=>norm(s).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const heads={
  query:['consulta','consultas','consultas principales','query','queries','top queries','keyword','palabra clave'],
  page:['pagina','url','page','landing page','landing page + query string','pagina de destino','pagina de destino + cadena de consulta','pagina de destino y cadena de consulta','pagina de destino + string de consulta'],
  date:['fecha','date'],country:['pais','country'],device:['dispositivo','device'],clicks:['clics','clicks'],
  impressions:['impresiones','impressions'],position:['posicion','posicion media','average position','position'],
  sessions:['sesiones','sessions'],keyEvents:['eventos clave','key events','conversiones','conversions']
};
const keys=new Map(Object.entries(heads).flatMap(([key,labels])=>labels.map(l=>[l,key])));
const day=s=>{const v=String(s||'').trim().replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');return validDay(v)?v:null;};
function csvRows(csv,kind){
  if(typeof csv!=='string'||Buffer.byteLength(csv)>maxBytes)throw problem(kind+' admite hasta 750 KB por archivo.');
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/);
  const start=lines.findIndex(l=>l.trim()&&!l.trimStart().startsWith('#'));
  if(start<0)throw problem(kind+' no contiene una tabla.');
  const header=lines[start],delimiter=header.includes('\t')?'\t':header.includes(';')?';':',';
  const meta=lines.slice(0,start).join('\n');
  const readMeta=name=>day(meta.match(new RegExp('^#\\s*(?:'+name+')\\s*:\\s*([0-9-]{8,10})','im'))?.[1]);
  const period={start:readMeta('Start date|Fecha de inicio'),end:readMeta('End date|Fecha de (?:fin|finalizaci[oó]n)')};
  if(period.start&&period.end&&period.start>period.end)throw problem(kind+' tiene un período de exportación invertido.');
  let rows;
  try{
    rows=parse(lines.slice(start).join('\n'),{delimiter,skip_empty_lines:true,bom:true,trim:true,max_record_size:24000,columns(names){
      const cols=names.map(n=>keys.get(norm(n))||false), known=cols.filter(Boolean);
      if(new Set(known).size!==known.length)throw problem(kind+' tiene cabeceras equivalentes repetidas.');
      if(kind==='Search Console'&&!cols.includes('query'))throw problem('Search Console necesita la tabla «Consultas» con la columna «Consultas principales» o «Query».');
      if(kind==='GA4'&&(!cols.includes('page')||!cols.includes('sessions')&&!cols.includes('keyEvents')))throw problem('GA4 necesita Página de destino junto con Sesiones o Eventos clave.');
      return cols;
    }});
  }catch(err){throw err.status?err:problem('El CSV de '+kind+' tiene columnas, comillas o separadores inválidos.');}
  if(!rows.length||rows.length>maxRows)throw problem(kind+' admite entre 1 y 5.000 filas.');
  return {rows,period};
}
function value(raw,label,where,integer=false){
  if(raw==null||raw==='')return null;
  if(!/^\d+(?:[.,]\d+)?$/.test(raw))throw problem(where+' contiene una métrica inválida en '+label+'.');
  const n=Number(raw.replace(',','.'));
  if(!Number.isFinite(n)||n>Number.MAX_SAFE_INTEGER||integer&&!Number.isSafeInteger(n))throw problem(where+' contiene una métrica inválida en '+label+'.');
  return n;
}
function rowDate(value,where){if(!value)return '';const d=day(value);if(!d)throw problem(where+' requiere fecha AAAA-MM-DD o AAAAMMDD.');return d;}
function gscData(csv,scope){
  const table=csvRows(csv,'Search Console');
  const rows=table.rows.map((r,i)=>{
    const where='Search Console · registro '+(i+1);
    if(!r.query||r.query.length>400)throw problem(where+' tiene una consulta vacía o demasiado larga.');
    const clicks=value(r.clicks,'Clics',where,true), impressions=value(r.impressions,'Impresiones',where,true);
    if(impressions!=null&&clicks>impressions)throw problem(where+' tiene más clics que impresiones.');
    let page='';
    if(r.page){try{page=siteURL(r.page).href;if(scope&&!inSite(page,scope))throw Error();}catch{throw problem(where+' tiene una URL inválida o ajena al sitio indicado.');}}
    return {query:r.query,page,date:rowDate(r.date,where),clicks,impressions,position:value(r.position,'Posición',where),country:r.country||'',device:r.device||'',source:'CSV de Search Console',observed:clicks!=null||impressions!=null};
  });
  return {rows,period:table.period};
}
function analyticsData(csv,scope){
  const table=csvRows(csv,'GA4'),rows=[];let omitted=0;
  for(const [i,r] of table.rows.entries()){
    const where='GA4 · registro '+(i+1);
    if(!r.page||['total','totales','totals','grand total','(not set)','(sin definir)','(no definido)'].includes(norm(r.page))){omitted++;continue;}
    const relative=r.page.startsWith('/')&&!r.page.startsWith('//')&&!r.page.includes('\\');
    let path;
    try{
      const u=relative?new URL(r.page,scope||'https://datos.example'):siteURL(r.page);
      if(scope&&!inSite(u.href,scope))throw Error();
      path=relative?u.pathname+u.search:u.href;
    }catch{throw problem(where+' tiene una página de destino inválida o ajena al sitio indicado.');}
    rows.push({path,date:rowDate(r.date,where),sessions:value(r.sessions,'Sesiones',where,true),keyEvents:value(r.keyEvents,'Eventos clave',where)});
  }
  return {rows,omitted,period:table.period};
}
const emptyAnalytics=()=>({rows:[],omitted:0,period:{start:null,end:null}});
const severity={alta:0,media:1,baja:2};
function keywordReport(rows,url,period){
  const clean=evidenceRows({rows});
  const observed=opportunities({url:url||'',country:'',services:''},clean,[],{pageLevel:true}).sort((a,b)=>b.priority-a.priority);
  const result=observed.map(o=>({keyword:o.keyword,page:o.page,country:o.country,device:o.device,observed:true,longTail:o.longTail,intent:o.intent,source:o.source,
    start:o.startDate||period.start,end:o.endDate||period.end,clicks:o.clicks,impressions:o.impressions,position:o.position,ctr:o.ctr,action:o.action,reason:o.reason}));
  const without=clean.filter(r=>!r.observed);
  for(const r of without)result.push({keyword:r.query,page:r.page||null,country:r.country,device:r.device,observed:false,longTail:/\b(para|con|sin|cuanto cuesta|como elegir)\b/.test(norm(r.query)),intent:classify(r.query),source:r.source,start:r.date||period.start,end:r.date||period.end,clicks:null,impressions:null,ctr:null,position:r.position,action:'Validar demanda',reason:'La fila contiene el término sin cifras de clics o impresiones.'});
  return result;
}
function gapsFor(keywords,pages){
  const byUrl=new Map(pages.filter(p=>p.status===200&&p.html!==false).map(p=>[p.url,p]));
  return keywords.filter(k=>k.observed&&k.impressions>0&&k.page&&byUrl.has(k.page)).flatMap(k=>{
    const p=byUrl.get(k.page), phraseOfQuery=' '+phrase(k.keyword)+' ';
    const texts=[p.title,p.h1,...(p.h2||[]),...(p.keywordExcerpts||[])].filter(t=>typeof t==='string'&&t.trim());
    if(p.noindex||!texts.length||texts.some(t=>(' '+phrase(t)+' ').includes(phraseOfQuery)))return [];
    return [{keyword:k.keyword,page:k.page,start:k.start,end:k.end,country:k.country,device:k.device,evidence:k.impressions+' impresiones · '+k.source+' · sin coincidencia literal en título, encabezados y extractos revisados de esta URL.',
      next:'Comprueba si la página ya responde con otras palabras. Amplía la respuesta si falta información para esa búsqueda.',source:'Consulta y HTML de la misma URL'}];
  });
}

export async function diagnose(data,{crawl=crawlSite,demo=false}={}){
  if(!data||typeof data!=='object')throw problem('Introduce una URL o un archivo de Google.');
  const example=data.example===true;
  if(example&&(data.url||data.gscCsv||data.ga4Csv))throw problem('Ejecuta el ejemplo por separado de tus datos.');
  if(!example&&!data.url&&!data.gscCsv&&!data.ga4Csv)throw problem('Introduce una URL o adjunta un CSV de Google.');
  let url=null, snapshot=null,search={rows:[],period:{start:null,end:null}},ga=emptyAnalytics();
  if(data.url){
    if(demo)throw problem('El rastreo de una URL real requiere una cuenta del equipo. En demostración puedes analizar archivos.',403);
    if(data.authorized!==true)throw problem('Confirma que tienes autorización para revisar esta dirección.');
    try{if(typeof data.url!=='string')throw Error();url=siteURL(data.url.trim()).href;}catch{throw problem('Introduce una dirección pública HTTP o HTTPS sin credenciales ni puertos personalizados.');}
  }
  if(data.gscCsv)search=gscData(data.gscCsv,url);
  if(data.ga4Csv)ga=analyticsData(data.ga4Csv,url);
  if(example){
    const sample=makeDemo({id:'diagnostico-muestra'});url=sample.url;search.rows=sample.rows;
    snapshot={pages:sample.pages,complete:true,checkedAt:sample.lastReviewAt,errors:[],skipped:[]};
    ga.rows=[{path:'/escritorios',date:'',sessions:85,keyEvents:3},{path:'/mesas-plegables',date:'',sessions:62,keyEvents:2}];
  }else if(url){
    try{snapshot=await crawl({url,authorized:true},{maxPages:4,timeBudgetMs:7000,cursor:{queue:[url],visited:[]}});}
    catch(err){snapshot={pages:[],complete:false,errors:[{url,message:err.message}],skipped:[]};}
    if(snapshot.home)url=snapshot.home;
  }
  const pages=snapshot?.pages||[],allKeywords=keywordReport(search.rows,url,search.period);
  let technical=null;
  if(snapshot){
    const audited=technicalAudit(snapshot);
    technical={score:audited.score,coverage:audited.coverage,dimensions:audited.dimensions,checks:audited.checks,issueCount:audited.issues.length,issues:audited.issues.sort((a,b)=>severity[a.severity]-severity[b.severity]),pages:pages.map(p=>({url:p.url,status:p.status,title:p.title||'',h1:p.h1||''})),errors:snapshot.errors||[],blocked:snapshot.skipped||[]};
  }
  const sources=[...(snapshot?[{name:example?'HTML de demostración':'Rastreo HTML autorizado',count:pages.length,unit:'páginas'}]:[]),
    ...(data.gscCsv||example?[{name:example?'Consultas ficticias':'CSV de Search Console',count:search.rows.length,unit:'filas'}]:[]),
    ...(data.ga4Csv||example?[{name:example?'Páginas de entrada ficticias':'CSV de GA4',count:ga.rows.length,unit:'filas con página'}]:[])];
  const limitations=[...(snapshot?.notes||[])];
  if(snapshot?.home)limitations.push('La dirección indicada redirige a '+snapshot.home+'. Se revisó esa variante.');
  if(!snapshot)limitations.push('Sin rastreo de HTML. El archivo permite analizar sus cifras, pero no comprobar controles técnicos.');
  if(snapshot?.complete===false||snapshot?.robotsBlocked||snapshot?.truncated)limitations.push('Rastreo parcial. Las páginas no revisadas quedan fuera de la puntuación y de los hallazgos.');
  if(!search.rows.length)limitations.push('Falta una exportación de consultas de Search Console para medir búsquedas y long-tail.');
  if(search.rows.some(r=>!r.page))limitations.push('Hay consultas sin página asociada. Exporta el desglose por consulta y URL para contrastarlas con el contenido.');
  if(search.rows.some(r=>!r.date)&&!(search.period.start&&search.period.end))limitations.push('Hay consultas sin fecha ni período declarado. Sus cifras corresponden al archivo tal como fue exportado.');
  if(ga.omitted)limitations.push('Se omitieron '+ga.omitted+' filas de totales o sin página de destino en GA4.');
  const gaps=gapsFor(allKeywords,pages),counts={keywords:allKeywords.length,landings:ga.rows.length};
  if(Math.max(counts.keywords,counts.landings,gaps.length)>visible)limitations.push('Las listas en pantalla muestran hasta '+visible+' filas por sección. El CSV incluye todos los resultados procesados.');
  return {generatedAt:new Date().toISOString(),demo:example,sessionDemo:demo,url,technical,keywords:allKeywords,
    analytics:{...ga,rows:ga.rows.sort((a,b)=>(b.sessions??-1)-(a.sessions??-1))},gaps,sources,limitations,counts};
}
