import {createHash} from 'node:crypto';
import {opportunities} from './seo.mjs';
import {validDay,shiftDay,problem,inSite} from './sources.mjs';

const clean=s=>String(s||'').trim();
const norm=s=>clean(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const words=s=>norm(s).split(' ').filter(w=>w.length>2&&!['para','por','con','sin','del','una','las','los','como','que'].includes(w)).map(w=>w.replace(/([aeiou])s$/,'$1'));
const affinity=(a,b)=>{const aa=new Set(words(a)),bb=new Set(words(b));return aa.size&&bb.size?[...aa].filter(x=>bb.has(x)).length/Math.min(aa.size,bb.size):0;};
const cap=s=>s.charAt(0).toLocaleUpperCase('es')+s.slice(1);
const range=p=>p<4?1:p<=10?2:p<=20?3:4;
const evidence=o=>({query:o.keyword,page:o.page,source:o.source,startDate:o.startDate,endDate:o.endDate,country:o.country,device:o.device,clicks:o.clicks,impressions:o.impressions,position:o.position});
function baseline(seed,pool) {
  const fallback={label:'Demanda observada del sitio',description:seed.impressions+' impresiones y '+seed.clicks+' clics para esta consulta en el período. Se puede medir el cambio después de publicar. La previsión de clics requiere más referencias comparables.',estimatedClicks:null};
  if(seed.position==null||seed.impressions<50)return fallback;
  const references=pool.filter(o=>o.source===seed.source&&o.country===seed.country&&o.device===seed.device&&o.intent===seed.intent&&o.type===seed.type&&o.observedDays===seed.observedDays&&o.position>0&&range(o.position)===range(seed.position)&&o.impressions>=50&&o.ctr!=null&&norm(o.keyword)!==norm(seed.keyword));
  const unique=new Map();
  for(const row of references){const k=norm(row.keyword);if(!unique.has(k)||unique.get(k).impressions<row.impressions)unique.set(k,row);}
  const peers=[...unique.values()];
  if(peers.length<10)return fallback;
  const ctrs=peers.map(x=>x.ctr).sort((a,b)=>a-b),mid=Math.floor(ctrs.length/2);
  const benchmark=ctrs.length%2?ctrs[mid]:(ctrs[mid-1]+ctrs[mid])/2;
  if(benchmark<=seed.ctr)return {label:'CTR igual o superior a su referencia',description:'La consulta ya alcanza o supera el CTR mediano del '+(benchmark*100).toFixed(1)+' % de '+peers.length+' consultas comparables del sitio. Este escenario no sugiere clics adicionales por mejorar el CTR.',estimatedClicks:0};
  const extra=Math.round(seed.impressions*(benchmark-seed.ctr));
  return {label:'Escenario con CTR comparable',description:'Si la página alcanzase el CTR mediano ('+(benchmark*100).toFixed(1)+' %) de '+peers.length+' consultas del propio sitio en el mismo período, franja de posición, intención, país y dispositivo, y conservara sus impresiones, la diferencia sería de '+extra+' clics en un período equivalente. Es un escenario condicionado.',estimatedClicks:extra};
}
function angle(k) {
  const q=norm(k);
  if(/\b(cuanto|como|que|cuando|donde|por que|cual)\b/.test(q.split(' ').slice(0,2).join(' ')))return {title:'¿'+cap(k.replace(/^[¿?]|[?]$/g,''))+'?',section:'Respuesta directa y alcance',proof:'Un ejemplo comprobado por el equipo y las excepciones que cambian la respuesta'};
  if(/\b(precio|costo|tarifa|presupuesto)\b/.test(q))return {title:cap(k)+': qué incluye y cómo comparar opciones',section:'Qué cambia el precio',proof:'Un desglose vigente, con fecha, condiciones y fuente'};
  if(/\b(requisitos|tramite|plazo)\b/.test(q))return {title:cap(k)+': requisitos, pasos y dudas frecuentes',section:'Qué preparar antes de empezar',proof:'Un caso documentado y las fuentes oficiales aplicables'};
  if(/\b(espacio|espacios|cocina|angosto|angosta|medidas)\b/.test(q))return {title:cap(k)+': cómo tomar medidas y elegir bien',section:'Qué medir y cómo comprobar que cabe',proof:'Medidas reales del catálogo y un ejemplo de uso'};
  if(/\b(vs|comparar|comparativa|mejor)\b/.test(q))return {title:cap(k)+': diferencias que importan al elegir',section:'Comparación según la necesidad de la persona',proof:'Una tabla con criterios y diferencias verificadas'};
  return {title:cap(k)+': qué conviene saber antes de elegir',section:'Criterios para decidir según el caso',proof:'Un ejemplo propio y datos que pueda verificar el lector'};
}
export function editorialFor(site,raw,limit=5,now=new Date()){
  if(!Number.isInteger(limit)||limit<1||limit>20)throw problem('Elige entre 1 y 20 encargos.');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(now);
  const oldest=shiftDay(today,-34),sources=new Set(site.demo?['Demostración']:['Search Console','CSV']);
  const recent=raw.filter(r=>sources.has(r.source)&&inSite(r.page,site.url)&&validDay(r.date)&&r.date<=today&&r.date>=oldest&&r.observed!==false&&r.final!==false&&r.isFinal!==false&&!r.preliminary&&Number.isFinite(r.impressions)&&r.impressions>0&&Number.isFinite(r.clicks)&&r.clicks>=0&&r.clicks<=r.impressions);
  const asOf=recent.reduce((d,r)=>r.date>d?r.date:d,'');
  const from=shiftDay(asOf||today,-27);
  const usable=recent.filter(r=>r.date>=from);
  const pool=opportunities(site,usable,site.pages,{pageLevel:true}).filter(o=>o.observed&&o.intent!=='navegacional');
  const ordered=[...pool].sort((a,b)=>(b.source==='Search Console')-(a.source==='Search Console')||b.priority-a.priority||b.impressions-a.impressions);
  const pages=new Map(site.pages.map(p=>[p.url,p]));
  const ideas=[],keys=new Set(),takenPages=new Set(),business=site.services+' '+site.business;
  for(const seed of ordered){
    const p=pages.get(seed.page);
    if(keys.has(norm(seed.keyword))||p?.noindex||(p?.status!=null&&p.status!==200)||p?.html===false||seed.action==='Mantener')continue;
    const ga=site.ga4Landing?.find(r=>r.path===new URL(seed.page).pathname&&validDay(r.endDate)&&r.endDate>=oldest&&r.endDate<=today);
    if(!affinity(seed.keyword,business)&&!ga?.keyEvents)continue;
    const a=angle(seed.keyword);
    // Default to the existing URL. Only suggest a complementary article for a distinct informational need.
    const article=/\/(blog|articulos|guias|noticias)\//i.test(new URL(seed.page).pathname);
    const coveredBy=t=>{const terms=new Set(words(seed.keyword)),head=new Set(words(t));return terms.size>0&&[...terms].filter(w=>head.has(w)).length/terms.size>=.75;};
    const newArticle=!article && seed.intent==='informacional' && p && ![p.title,p.h1,...(p.h2||[])].some(coveredBy);
    const clashes=newArticle&&site.pages.some(other=>other.url!==seed.page&&other.status===200&&!other.noindex&&[other.title,other.h1].some(coveredBy));
    if(clashes||(!newArticle&&takenPages.has(seed.page)))continue;
    if(newArticle&&ideas.some(i=>i.page===seed.page&&affinity(i.keyword,seed.keyword)>=.75))continue;
    const related=ordered.filter(o=>o.id!==seed.id&&o.source===seed.source&&o.country===seed.country&&o.device===seed.device&&o.page===seed.page&&o.longTail&&affinity(seed.keyword,o.keyword)>=.34&&norm(o.keyword)!==norm(seed.keyword));
    const variations=[...new Map(related.map(o=>[norm(o.keyword),o])).values()].slice(0,3);
    const action=newArticle?'Proponer artículo complementario':article?'Actualizar artículo existente':'Ampliar la guía de la página existente';
    const id=createHash('sha256').update(JSON.stringify([site.id,norm(seed.keyword),seed.page,seed.source,seed.country,seed.device])).digest('hex').slice(0,24);
    const longTail=[...(seed.longTail?[seed]:[]),...variations].map(o=>({keyword:o.keyword,source:o.source,observed:true,why:'Consulta observada para esta URL. Responderla si añade una necesidad concreta del lector.'}));
    const goal=site.businessGoal||'Facilitar una consulta o pedido relacionado con '+(String(site.services).split(',')[0]||site.name);
    const why='El sitio ya aparece por «'+seed.keyword+'». '+(action==='Proponer artículo complementario'?'La pregunta tiene intención informativa y la página asociada no la trata en sus encabezados conocidos. Validar el inventario antes de crear otra URL.':'Trabajar primero sobre la URL que ya recibe impresiones reduce el riesgo de duplicar páginas para la misma necesidad.')+(ga?.keyEvents>0?' La página de entrada registra '+ga.keyEvents+' eventos clave en GA4, en todos los canales medidos.':'');
    ideas.push({id,title:a.title,action,newPage:Boolean(newArticle),keyword:seed.keyword,longTail,why,objective:goal,page:seed.page,target:seed.intent==='informacional'?'ambos':'google',
      evidence:[seed,...variations].map(evidence),potential:newArticle?{label:'Demanda observada en la página de referencia',description:'La URL actual registró '+seed.impressions+' impresiones y '+seed.clicks+' clics para esta consulta. La nueva pieza tendrá que construir su propia referencia de rendimiento.',estimatedClicks:null}:baseline(seed,pool),outline:[a.section,a.proof,...variations.map(o=>'Resolver la necesidad «'+o.keyword+'»'),'Siguiente paso para quien quiera avanzar'],cta:'Vincular el servicio o producto pertinente y orientar la llamada a la acción al objetivo «'+goal+'».',
      measure:(newArticle?'Registrar la nueva URL y fecha de publicación. Medir sus primeras impresiones y clics para las búsquedas elegidas durante los 28 días posteriores.':'Registrar la fecha de publicación. Comparar clics e impresiones de esta búsqueda y página durante 28 días antes y después.')+' Revisar eventos clave de la página según su configuración en Analytics.'});
    keys.add(norm(seed.keyword));if(!newArticle)takenPages.add(seed.page);
    if(ideas.length===100)break;
  }
  return {requested:limit,available:ideas.length,asOf:asOf||null,demo:Boolean(site.demo),notice:ideas.length<limit?'Se encontraron '+ideas.length+' encargos distintos con evidencia reciente y relación con el negocio. Para ampliar la lista, conecta Search Console o importa consultas fechadas con su página, clics e impresiones.':'Ordenado con consultas observadas en los últimos datos disponibles. Las cifras describen el sitio y el período indicados.',ideas:ideas.slice(0,limit)};
}
export function editorialBrief(i){
  return ['# '+i.title,i.action,'Página de referencia: '+i.page,'Objetivo del negocio: '+i.objective,'','## Búsqueda principal',i.keyword,i.why,'','## Long-tail con evidencia',...i.longTail.map(v=>'- '+v.keyword+' — '+v.why),...(i.longTail.length?[]:['Todavía no hay variantes long-tail observadas para este encargo.']),'','## Datos que lo justifican',...i.evidence.map(r=>r.query+' · '+r.impressions+' impresiones · '+r.clicks+' clics · '+r.source+' · '+r.startDate+' a '+r.endDate),'','## Potencial',i.potential.description,'','## Estructura propuesta',...i.outline.map(x=>'- '+x),'','## Acción y seguimiento',i.cta,i.measure].join('\n');
}

