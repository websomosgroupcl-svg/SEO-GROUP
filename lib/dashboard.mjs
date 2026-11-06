import {classify} from './seo.mjs';
import {problem,shiftDay,validDay} from './sources.mjs';
import {wilson} from './ai-measure.mjs';

const count = n => Number.isFinite(n) && n >= 0 ? n : null;
const round = n => Math.round((n+Number.EPSILON)*100)/100;
const fraction = (n,total) => n==null || !(total>0) ? null : round(n*100/total);
const zonedDay = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const isFinal = row => row && row.final!==false && row.isFinal!==false && row.preliminary!==true;
const newest = dates => dates.reduce((max,date)=>date>max?date:max,'')||null;
const dayList = (end,size) => Array.from({length:size},(_,i)=>shiftDay(end,i-size+1));
const byDate = rows => new Map(rows.map(r=>[r.date,r]));
const sum = (rows,key) => rows.reduce((acc,r)=>acc+r[key],0);

// Reimports can revise an observation. A query total and its page/device
// breakdown overlap. For each query/day, retain a single measured grain.
function chooseGrain(rows) {
  const groups=new Map();
  for(const r of rows){
    if(!r.query || r.observed===false)continue;
    const key=JSON.stringify([r.date,r.query.trim().toLowerCase()]);
    const rank=(r.page?4:0)+(r.device?2:0)+(r.country?1:0);
    let g=groups.get(key);
    if(!g || rank>g.rank){g={rank,rows:new Map()};groups.set(key,g);}
    if(rank===g.rank)g.rows.set(JSON.stringify([r.page||'',r.country||'',r.device||'']),r);
  }
  return [...groups.values()].flatMap(g=>[...g.rows.values()]);
}

function summarize(rows){
  if(!rows.length)return {clicks:null,impressions:null,position:null};
  const complete = key => rows.every(r=>count(r[key])!==null);
  const impressions=complete('impressions')?sum(rows,'impressions'):null;
  const weighted=impressions>0 && rows.every(r=>r.impressions===0 || (count(r.position)!==null && r.position>0));
  return {clicks:complete('clicks')?sum(rows,'clicks'):null,impressions,
    position:weighted?rows.reduce((v,r)=>v+(r.position||0)*r.impressions,0)/impressions:null};
}

function kpi(rows,prior,key,unit) {
  const aggregate=window=>{
    const valid=window.filter(r=>{
      if(key==='ctr')return r.clicks!==null&&r.impressions!==null;
      if(key==='position')return r.impressions===0||(r.impressions>0&&r.position!==null);
      return r[key]!==null;
    });
    let value=null;
    if(valid.length){
      if(key==='ctr')value=fraction(sum(valid,'clicks'),sum(valid,'impressions'));
      else if(key==='position'){
        const impressions=sum(valid,'impressions');
        if(impressions>0)value=round(valid.reduce((n,r)=>n+(r.position||0)*r.impressions,0)/impressions);
      }else value=round(sum(valid,key));
    }
    return {value,n:valid.length};
  };
  const current=aggregate(rows), previous=aggregate(prior);
  const comparable=current.n===rows.length && previous.n===prior.length && current.value!==null && previous.value!==null;
  const delta=comparable?round(current.value-previous.value):null;
  return {value:current.value,previous:comparable?previous.value:null,delta,
    changePct:delta!==null&&previous.value>0?round(100*delta/previous.value):null,unit,
    coverage:{current:current.n,previous:previous.n,expected:rows.length,partial:current.n<rows.length}};
}

function extremes(series,prior) {
  const pool=[...prior,...series], hits=new Map();
  const signals=[
    ['clicks','clics',5,5,'Contrasta consultas y posición media en Google.'],
    ['impressions','impresiones',100,50,'Revisa qué consultas ganaron o perdieron visibilidad en Google.'],
    ['sessions','sesiones',10,5,'Consulta las páginas de entrada y los canales de adquisición en Analytics.'],
    ['keyEvents','eventos clave',3,3,'Contrasta los eventos configurados en Analytics con las páginas modificadas.']
  ];
  for(let i=prior.length;i<pool.length;i++){
    const r=pool[i],week=pool.slice(i-7,i);
    if(week.length!==7)continue;
    for(const [key,label,minBaseline,minDiff,hint] of signals){
      if(r[key]===null||week.some(p=>p[key]===null))continue;
      const median=week.map(p=>p[key]).sort((a,b)=>a-b)[3];
      if(median<minBaseline)continue;
      const delta=r[key]-median,ratio=delta/median;
      if(Math.abs(delta)<minDiff || Math.abs(ratio)<0.30)continue;
      const kind=delta>0?'peak':'drop', id=key+kind;
      if(hits.has(id)&&Math.abs(hits.get(id).changePct)>=Math.abs(ratio*100))continue;
      hits.set(id,{kind,date:r.date,metric:key,title:(delta>0?'Pico de ':'Caída de ')+label,
        value:r[key],baseline:median,delta,changePct:round(ratio*100),detail:r[key]+' '+label+' frente a una mediana de '+median+' en los siete días anteriores. '+hint});
    }
  }
  return [...hits.values()].sort((a,b)=>Math.abs(b.changePct)-Math.abs(a.changePct)||b.date.localeCompare(a.date));
}

