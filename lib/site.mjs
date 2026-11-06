import {randomUUID} from 'node:crypto';
import {briefFor, evaluateChange} from './seo.mjs';
import {strategyFor,resultFor} from './strategy.mjs';
import {measureAi} from './ai-measure.mjs';
import {metricsInput} from './analytics.mjs';
import {editorialFor,editorialBrief} from './editorial.mjs';
import {auditForSite} from './audit-report.mjs';
import {upgradeDemoWorkshop} from './demo-taller.mjs';
import {problem, shiftDay, validDay} from './sources.mjs';

export function field(value,label,max=250,required=true) {
  if (typeof value !== 'string' || value.trim().length>max || (required && !value.trim())) throw problem('Revisa el campo '+label+'.');
  return value.trim();
}
export function newSite(data,user) {
  const url=field(data.url,'URL',2000);
  let target;
  try {target=new URL(url);} catch {throw problem('Introduce una URL completa con https://.');}
  if (!['https:','http:'].includes(target.protocol)||target.username||target.password||target.port||target.hash||target.search||!target.hostname.includes('.')) throw problem('Utiliza la URL pública de un sitio, sin credenciales, puerto o parámetros.');
  if(data.authorized!==true) throw problem('Confirma que tienes autorización para rastrear esta web.');
  return {id:randomUUID(),ownerId:user.id,memberIds:[],createdAt:new Date().toISOString(),country:field(data.country,'país',80),language:field(data.language||'es','idioma',30),
    name:field(data.name,'nombre',100),url:target.href,business:field(data.business,'actividad',600),services:field(data.services,'productos o servicios',600),authorized:true,
    rows:[],pages:[],tasks:[],alerts:[],reviews:[],totals:[],gscProperty:'',demo:false};
}
const key=r=>JSON.stringify([r.query,r.page,r.country,r.device,r.date,r.source]);
export function mergeCsv(site,rows) {
  const merged=new Map(site.rows.map(r=>[key(r),r]));
  for(const row of rows) merged.set(key(row),row);
  if(merged.size>50000) throw problem('Se alcanzó el límite del piloto de 50.000 observaciones por sitio.');
  site.rows=[...merged.values()];
  if(rows.length)site.analysisInputsAt=new Date().toISOString();
}
export function evidenceRows(site) {
  // A CSV may contain both a query total and its breakdown by URL.
  // For the same date and search context, use a single level of detail.
  const groups=new Map();
  for(const row of site.rows) {
    const term=JSON.stringify([row.query.trim().toLowerCase(),row.country,row.device,row.source,row.date]);
    if(!groups.has(term)) groups.set(term,[]);
    groups.get(term).push(row);
  }
  return [...groups.values()].flatMap(rows=>rows.some(r=>r.page)?rows.filter(r=>r.page):rows);
}
export function siteOpportunities(site) {
  return strategyFor(metricsInput(site),evidenceRows(site));
}
function auditObjective(issue){
  const shared=['h1','broken','http'].includes(issue.rule);
  const outcomes={
    h1:'Que la página explique su tema desde el encabezado principal.',
    broken:'Que las personas y los rastreadores puedan seguir este enlace hasta una página que responda.',
    http:'Que la URL responda correctamente al acceder a ella.',
    description:'Que Google disponga de un resumen descriptivo al mostrar la página. Si lo utiliza, observar después el porcentaje de clics.',
    noindex:'Confirmar si esta página debe aparecer en Google y comprobar la instrucción tras el cambio.',
    canonical:'Que las señales de la página identifiquen la URL principal elegida por el equipo.'
  };
  return {target:shared?'ambos':'google',expectedOutcome:outcomes[issue.rule]||'Resolver la incidencia técnica de esta URL y verificar el resultado en la próxima auditoría.'};
}
export function taskView(task) {
  const {versions,...current}=task;
  return {...current,versionCount:versions?.length||0};
}

