import {createHash} from 'node:crypto';
const norm=t=>String(t||'').normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
const key=(rule,url)=>createHash('sha256').update(JSON.stringify([rule,url])).digest('hex').slice(0,20);
const dim={access:'Acceso e indexabilidad',content:'Contenido y metadatos',links:'Enlazado y redirecciones',international:'Idioma y alternativas',media:'Imágenes y datos estructurados'};
const eligible=p=>p.status===200&&p.html!==false;
const validLang=s=>{if(s?.toLowerCase()==='x-default')return true;try{return !!s&&Intl.getCanonicalLocales(s).length>0;}catch{return false;}};
const list=s=>s.slice(0,5).join(' · ');
const hop=p=>Array.isArray(p.redirects)?p.redirects.length:null;
const plain=(flag,text)=>[Boolean(flag),String(text)];
const rules=[
  ['http','access',5,'alta','Acceso HTTP','Restablecer el acceso o corregir enlaces hacia la dirección.',(p)=>plain(p.status>=200&&p.status<300,'HTTP '+p.status)],
  ['title','content',3,'media','Título de la página','Escribir un título descriptivo y específico.',p=>plain(p.title,p.title||'Falta texto en title.')],
  ['description','content',1,'baja','Descripción de búsqueda','Redactar un resumen específico para esta página.',p=>plain(p.description,p.description||'Meta description vacía o ausente.')],
  ['h1','content',2,'media','Encabezado principal','Añadir un encabezado principal descriptivo.',p=>plain(p.h1,p.h1||'Falta un H1 con texto.')],
  ['canonical','access',2,'media','Destino de la canónica','Revisar la consolidación de esta URL y comprobar el destino declarado.',p=>{
    if(!p.canonical)return null;try{return plain(['http:','https:'].includes(new URL(p.canonical).protocol)&&new URL(p.canonical).origin===new URL(p.url).origin,p.canonical);}catch{return plain(false,p.canonical);}
  }],
  ['multiple-canonical','access',3,'alta','Declaraciones canónicas múltiples','Conservar una única declaración canónica coherente.',p=>p.canonicals==null?null:plain(p.canonicals<=1,p.canonicals+' declaraciones.')],
  ['canonical-target','access',4,'alta','Canónica apunta a un destino con problemas','Corregir la canónica o el estado del destino tras comprobar cuál debe posicionar.',(p,c)=>{
    const dest=c.byUrl.get(p.canonical);if(!dest||p.canonical===p.url)return null;
    return plain(dest.status===200&&!dest.noindex,p.canonical+' · HTTP '+dest.status+(dest.noindex?' · noindex':''));
  }],
  ['duplicate-title','content',2,'media','Título repetido','Comprobar intención, diferenciar títulos y revisar las páginas coincidentes.',(p,c)=>c.duplicates(p,'title')],
  ['duplicate-description','content',1,'baja','Descripción repetida','Describir lo que distingue a cada página.',(p,c)=>c.duplicates(p,'description')],
  ['duplicate-content','content',3,'media','Texto principal idéntico','Verificar si ambas páginas necesitan existir y revisar su contenido o consolidación.',(p,c)=>c.duplicates(p,'contentHash')],
  ['broken','links',4,'alta','Enlaces internos con error','Corregir los destinos o recuperar las páginas enlazadas.',(p,c)=>{
    const arr=(p.links||[]).filter(l=>c.byUrl.has(l));if(!arr.length)return null;
    const bad=arr.filter(l=>c.byUrl.get(l).status>=400);return plain(!bad.length,bad.length?list(bad.map(l=>l+' (HTTP '+c.byUrl.get(l).status+')')):arr.length+' comprobados.');
  }],
  ['chain','links',2,'media','Cadena de redirecciones','Cambiar enlaces y reglas para llegar directamente al destino final.',p=>hop(p)===null?null:plain(hop(p)<2,list(p.redirects.map(r=>r.url+' → '+r.status)))],
  ['lang','international',1,'baja','Idioma del documento','Declarar en el elemento html el idioma del contenido con una etiqueta válida.',p=>p.lang===undefined?null:plain(validLang(p.lang)&&p.lang!=='x-default',p.lang||'Atributo lang ausente.')],
  ['hreflang','international',2,'media','Alternativas de idioma inválidas','Usar códigos de idioma válidos y URLs HTTP o HTTPS válidas.',p=>{
    if(!p.hreflang?.length)return null;const bad=p.hreflang.filter(h=>!validLang(h.lang)||!h.url);return plain(!bad.length,bad.length?list(bad.map(h=>(h.lang||'vacío')+' → '+(h.url||'URL inválida'))):'Alternativas parseadas.');
  }],
  ['hreflang-back','international',2,'media','Falta el enlace de retorno entre idiomas','Añadir la referencia recíproca en la página alternativa si pertenece al mismo conjunto.',(p,c)=>{
    const links=(p.hreflang||[]).filter(h=>h.url&&h.url!==p.url&&eligible(c.byUrl.get(h.url)||{})&&Array.isArray(c.byUrl.get(h.url).hreflang));
    if(!links.length)return null;const bad=links.filter(h=>!c.byUrl.get(h.url).hreflang.some(a=>a.url===p.url));return plain(!bad.length,list(bad.map(h=>h.url)));
  }],
  ['alt','media',1,'baja','Alternativas de imágenes','Describir imágenes informativas y declarar alt vacío para las decorativas.',p=>p.imageCount?plain(p.missingAlt===0,p.missingAlt+' imágenes sin atributo alt de '+p.imageCount):null],
  ['schema-json','media',2,'media','Bloque JSON-LD inválido','Revisar la sintaxis de los bloques y la información que describen.',p=>p.schema?.tested?plain(p.schema.invalid===0,p.schema.invalid+' bloques inválidos de '+p.schema.tested+' examinados.'):null]
];
export const graphRules=new Set(['broken','duplicate-title','duplicate-description','duplicate-content','canonical-target','hreflang-back']);
export function indexability(p){
  if(p.status>=300&&p.status<400)return 'redirect';
  if(p.status>=400)return 'http_error';
  if(!eligible(p))return 'unknown';
  if(p.noindex)return 'noindex';
  if(p.canonical&&p.canonical!==p.url)return 'canonical';
  return 'eligible';
}
export function technicalAudit(crawl={}){
 const pages=[...new Map((crawl.pages||[]).map(p=>[p.url,p])).values()];
 const byUrl=new Map(),groups=new Map();
 for(const p of pages){
   byUrl.set(p.url,p);if(p.requestedUrl)byUrl.set(p.requestedUrl,p);
   for(const f of ['title','description','contentHash']){
     if(!eligible(p)||!p[f]||(f==='contentHash'&&!(p.wordCount>=30)))continue;
     const k=f+'|'+norm(p[f]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p.url);
   }
 }
 const context={byUrl,duplicates(p,f){const found=groups.get(f+'|'+norm(p[f]));if(!found)return null;
   if(found.length<2&&!crawl.complete)return null;
   return plain(found.length<2,(f==='contentHash'?'Coincidencia de texto':p[f])+' · '+list(found));}};
 const checks=rules.map(([id,dimension,weight,severity,label])=>({id,dimension,weight,severity,label,passed:0,failed:0,skipped:0})),issues=[];
 for(const p of pages){
   for(const [i,[rule,dimension,,severity,title,fix,run]] of rules.entries()){
     const checked=rule==='http'||eligible(p)?run(p,context):null;
     if(!checked){checks[i].skipped++;continue;}
     const [ok,evidence]=checked;checks[i][ok?'passed':'failed']++;
     if(!ok)issues.push({id:key(rule,p.url),rule,dimension,url:p.url,title,severity,evidence,fix,checkedAt:p.checkedAt||crawl.checkedAt});
   }
   if(eligible(p)&&p.noindex)issues.push({id:key('noindex',p.url),rule:'noindex',dimension:'access',url:p.url,title:'Confirmar exclusión del índice',severity:'alta',evidence:p.robots||'Directiva noindex',fix:'Confirmar si esta página debe posicionar. Conservar la exclusión si cumple la intención del sitio.',checkedAt:p.checkedAt||crawl.checkedAt});
 }
 const values=rs=>{
   const passed=rs.reduce((n,r)=>n+r.passed,0),failed=rs.reduce((n,r)=>n+r.failed,0),skipped=rs.reduce((n,r)=>n+r.skipped,0);
   const earn=rs.reduce((n,r)=>n+r.weight*r.passed,0),total=rs.reduce((n,r)=>n+r.weight*(r.passed+r.failed),0);
   // Keep a perfect result distinct from a large sample with a few failed checks.
   const rounded=total?Math.round(1000*earn/total)/10:null;
   return {score:failed&&rounded===100?99.9:rounded,passed,failed,skipped};
 };
 const global=values(checks);
 return {score:global.score,version:'tecnica-html-2',dimensions:Object.entries(dim).map(([id,label])=>({id,label,...values(checks.filter(c=>c.dimension===id))})),checks,issues,
  coverage:{pages:pages.length,eligible:pages.filter(eligible).length,passed:global.passed,failed:global.failed,checked:global.passed+global.failed,errors:crawl.errors?.length||0,partial:!crawl.complete||Boolean(crawl.robotsBlocked)||Boolean(crawl.errors?.length)||Boolean(crawl.truncated)},
  explanation:'Porcentaje de controles aprobados sobre controles evaluados, ponderado por el peso de cada regla. Los controles sin evidencia quedan fuera del denominador. Las instrucciones noindex requieren una decisión editorial y no restan puntos por sí solas.'};
}