function summarizeAI(rows) {
  const pack=items=>{
    const mentionsKnown=items.filter(r=>typeof r.mentioned==='boolean').length;
    const citationsKnown=items.filter(r=>typeof r.cited==='boolean').length;
    const recommendKnown=items.filter(r=>typeof r.recommended==='boolean').length,recommendations=items.filter(r=>r.recommended===true).length;
    const mentions=items.filter(r=>r.mentioned===true).length,citations=items.filter(r=>r.cited===true).length;
    return {samples:items.length,mentionsKnown,citationsKnown,mentions,citations,recommendKnown,recommendations,
      refused:items.filter(r=>r.status==='rechazo').length,
      mentionRate:fraction(mentions,mentionsKnown),citationRate:fraction(citations,citationsKnown),recommendRate:fraction(recommendations,recommendKnown),
      mentionRange:wilson(mentions,mentionsKnown),citationRange:wilson(citations,citationsKnown),recommendRange:wilson(recommendations,recommendKnown)};
  };
  // Brand and service questions have very different base rates. Each engine and question type keeps its own row.
  const groups=new Map();
  for(const r of rows){const engine=(r.engine||'Sin identificar')+(r.promptType?' · '+r.promptType:'');if(!groups.has(engine))groups.set(engine,[]);groups.get(engine).push(r);}
  return {...pack(rows),engines:[...groups].map(([engine,list])=>({engine,...pack(list)})).sort((a,b)=>b.samples-a.samples)};
}
function aiVisits(days,start,end,previousStart,previousEnd){
  const inRange=(from,to)=>days.filter(r=>validDay(r.date)&&r.date>=from&&r.date<=to);
  const bySource=new Map();
  for(const r of inRange(start,end))bySource.set(r.source,(bySource.get(r.source)||0)+r.sessions);
  return {sessions:inRange(start,end).reduce((n,r)=>n+r.sessions,0),previous:inRange(previousStart,previousEnd).reduce((n,r)=>n+r.sessions,0),
    sources:[...bySource].map(([source,sessions])=>({source,sessions})).sort((a,b)=>b.sessions-a.sessions)};
}

