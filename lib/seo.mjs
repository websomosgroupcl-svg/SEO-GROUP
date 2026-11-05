import {createHash} from 'node:crypto';

const normalize = value => String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const stop = new Set('de del la el los las y en con un una para por a que es mi se son'.split(' '));
const tokens = value=>new Set(normalize(value).split(' ').filter(x=>x&&!stop.has(x)).map(x=>x.length>4?x.replace(/([aeiou])s$/,'$1'):x));
const id = (...parts)=>createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,20);
const overlap=(a,b)=>!a.size ? 0 : [...a].filter(x=>b.has(x)).length/a.size;
const round=n=>Math.round(n*10)/10;
const services = site => (Array.isArray(site.services)?site.services:String(site.services??'').split(/[,;\n]/)).map(x=>String(x).trim().slice(0,160)).filter(Boolean).slice(0,24);

export {technicalAudit as auditSite} from './technical-audit.mjs';

export function classify(text){
  const s=normalize(text);
  if(/\b(comprar|contratar|reservar|cotizar|presupuesto|envio|a domicilio)\b/.test(s))return 'transaccional';
  if(/\b(precio|precios|costo|cuanto cuesta|vs|versus|comparar|comparativa|mejor|mejores|cerca)\b/.test(s))return 'comercial';
  if(/\b(iniciar sesion|login|sitio oficial|telefono de|direccion de)\b/.test(s))return 'navegacional';
  if(/\b(como|que|cuando|donde|cuanto|requisitos|plazo|guia|medidas|sirve|duracion)\b/.test(s))return 'informacional';
  return 'por revisar';
}

function relatedPage(term,pages){
  const t=tokens(term);
  let winner=null,best=0;
  for(const p of pages){
    if(p.status!==200||p.noindex||p.html===false)continue;
    const value=overlap(t,tokens([p.title,p.h1,...(p.h2||[])].join(' ')));
    if(value>=0.55&&value>best){best=value;winner=p.url;}
  }
  return winner;
}

function pageCandidates(site,pages,svc){
  const result=[],seen=new Set(), terms=svc.map(subject=>({subject,t:tokens(subject)}));
  for(const p of pages.filter(p=>p.status===200&&!p.noindex&&p.html!==false)){
    const title=String(p.h1||p.title||'').split(/[|·]/)[0].trim(),headings=(p.h2||[]).map(String);
    const context=tokens([title,p.title].join(' '));
    const matched=terms.map(s=>({...s,fit:overlap(s.t,context)})).sort((a,b)=>b.fit-a.fit)[0];
    if(!matched||matched.fit<0.48)continue;
    for(const heading of [title,...headings]){
      const text=heading.trim().replace(/[?¿]+/g,'').slice(0,160),t=tokens(text);
      if(!text||t.size<2||/^(?:inicio|contacto|opiniones|productos relacionados|envio y devoluciones|politica de privacidad|sobre nosotros)$/i.test(normalize(text)))continue;
      const sameSubject=overlap(matched.t,t)>=0.48;
      const specific=/\b(para|sin|con|segun|precio|requisitos|plazo|plazos|medidas|como|cuanto|cerca|comparar|diferencia|pequenos|pequenas|pequeno|pequena|angosto|angosta)\b/.test(normalize(text));
      if(!specific)continue;
      const keyword=sameSubject?text:matched.subject+' · '+text;
      const key=normalize(keyword);if(seen.has(key))continue;seen.add(key);
      result.push({keyword,page:p.url,subject:matched.subject,heading,source:'Encabezado del sitio',observed:false,impressions:null,clicks:null,position:null,volume:null,ctr:null,country:site.country||'',device:'',longTail:true,
        reason:'La página ya trata este tema en «'+heading+'». Revisar si responde a una necesidad de clientes del servicio «'+matched.subject+'».',priority:18,
        evidence:{page:p.url,heading,service:matched.subject}});
      if(result.length===80)return result;
    }
  }
  return result;
}

