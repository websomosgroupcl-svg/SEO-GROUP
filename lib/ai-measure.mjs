import {createHash} from 'node:crypto';
import {shiftDay,validDay} from './sources.mjs';

const questionKey=s=>String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const pageKey=url=>{try{const u=new URL(url);return u.origin+u.pathname.replace(/\/$/,'')+u.search;}catch{return null;}};

// 95% Wilson interval, in percent. It stays honest with small samples and rates near zero.
export function wilson(hits,n,z=1.96){
  if(!(n>0))return null;
  const p=hits/n,z2=z*z,d=1+z2/n,center=p+z2/(2*n),margin=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n));
  const pct=v=>Math.round(1000*Math.min(1,Math.max(0,v)))/10;
  return {low:pct((center-margin)/d),high:pct((center+margin)/d)};
}
const moved=(before,after)=>{
  const a=wilson(before.hits,before.n),b=wilson(after.hits,after.n);
  return !a||!b?null:b.low>a.high?'subió':a.low>b.high?'bajó':null;
};

export function questionGaps(site,lexical){
  const questions=new Map();
  for(const observation of site.aiObservations||[]){
    if(!validDay(observation.date)||!observation.engine||!observation.prompt?.trim()||typeof observation.cited!=='boolean'||observation.promptType==='control')continue;
    const key=questionKey(observation.prompt);
    if(!questions.has(key))questions.set(key,[]);
    questions.get(key).push(observation);
  }
  const gaps=[];
  for(const [key,rows] of questions){
    const missing=rows.filter(r=>r.cited===false);
    if(!missing.length)continue;
    const words=new Set(lexical(key));
    const cited=new Map();
    for(const r of rows){const url=pageKey(r.citedUrl||r.url);if(r.cited&&url)cited.set(url,(cited.get(url)||0)+1);}
    const page=(site.pages||[]).filter(p=>p.status===200&&!p.noindex).map(p=>{
      const signals=new Set(lexical([p.title,p.h1,...(p.h2||[])].filter(Boolean).join(' ')));
      const shared=[...words].filter(w=>signals.has(w)).length;
      return {url:p.url,weight:(cited.get(pageKey(p.url))||0)*1000+(shared>=2?shared:0)};
    }).filter(p=>p.weight>0).sort((a,b)=>b.weight-a.weight)[0]?.url||null;
    const engines=[...new Set(rows.map(r=>r.engine))].sort();
    const dates=rows.map(r=>r.date).sort(),first=dates[0],last=dates.at(-1),keyword=rows[0].prompt.trim();
    gaps.push({id:createHash('sha256').update(JSON.stringify([site.id,'ai-gap',key])).digest('hex').slice(0,20),keyword,page,variants:[],group:keyword,
      intent:'informacional',source:site.demo?'Muestra de IA · sitio de ejemplo':rows.some(r=>r.series)?'Panel de IA':'Observaciones manuales de IA',observed:false,
      startDate:first,endDate:last,country:site.country,device:'',volume:null,impressions:null,clicks:null,position:null,ctr:null,
      longTail:words.size>=3,priority:Math.min(82,45+missing.length*3+engines.length*2+(page?3:0)),confidence:rows.some(r=>r.series)?'muestra del panel':'muestra manual',target:'ia',
      action:page?'Mejorar la respuesta de esta página':'Evaluar una página que responda a la pregunta',
      reason:missing.length+' de '+rows.length+' respuestas registradas para esta pregunta omitieron una cita al sitio. Motores: '+engines.join(', ')+'. Muestra del '+first+' al '+last+'.',
      aiEvidence:{prompt:keyword,engines,samples:rows.length,missingCitations:missing.length,citations:rows.length-missing.length,start:first,end:last}});
  }
  return gaps;
}

const minSamples=20,minDates=5;
// Compare each engine separately in equal windows, preserving the prompt.
export function measureAi(site,task,now){
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(now);
  const start=task.appliedAt,prompt=task.aiContext?.prompt||task.keyword,page=pageKey(task.page);
  const empty={state:'insuficiente',recommendation:'Observar',engines:[]};
  if(!prompt||!page||!validDay(start))return {...empty,message:'Registra la pregunta exacta y la página para seguir sus citas.'};
  if(today<=shiftDay(start,28))return {...empty,state:'esperando',message:'En observación de IA. Registra la misma pregunta en los mismos motores durante los 28 días posteriores al cambio.'};
  const beforeStart=shiftDay(start,-28),afterEnd=shiftDay(start,28),groups=new Map(),controls=new Map();
  for(const r of site.aiObservations||[]){
    if(!r.engine||!validDay(r.date)||r.date===start||r.date<beforeStart||r.date>afterEnd||typeof r.cited!=='boolean')continue;
    if(r.promptType==='control'){
      if(!controls.has(r.engine))controls.set(r.engine,{before:[],after:[]});
      controls.get(r.engine)[r.date<start?'before':'after'].push({date:r.date,hit:r.cited});
      continue;
    }
    if(questionKey(r.prompt)!==questionKey(prompt))continue;
    if(task.aiContext?.engines?.length&&!task.aiContext.engines.includes(r.engine))continue;
    const dest=pageKey(r.citedUrl||r.url);
    if(r.cited&&!dest)continue;
    if(!groups.has(r.engine))groups.set(r.engine,{before:[],after:[]});
    groups.get(r.engine)[r.date<start?'before':'after'].push({date:r.date,hit:r.cited&&dest===page});
  }
  const engines=[],sample=rows=>({n:rows.length,hits:rows.filter(x=>x.hit).length,dates:new Set(rows.map(x=>x.date)).size});
  for(const [engine,windows] of groups){
    const before=sample(windows.before),after=sample(windows.after);
    const control=controls.get(engine);
    engines.push({engine,before,after,comparable:before.n>=minSamples&&after.n>=minSamples&&before.dates>=minDates&&after.dates>=minDates,
      change:moved(before,after),engineDrift:control?moved(sample(control.before),sample(control.after)):null});
  }
  const comparable=engines.filter(e=>e.comparable),ranges={beforeStart,beforeEnd:shiftDay(start,-1),afterStart:shiftDay(start,1),afterEnd};
  if(!comparable.length)return {...empty,engines,...ranges,message:'Muestra de IA insuficiente. Repite «'+prompt+'» en el mismo motor. Se necesitan al menos '+minSamples+' respuestas en '+minDates+' fechas distintas por motor en cada ventana de 28 días, porque las respuestas cambian entre repeticiones.'};
  const range=s=>{const r=wilson(s.hits,s.n);return s.hits+'/'+s.n+' (rango '+r.low+'–'+r.high+' %)';};
  const summary=comparable.map(({engine,before,after,change,engineDrift})=>engine+': '+range(before)+' antes y '+range(after)+' después. '+(engineDrift?'Las preguntas de control también variaron, así que el cambio puede venir del motor.':change?'La cita '+change+' de forma demostrable.':'Los rangos se cruzan: sin cambio demostrable.')).join(' ');
  const clean=comparable.filter(e=>!e.engineDrift),verdict=comparable.some(e=>e.engineDrift)?'Revisar la muestra':clean.some(e=>e.change==='subió')&&!clean.some(e=>e.change==='bajó')?'Mejora demostrada':clean.some(e=>e.change==='bajó')&&!clean.some(e=>e.change==='subió')?'Caída demostrada':clean.some(e=>e.change)?'Revisar la muestra':'Sin cambio demostrable';
  return {state:'medido',recommendation:verdict,engines,...ranges,message:'Citas de esta página para «'+prompt+'». '+summary};
}