export function metricsFor(site,days=28,{now=new Date()}={}) {
  days=Number(days);
  if(!Number.isInteger(days)||days<7||days>90)throw problem('Elige entre 7 y 90 días.');
  const today=zonedDay(new Date(now)), eligible=r=>isFinal(r)&&validDay(r.date)&&r.date<=today;
  const totals=(site.totals||[]).filter(eligible), raw=(site.rows||[]).filter(eligible), ga=(site.analyticsDays||[]).filter(eligible);
  const samples=(site.aiObservations||[]).filter(r=>validDay(r.date)&&r.date<=today);
  // A source is selected once for the whole chart. Do not mix official totals and CSV when a day is absent.
  const preferred = site.demo?'Demostración':totals.length||raw.some(r=>r.source==='Search Console')?'Search Console':'CSV';
  const detail=chooseGrain(raw.filter(r=>r.source===preferred));
  const source=totals.length?(site.demo?'Demostración':'Search Console'):detail.length?
    (preferred==='Search Console'?'Detalle de Search Console':preferred):'Sin datos de búsqueda';
  const search=new Map();
  if(totals.length)for(const [date,r] of byDate(totals))search.set(date,summarize([r]));
  else{
    const groups=new Map();
    for(const r of detail){if(!groups.has(r.date))groups.set(r.date,[]);groups.get(r.date).push(r);}
    for(const [date,rows] of groups)search.set(date,summarize(rows));
  }
  const lastSearch=newest([...search.keys()]),lastAnalytics=newest(ga.map(r=>r.date)),lastAI=newest(samples.map(r=>r.date));
  const annotations=[];
  for(const t of site.tasks||[]){
    if(validDay(t.appliedAt)&&t.appliedAt<=today)annotations.push({date:t.appliedAt,title:t.title,kind:'aplicada',url:t.page||null,taskId:t.id});
    const verified=t.verification?.at?.slice(0,10);
    if(validDay(verified)&&verified<=today)annotations.push({date:verified,title:t.verification.message,kind:'comprobación',url:t.page||null,taskId:t.id});
  }
  const end=newest([lastSearch,lastAnalytics,lastAI,...annotations.map(a=>a.date)].filter(Boolean))||today;
  const start=shiftDay(end,1-days), previousEnd=shiftDay(start,-1), previousStart=shiftDay(previousEnd,1-days);
  const analytics=byDate(ga);
  const daily=date=>{
    const s=search.get(date)||{},a=analytics.get(date)||{};
    return {date,clicks:count(s.clicks),impressions:count(s.impressions),position:count(s.position),ctr:fraction(s.clicks,s.impressions),
      sessions:count(a.sessions),activeUsers:count(a.activeUsers),keyEvents:count(a.keyEvents)};
  };
  const series=dayList(end,days).map(daily),prior=dayList(previousEnd,days).map(daily);
  const kpis=Object.fromEntries(Object.entries({clicks:'clics',impressions:'impresiones',ctr:'%',position:'posición',sessions:'sesiones',keyEvents:'eventos'}).map(([key,unit])=>[key,kpi(series,prior,key,unit)]));
  const covered=series.filter(r=>r.clicks!==null||r.impressions!==null||r.position!==null).length;
  const prevCovered=prior.filter(r=>r.clicks!==null||r.impressions!==null||r.position!==null).length;
  const mix=new Map();
  for(const r of detail){
    if(r.date<start||r.date>end||!(r.impressions>0))continue;
    const label=classify(r.query);
    mix.set(label,(mix.get(label)||0)+r.impressions);
  }
  const denominator=[...mix.values()].reduce((v,n)=>v+n,0);
  const intent=[...mix].map(([label,impressions])=>({label,impressions,share:fraction(impressions,denominator)})).sort((a,b)=>b.impressions-a.impressions);
  const windowAI=samples.filter(r=>r.date>=start&&r.date<=end);
  // gpt-5.4-nano list prices (Nov 2026): US$0.01 per search, US$0.20 and US$1.25 per million tokens.
  const spend=windowAI.filter(r=>r.series==='api'&&r.searches!=null).reduce((n,r)=>n+r.searches*0.01+((r.tokens?.[0]||0)*0.2+(r.tokens?.[1]||0)*1.25)/1e6,0);
  const ai={...summarizeAI(windowAI),estimatedSpend:round(spend),visits:site.ga4AiDays?aiVisits(site.ga4AiDays,start,end,previousStart,previousEnd):null,panelError:site.aiPanelError||''};
  const notes=[];
  if(!totals.length&&detail.length)notes.push('La serie de búsqueda suma únicamente las consultas observadas de la muestra.');
  if(covered<days)notes.push(covered+' de '+days+' días con métricas de búsqueda. Los espacios vacíos indican ausencia de datos.');
  if(intent.length)notes.push('La intención se estima por las palabras de la consulta. Los porcentajes usan '+denominator.toLocaleString('es-CL')+' impresiones del detalle observado.');
  if((site.cappedDays||[]).some(d=>d>=start&&d<=end))notes.push('Algunos días alcanzaron el límite de consultas detalladas de Search Console.');
  if(ga.length)notes.push('Los usuarios activos corresponden a cada día. Una persona puede figurar en varios días.');
  return {days,start,end,previousStart,previousEnd,source,lastDataAt:lastSearch,coverage:{current:covered,previous:prevCovered,expected:days,partial:covered<days},
    series,kpis,intent,highlights:extremes(series,prior),ai,annotations:annotations.filter(a=>a.date>=start&&a.date<=end).sort((a,b)=>a.date.localeCompare(b.date)),notes,
    connections:{search:{status:site.demo?'demo':site.gscProperty?'connected':detail.length?'imported':'unconnected',label:site.demo?'Datos de ejemplo':site.gscProperty?'Search Console vinculada':detail.length?'Importación CSV':'Sin conexión',lastDate:lastSearch},
      analytics:{status:site.demo&&ga.length?'demo':site.ga4PropertyId||site.analyticsPropertyId?'connected':ga.length?'imported':'unconnected',label:site.demo&&ga.length?'Ejemplo de GA4':site.ga4PropertyId||site.analyticsPropertyId?'Google Analytics vinculado':ga.length?'Histórico de Analytics':'Sin conexión',lastDate:lastAnalytics},
      ai:{status:site.demo&&samples.length?'demo':samples.some(r=>r.series)?'panel':'manual',label:site.demo&&samples.length?'Muestra de ejemplo':samples.some(r=>r.series)?'Panel automático y calibración':'Observaciones manuales',lastDate:lastAI}}};
}