export function opportunities(site,rows=[],pages=[],{pageLevel=false}={}){
  const groups=new Map();
  const candidates=[];
  const svc=services(site);
  const business=tokens([site.name,site.business,site.activity,...svc].join(' '));
  const referenceRows=new Set();
  for(const r of rows){
    const keyword=String(r.query||'').trim();if(!keyword)continue;
    if(r.observed===false || (r.clicks==null && r.impressions==null)){
      candidates.push({keyword,page:r.page||null,source:r.source||'Importación',country:r.country||site.country||'',device:r.device||''});
      continue;
    }
    const context=[r.country||site.country||'',r.device||'',r.type||'web',r.source||'Search Console',r.date?'diaria':'período sin desglose'];
    if(pageLevel)context.push(r.page);
    const key=JSON.stringify([normalize(keyword),...context]);
    // When dates are present the newest revision of an observation is the importer's responsibility.
    // Remove exact repeats without merging distinct search contexts.
    const signature=JSON.stringify([key,r.page,r.date,r.startDate,r.endDate,r.clicks,r.impressions,r.position]);
    if(referenceRows.has(signature))continue;
    referenceRows.add(signature);
    if(!groups.has(key))groups.set(key,{keyword,variants:new Set(),context,clicks:0,impressions:0,missingClicks:false,missingImpressions:false,weighted:0,positionWeight:0,pages:new Map(),dates:new Set(),sources:new Set()});
    const g=groups.get(key);
    const im=Number(r.impressions),cl=Number(r.clicks);
    if(!Number.isFinite(im)||im<0||!Number.isFinite(cl)||cl<0||(r.impressions!=null&&cl>im))continue;
    if(r.impressions==null)g.missingImpressions=true;
    if(r.clicks==null)g.missingClicks=true;
    g.variants.add(keyword);g.impressions+=im;g.clicks+=cl;
    if(Number(r.position)>0){g.weighted+=im*Number(r.position);g.positionWeight+=im;}
    if(r.page)g.pages.set(r.page,(g.pages.get(r.page)||0)+im);
    if(r.date)g.dates.add(r.date);
    g.sources.add(String(r.source||'Search Console'));
  }
  const out=[];
  const known=new Set();
  for(const g of groups.values()){
    if(!g.sources.size)continue;
    known.add(normalize(g.keyword));
    const page=[...g.pages].sort((a,b)=>b[1]-a[1])[0]?.[0]||relatedPage(g.keyword,pages);
    const position=g.positionWeight ? round(g.weighted/g.positionWeight):null;
    const fit=overlap(tokens(g.keyword),business), intent=classify(g.keyword);
    const priority=Math.min(100,Math.round(20+Math.min(30,8*Math.log10(1+g.impressions))+30*fit+(position!==null&&position>=4&&position<=20?15:0)+(page?5:0)));
    const ordered=[...g.dates].sort();
    const measured=[!g.missingImpressions&&g.impressions+' impresiones',!g.missingClicks&&g.clicks+' clics'].filter(Boolean).join(' y ');
    const preserve=page&&position!==null&&position<=3&&g.clicks>0;
    const action=preserve?'Mantener':page?'Mejorar':(pages.length&&fit>0.3&&g.impressions>=50?'Evaluar página nueva':'Investigar');
    out.push({id:id(site.url,normalize(g.keyword),g.context),keyword:g.keyword,variants:[...g.variants],intent,source:[...g.sources].join(', '),observed:true,volume:null,
      page:page||null,action,reason:(measured||'Métricas parciales')+'. '+(preserve?'La posición media y los clics justifican conservar el contenido y seguir su evolución.':page?'Revisar si la página resuelve la intención.':'Confirmar la página adecuada antes de crear contenido.'),
      impressions:g.missingImpressions?null:g.impressions,clicks:g.missingClicks?null:g.clicks,position,ctr:!g.missingClicks&&!g.missingImpressions&&g.impressions?g.clicks/g.impressions:null,priority,country:g.context[0],device:g.context[1],type:g.context[2],
      startDate:ordered[0]||null,endDate:ordered.at(-1)||null,...(pageLevel?{observedDays:ordered.join(',')}:{ }),confidence:g.impressions>=50?'media':'baja',
      longTail:/\b(para|con|sin|cerca de|cuanto cuesta|como elegir|requisitos para)\b/.test(normalize(g.keyword)),
      evidence:{pages:Object.fromEntries(g.pages),businessMatch:round(fit),rule:'Prioridad editorial basada en afinidad, impresiones, posición y página conocida.'}});
  }
  const imported=new Set();
  if(pageLevel)return out;
  for(const c of candidates){
    const cid=id(site.url,normalize(c.keyword),c.source,c.country,c.device,'candidata');if(imported.has(cid))continue;imported.add(cid);
    known.add(normalize(c.keyword));
    out.push({...c,id:cid,variants:[],intent:classify(c.keyword),observed:false,volume:null,impressions:null,clicks:null,position:null,ctr:null,page:c.page||relatedPage(c.keyword,pages),priority:10,
      action:'Validar demanda',reason:'Término aportado sin métricas observadas. Revisar su intención y contrastarlo con consultas reales.',confidence:'por validar',longTail:/\b(para|con|sin|cerca de|cuanto cuesta|como elegir|requisitos para)\b/.test(normalize(c.keyword))});
  }
  for(const c of pageCandidates(site,pages,svc)){
    const norm=normalize(c.keyword);if(known.has(norm))continue;known.add(norm);
    out.push({...c,id:id(site.url,norm,c.page,'encabezado'),variants:[],intent:classify(c.keyword),action:'Validar demanda',confidence:'por validar'});
  }
  for(const subject of svc)for(const keyword of ['cómo elegir '+subject,'cuánto cuesta '+subject,'qué incluye '+subject]){
    const norm=normalize(keyword);if(known.has(norm))continue;known.add(norm);
    const page=relatedPage(keyword,pages);
    out.push({id:id(site.url,norm,'candidata'),keyword,variants:[],intent:classify(keyword),source:'Sugerencia desde servicios',observed:false,
      page,action:page?'Investigar página':'Validar demanda',reason:'Hipótesis basada en el servicio «'+subject+'». Confirmar pertinencia con preguntas de clientes o consultas observadas.',
      impressions:null,clicks:null,position:null,ctr:null,volume:null,priority:10,confidence:'por validar',longTail:true,country:site.country||'',device:'',type:'',evidence:{service:subject,page},group:subject+' · '+classify(keyword)});
  }
  // Label clusters without replacing their individual metrics. Prefer a verified URL.
  for(const o of out) if(!o.group){
    const best=svc.map(s=>[s,overlap(tokens(s),tokens(o.keyword))]).sort((a,b)=>b[1]-a[1])[0];
    o.group=(o.page||((best&&best[1]>=0.5)?best[0]:o.keyword))+' · '+o.intent;
  }
  const clusters=new Map();
  for(const o of out){
    const k=JSON.stringify([o.group,o.country]);
    if(!clusters.has(k))clusters.set(k,[]);
    const cluster=clusters.get(k);
    if(cluster.length<8&&!cluster.some(c=>c.keyword===o.keyword))cluster.push({keyword:o.keyword,source:o.source,observed:o.observed});
  }
  for(const o of out)o.related=clusters.get(JSON.stringify([o.group,o.country])).filter(c=>c.keyword!==o.keyword);
  return out.sort((a,b)=>b.priority-a.priority||a.keyword.localeCompare(b.keyword,'es'));
}

