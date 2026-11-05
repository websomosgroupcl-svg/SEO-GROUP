import {createHash} from 'node:crypto';
import {opportunities} from './seo.mjs';
import {questionGaps} from './ai-measure.mjs';
import {shiftDay} from './sources.mjs';
const norm=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const lexical=s=>norm(s).split(' ').filter(x=>x.length>2&&!['para','del','los','las','una','con','que','sin'].includes(x)).map(x=>x.replace(/([aeiou])s$/,'$1'));
const forSource=scope=>scope?.source||'Catálogo del sitio';
export const resultFor=(target,goal='acciones comerciales')=>target==='ia'?'Que la página aparezca como fuente en respuestas a las preguntas seguidas. Comprobar citas por motor.':
  target==='ambos'?'Mejorar los clics relevantes desde Google y conseguir citas en respuestas relacionadas. Comparar ambas señales por separado.':
  'Atraer visitas relevantes desde Google a la página objetivo. Contrastar los clics con el objetivo «'+goal+'» y los eventos clave que haya configurado el equipo.';

export function strategyFor(site,rows){
  const newest=rows.reduce((v,r)=>r.date>v?r.date:v,'');
  const from=newest?shiftDay(newest,-27):'';
  const current=rows.filter(r=>!r.date||r.date>=from);
  const ops=opportunities(site,current,site.pages);
  const seen=new Set(ops.map(o=>norm(o.keyword)));
  const pages=new Map(site.pages.map(p=>[p.url,p]));
  const outcomes=new Map((site.ga4Landing||[]).map(l=>[l.path,l]));
  const goal=site.businessGoal||'Generar consultas o pedidos sobre '+(site.services||site.business||site.name).split(',')[0];
  const services=String(site.services||'').split(/[,;]/).flatMap(lexical);
  const commercial=new Set(services);
  const pageWords=p=>[['título',p.title],['H1',p.h1],...(p.h2||[]).map(t=>['H2',t]),...(p.keywordExcerpts||[]).map(t=>['párrafo',t])];
  const textIndex=new Map(site.pages.map(p=>[p.url,pageWords(p).filter(([,text])=>text).map(([part,text])=>({part,text,normalized:' '+norm(text)+' '}))]));
  let added=0;
  for(const p of site.pages){
    if(p.noindex||p.status!==200||added>=80)continue;
    for(const heading of [p.h1,...(p.h2||[])].filter(Boolean)){
      const word=norm(heading),parts=lexical(heading);
      if(seen.has(word)||parts.length<2||parts.length>12||!parts.some(x=>commercial.has(x))||added>=80)continue;
      seen.add(word);added++;
      ops.push({id:createHash('sha256').update(p.url+'|literal|'+word).digest('hex').slice(0,20),keyword:heading,page:p.url,variants:[],group:heading,
        intent:'por revisar',source:'Encabezado del sitio',observed:false,volume:null,impressions:null,clicks:null,position:null,ctr:null,
        longTail:/\b(para|sin|con|precio|medidas|pequen[oa]s?)\b/.test(word),country:site.country,device:'',priority:16,
        confidence:'por validar',action:'Medir rendimiento',reason:'El encabezado contiene esta expresión. Su demanda todavía necesita datos de búsqueda.',evidence:{page:p.url,heading}});
    }
  }
  const pathsUsed=new Set();
  // Each new proposal has an observed seed on a page with evidence of business fit.
  for(const seed of ops.filter(o=>o.observed&&o.page&&o.impressions>0&&o.endDate&&o.intent!=='navegacional')){
    if(pathsUsed.size>=12)break;
    const keyword=norm(seed.keyword),words=lexical(keyword),pagePath=new URL(seed.page).pathname;
    const outcome=outcomes.get(pagePath);
    const fit=words.some(x=>commercial.has(x));
    if(!fit&&!(outcome?.keyEvents>0))continue;
    if(pathsUsed.has(pagePath))continue;
    const subject=/^(como|que|cuando|donde|cuanto|por que)\b/.test(keyword)
      ? String(site.services||'').split(/[,;]/).map(s=>s.trim()).find(s=>lexical(s).some(x=>words.includes(x))) : seed.keyword;
    if(!subject)continue;
    const phrase=/\b(precio|precios|cuesta|cuestan|cotizar|comprar)\b/.test(keyword)?'qué incluye '+subject.replace(/^(precio de|precios de|cotizar|comprar)\s+/i,''):'precio de '+subject;
    if(seen.has(norm(phrase)))continue;
    seen.add(norm(phrase));pathsUsed.add(pagePath);
    ops.push({id:createHash('sha256').update([site.id,'business',norm(phrase),seed.page].join('|')).digest('hex').slice(0,20),
      keyword:phrase,page:seed.page,variants:[],intent:'comercial',source:'Propuesta desde consultas observadas',observed:false,volume:null,impressions:null,clicks:null,position:null,ctr:null,longTail:true,country:seed.country,device:seed.device,
      priority:Math.min(90,seed.priority+(outcome?.keyEvents>0?6:0)),confidence:'por validar',group:seed.group,action:'Validar una consulta de compra',
      reason:'«'+seed.keyword+'» tuvo '+seed.impressions+' impresiones en '+forSource(seed)+' entre '+seed.startDate+' y '+seed.endDate+'. Prueba si las personas que hacen esa búsqueda necesitan información de precio o condiciones antes de contactar.',
      evidence:{seed:seed.keyword,source:seed.source,period:[seed.startDate,seed.endDate],page:seed.page},related:[{keyword:seed.keyword,source:seed.source,observed:true}]});
  }
  ops.push(...questionGaps(site,lexical));
  for(const o of ops){
    const p=pages.get(o.page),word=' '+norm(o.keyword)+' ';
    const match=p&&textIndex.get(o.page)?.find(t=>t.normalized.includes(word));
    o.inContent=match?true:null;
    o.contentEvidence=match?{url:p.url,part:match.part,text:match.text}:null;
    o.goal=goal;
    o.target=o.target||(o.intent==='informacional'?'ambos':'google');
    o.expectedOutcome=resultFor(o.target,goal);
    o.validation=o.observed?'Revisar clics y posición en el mismo mercado y período. Contrastar con el rendimiento comercial de la página.':'Validar primero con preguntas de clientes o nuevas consultas observadas. Después medir clics, sesiones y eventos clave.';
    if(o.target==='ia')o.validation='Repite la pregunta exacta en los mismos motores y registra la URL que citan, también cuando omitan el sitio.';
    o.reviewedAt=site.lastReviewAt||null;
    o.pageOutcomes=o.page?outcomes.get(new URL(o.page).pathname)||null:null;
  }
  return ops.sort((a,b)=>b.priority-a.priority||a.keyword.localeCompare(b.keyword,'es'));
}