export function versionPage(site,taskId,offset=0) {
  const task=site.tasks.find(t=>t.id===taskId);
  if(!task)throw problem('Tarea desconocida.',404);
  const start=Number(offset);
  if(!Number.isSafeInteger(start)||start<0)throw problem('Desplazamiento de versiones inválido.',400);
  const history=task.versions||[],limit=10,end=Math.max(0,history.length-start);
  return {total:history.length,offset:start,limit,versions:history.slice(Math.max(0,end-limit),end).reverse()};
}

export function detail(site,jobs) {
  const {rows,pages,totals,crawlCursor,auditHistory,auditBlocked,auditErrors,auditRedirects,analysisRun,analysisHistory,aiObservations,ga4AiDays,indexStatus,...safe}=site;
  const ranked=siteOpportunities(site);
  const suggestions=ranked.filter(o=>!o.observed);
  const suggestionsLimit=Math.min(120,suggestions.length);
  const visible=ranked.filter(o=>o.observed).slice(0,500-suggestionsLimit);
  visible.push(...suggestions.slice(0,500-visible.length));
  const audit=auditForSite(site);
  return {...safe,tasks:site.tasks.map(taskView),opportunityCount:ranked.length,rowsCount:rows.length,gscDetailCount:rows.filter(r=>r.source==='Search Console').length,dataUntil:rows.reduce((max,r)=>r.date>max?r.date:max,''),totals:totals.slice(-28),
    audit:{...audit,issues:audit.issues.map(i=>({...i,...auditObjective(i)}))},
    opportunities:visible,jobs:jobs.filter(j=>j.siteId===site.id).slice(-15).reverse().map(j=>({status:j.status,day:j.day,type:j.type}))};
}
export function addTask(site,input,user,draft=null) {
  if(input.editorialId){
    const origin='editorial:'+input.editorialId;
    const existing=site.tasks.find(t=>t.origin===origin&&!['cerrada','descartada'].includes(t.status));
    if(existing)return existing;
    const idea=editorialFor(site,evidenceRows(site),20).ideas.find(i=>i.id===input.editorialId);
    if(!idea)throw problem('Este encargo ya no figura entre las oportunidades recientes. Actualiza la lista antes de asignarlo.',409);
    const now=new Date().toISOString(),seed=idea.evidence[0];
    const editorial=draft?{...idea,title:draft.title,outline:draft.outline,creative:{provider:draft.provider,model:draft.model,angle:draft.angle}}:idea;
    const brief=editorialBrief(editorial)+(draft?'\n\n## Enfoque editorial propuesto por '+draft.provider+'\n'+draft.angle:'');
    const task={id:randomUUID(),origin,title:editorial.title,keyword:idea.keyword,page:idea.newPage?'':idea.page,editorial,
      brief,status:'pendiente',responsible:user.name,updatedAt:now,versions:[{at:now,author:user.name,brief}],evidence:idea.why,result:null,
      target:idea.target,expectedOutcome:idea.measure,searchContext:{country:seed.country,device:seed.device,source:seed.source,variants:[...new Set(idea.evidence.map(r=>r.query))]}};
    site.tasks.unshift(task);return task;
  }
  const op=input.opportunityId && siteOpportunities(site).find(x=>x.id===input.opportunityId);
  const issue=input.issueId && (auditForSite(site).issues.find(x=>x.id===input.issueId)||site.audit?.issues.find(x=>x.id===input.issueId));
  if(!op&&!issue) throw problem('La oportunidad o el problema ya no está disponible.',404);
  const origin=op?'op:'+op.id:'issue:'+issue.id;
  const existing=site.tasks.find(t=>t.origin===origin&&!['descartada','cerrada'].includes(t.status));
  if(existing) return existing;
  const brief=op?briefFor(site,op):[issue.title,issue.url,issue.evidence,issue.fix].join('\n\n');
  const now=new Date().toISOString();
  const task={id:randomUUID(),origin,title:op?op.keyword:issue.title,keyword:op?.keyword||'',page:op?.page||issue?.url||'',brief,status:'pendiente',responsible:user.name,updatedAt:now,versions:[{at:now,author:user.name,brief}],evidence:op?.reason||issue?.evidence,result:null};
  task.target=field(input.target||op?.target||(issue?auditObjective(issue).target:'google'),'destino',8);
  if(!['google','ia','ambos'].includes(task.target))throw problem('Elige Google, IA o ambos.');
  task.expectedOutcome=input.expectedOutcome?field(input.expectedOutcome,'resultado esperado',1200):issue?auditObjective(issue).expectedOutcome:resultFor(task.target,op?.goal||site.businessGoal);
  if(op?.aiEvidence)task.aiContext={prompt:op.aiEvidence.prompt,engines:op.aiEvidence.engines};
  site.tasks.unshift(task);
  if(op?.observed) task.searchContext={country:op.country,device:op.device,source:op.source,variants:[op.keyword,...op.variants]};
  return task;
}
export function editTask(site,id,body,user) {
  const task=site.tasks.find(t=>t.id===id); if(!task) throw problem('Tarea desconocida.',404);
  if(body.expectedUpdatedAt && task.updatedAt!==body.expectedUpdatedAt) throw problem('Otra persona actualizó la tarea. Recarga antes de guardar.',409);
  if(body.status && !['pendiente','en_curso','aplicada','en_seguimiento','cerrada','descartada'].includes(body.status)) throw problem('Estado desconocido.');
  const page=body.page===undefined?task.page:field(body.page,'página',2000,false);
  if(page) {let url;try{url=new URL(page);}catch{throw problem('Introduce una URL válida para la página.');}
    const base=new URL(site.url);
    if(url.origin!==base.origin||url.username||url.password||!(url.pathname===base.pathname||url.pathname.startsWith(base.pathname.replace(/\/?$/, '/')))) throw problem('La URL debe pertenecer al sitio.');}
  const appliedAt=body.appliedAt===undefined?task.appliedAt:body.appliedAt?.slice?.(0,10);
  if(appliedAt && (!validDay(appliedAt)||appliedAt>new Date().toISOString().slice(0,10))) throw problem('La fecha de aplicación no es válida.');
  const status=body.status||task.status;
  if(['aplicada','en_seguimiento'].includes(status)&&(!page||!appliedAt)) throw problem('Indica la URL y fecha en que se aplicó el cambio.');
  const now=new Date(Math.max(Date.now(),Date.parse(task.updatedAt)+1)).toISOString();
  if(body.target!==undefined){if(!['google','ia','ambos'].includes(body.target))throw problem('Destino inválido.');task.target=body.target;}
  if(body.expectedOutcome!==undefined)task.expectedOutcome=field(body.expectedOutcome,'resultado esperado',1200,false);
  if(body.brief!==undefined && body.brief!==task.brief) {
    task.brief=field(body.brief,'brief',24000);
    task.versions.push({at:now,author:user.name,brief:task.brief});
  }
  Object.assign(task,{status,page,appliedAt,responsible:body.responsible?field(body.responsible,'responsable',100):task.responsible,updatedAt:now});
  measure(site,task);
  return task;
}
export function measure(site,t,now=new Date()) {
  if(!t.appliedAt || !t.page) return;
  const ai=t.target==='ia'||t.target==='ambos'?measureAi(metricsInput(site,now),t,now):null;
  if(t.target==='ia'){t.result={...ai,channels:{ia:ai}};return;}
  const ctx=t.searchContext;
  const words=new Set((ctx?.variants||[t.keyword]).map(w=>w?.toLowerCase()));
  const all=site.rows.filter(r=>r.page===t.page && r.date && (!t.keyword || words.has(r.query.toLowerCase())) &&
    (!ctx || (ctx.country===r.country && ctx.device===r.device && ctx.source===r.source)));
  const src=all.some(r=>r.source==='Search Console')?'Search Console':(site.demo?'Demostración':'CSV');
  const rows=all.filter(r=>r.source===src&&Number.isFinite(r.clicks)&&Number.isFinite(r.impressions));
  const before=rows.filter(r=>r.date>=shiftDay(t.appliedAt,-28)&&r.date<t.appliedAt);
  const after=rows.filter(r=>r.date>t.appliedAt&&r.date<=shiftDay(t.appliedAt,28));
  let google=evaluateChange({appliedAt:t.appliedAt,before,after,now});
  if(t.editorial?.newPage&&t.page!==t.editorial.page){
    const cutoff=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(now);
    const records=after.filter(r=>r.date<=cutoff&&r.final!==false&&r.isFinal!==false&&!r.preliminary);
    const dates=new Set(records.map(r=>r.date)),clicks=records.reduce((n,r)=>n+r.clicks,0),impressions=records.reduce((n,r)=>n+r.impressions,0);
    if(records.length)google={state:cutoff<=shiftDay(t.appliedAt,28)?'esperando':'medido',recommendation:'Observar',deltaClicks:null,deltaImpressions:null,
      message:'Nueva URL. Impresiones: '+impressions+'. Clics: '+clicks+'. Días con datos: '+dates.size+' de los primeros 28 posteriores a la publicación. Esta es su primera referencia de rendimiento.'};
    else google={state:cutoff<=shiftDay(t.appliedAt,28)?'esperando':'insuficiente',recommendation:'Observar',deltaClicks:null,deltaImpressions:null,message:'Nueva URL. Aún no hay observaciones para sus consultas en los primeros 28 días. Comprueba el rastreo, la cobertura y las consultas disponibles.'};
  }
  if(ai){
    const complete=google.state==='medido'&&ai.state==='medido';
    t.result={state:complete?'medido':google.state==='medido'||ai.state==='medido'?'parcial':google.state==='esperando'&&ai.state==='esperando'?'esperando':'insuficiente',
      channels:{google,ia:ai},message:'Google. '+google.message+' IA. '+ai.message};
  }else t.result={...google,channels:{google}};
}