export function briefFor(site,o){
  const svc=services(site),best=svc.map(s=>[s,overlap(tokens(s),tokens(o.keyword))]).sort((a,b)=>b[1]-a[1])[0];
  const subject=o.evidence?.service||(best?.[1]>0?best[0]:site.business||site.name||o.keyword);
  const variantLines=(o.related||[]).slice(0,5).map(c=>'- '+c.keyword+' ('+c.source+(c.observed?', observada':', por validar')+')');
  const questions=o.intent==='comercial'?['¿Qué opciones resuelven esta necesidad y en qué se diferencian?','¿Qué incluyen el precio y las condiciones de cada opción?']:
    o.intent==='transaccional'?['¿Qué hace falta para comprar o contratar?','¿Qué condiciones, plazos y cobertura se aplican?']:
    ['¿Qué necesita saber primero quien hace esta consulta?','¿Qué requisitos, pasos o excepciones cambian la respuesta?'];
  return ['# '+o.keyword,'','## Objetivo','Ayudar a quien busca «'+o.keyword+'» a tomar una decisión sobre '+subject+'.',
    '','## Página y evidencia','Página: '+(o.page||'pendiente de asignar')+'.','Acción: '+o.action+'.',o.reason,
    'Fuente: '+o.source+'. '+(o.country?'Mercado: '+o.country+'.':''),
    '','## Intención y preguntas','Intención propuesta: '+o.intent+'. Revisar la interpretación con el equipo.',
    'Pregunta principal: '+o.keyword,'Variantes observadas: '+((o.variants||[]).filter(v=>normalize(v)!==normalize(o.keyword)).join(', ')||'sin variantes adicionales verificadas')+'.',
    ...(variantLines.length?['Términos y preguntas del mismo grupo:',...variantLines]:[]),
    ...(o.evidence?.heading?['Encabezado encontrado en '+o.evidence.page+': «'+o.evidence.heading+'».']:[]),
    'Preguntas editoriales propuestas:',...questions.map(q=>'- '+q),
    '','## Estructura de trabajo','1. Responder la necesidad principal en el primer apartado.','2. Explicar criterios, condiciones y ejemplos que el equipo pueda verificar.',
    '3. Resolver dudas específicas y enlazar la página de producto o servicio pertinente.',
    '','## Antes de aprobar','Confirmar datos propios, añadir enlaces a fuentes y comprobar su fecha. Conservar las secciones que ya atraen consultas.',
    'Elegir una llamada a la acción coherente con la intención y registrar URL y fecha después de publicar.'].join('\n');
}