export function makeDemo(user) {
  const s=newSite({name:'Madera Sur',url:'https://maderasur.example/',country:'Chile',language:'es',business:'Taller de muebles para espacios pequeños',services:'escritorios de madera, mesas plegables, muebles a medida',authorized:true},user);
  s.demo=true;
  const products=[['','Madera Sur · Muebles a medida','Muebles para espacios pequeños'],['escritorios','Escritorios de madera','Escritorios de madera'],['mesas-plegables','Mesas plegables','Mesas plegables para cocina'],['muebles-a-medida','Muebles a medida','Muebles a medida en Santiago']];
  s.pages=products.map(([path,title,h])=>({url:s.url+path,status:200,title,description:path==='escritorios'?'':'Muebles de madera fabricados a medida en Santiago.',h1:h,h1Count:1,canonical:s.url+path,noindex:false,links:[],checkedAt:new Date().toISOString(),html:true}));
  const queries=[['escritorio de madera para espacios pequeños',1,310,12],['mesa plegable para cocina pequeña',2,208,8],['muebles a medida en Santiago',3,168,9],['escritorio angosto de madera',1,126,15],['mesa abatible para dos personas',2,85,17]];
  const today=new Date().toISOString().slice(0,10);
  for(let i=1;i<=31;i++) for(const [query,index,n,pos] of queries) s.rows.push({query,page:s.pages[index].url,date:shiftDay(today,-i),country:'Chile',device:'MOBILE',impressions:Math.floor(n/8)+i%6,clicks:i%4,position:pos+i%3,source:'Demostración',observed:true});
  s.lastReviewAt=new Date().toISOString();
  s.reviews=[{at:s.lastReviewAt,status:'demo',message:'Ejemplo con páginas y métricas ficticias.',pagesChecked:s.pages.length}];
  upgradeDemoWorkshop(s);
  return s;
}