export function evaluateChange({appliedAt,before=[],after=[],now=new Date()}={}) {
  const applied=Date.parse(String(appliedAt||'').slice(0,10)+'T00:00:00Z'),today=Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z'),day=86400000;
  const empty={deltaClicks:null,deltaImpressions:null,recommendation:'Observar'};
  if(!Number.isFinite(applied)||today-applied<29*day)return {...empty,state:'esperando',message:'En observación. La comparación necesita 28 días completos posteriores al cambio.'};
  function sum(data,start){
    const a={clicks:0,impressions:0,days:new Set()};
    for(const r of data){
      const t=Date.parse(String(r.date||'')+'T00:00:00Z');
      if(!(t>=start&&t<start+28*day)||r.final===false||r.isFinal===false||r.preliminary===true)continue;
      if(r.clicks==null||r.impressions==null||!Number.isFinite(Number(r.clicks))||!Number.isFinite(Number(r.impressions)))continue;
      a.clicks+=Number(r.clicks);a.impressions+=Number(r.impressions);a.days.add(t);
    }
    return a;
  }
  const a=sum(before,applied-28*day),b=sum(after,applied+day);
  if(a.days.size<28||b.days.size<28||Math.min(a.impressions,b.impressions)<50)return {...empty,state:'insuficiente',message:'Falta cobertura de días o muestra suficiente. Conservar la página en seguimiento.'};
  const deltaClicks=b.clicks-a.clicks,deltaImpressions=b.impressions-a.impressions;
  const loss=a.clicks>=10&&-deltaClicks>=5&&b.clicks<=a.clicks*0.75;
  const visibilityLoss=a.impressions>=100&&b.impressions<=0.7*a.impressions;
  const recommendation=loss&&b.impressions>=0.9*a.impressions?'Mejorar':loss||visibilityLoss?'Revisar':'Mantener';
  const instruction=recommendation==='Mejorar'?'Contrastar la intención de las consultas y ajustar el título o el apartado que recibe impresiones.':
    recommendation==='Revisar'?'Comprobar demanda, estacionalidad, indexación y cambios de página antes de reescribir.':'Conservar el contenido y seguir las consultas que ya atraen visitas.';
  return {state:'medido',deltaClicks,deltaImpressions,recommendation,message:'En dos períodos de 28 días, los clics pasaron de '+a.clicks+' a '+b.clicks+' y las impresiones de '+a.impressions+' a '+b.impressions+'. '+recommendation+'. '+instruction};
}
