import {createHash} from 'node:crypto';
import {indexability,technicalAudit} from './technical-audit.mjs';

const n=(x,d)=>Number.isFinite(Number(x))?Math.trunc(Number(x)):d;
const smallIssue=({id,title,rule,severity,url})=>({id,title,rule,severity,url});
const historyLimit=256*1024;
function compactIssues(all) {
 const issues=[];
 let bytes=2; // Opening and closing JSON brackets
 for(const finding of all){
   const item=smallIssue(finding),size=Buffer.byteLength(JSON.stringify(item),'utf8')+(issues.length?1:0);
   if(issues.length>=1500||bytes+size>historyLimit)break;
   issues.push(item);
   bytes+=size;
 }
 return {issues,truncated:issues.length<all.length};
}
export function rememberAudit(site,batch,scored,fresh,complete,at) {
 const addEvents=(old,rows)=>[...new Map([...(old||[]),...rows].map(r=>[r.url,r])).values()].slice(-500);
 const checked=new Set(batch.pages.flatMap(p=>[p.url,p.requestedUrl].filter(Boolean)));
 site.auditBlocked=addEvents((site.auditBlocked||[]).filter(e=>!checked.has(e.url)),(batch.skipped||[]).map(url=>({url,message:'Excluida por robots.txt',at})));
 site.auditErrors=addEvents((site.auditErrors||[]).filter(e=>!checked.has(e.url)),(batch.errors||[]).map(e=>({...e,at})));
 const redirects=batch.pages.flatMap(p=>(p.redirects||[]).map((r,i)=>({url:r.url,status:r.status,to:r.to,finalUrl:p.url,redirects:p.redirects.slice(i),checkedAt:at})));
 site.auditRedirects=addEvents((site.auditRedirects||[]).filter(e=>!checked.has(e.url)),redirects);
 if(!complete)return;
 const checkedUrls=new Set(scored.map(p=>p.url)),earliest=scored.reduce((start,p)=>p.checkedAt&&p.checkedAt<start?p.checkedAt:start,at);
 const coverage=createHash('sha256').update(JSON.stringify([site.url,fresh.version,[...checkedUrls].sort(),
  site.auditRedirects.filter(r=>checkedUrls.has(r.finalUrl)&&r.checkedAt>=earliest).map(r=>r.url).sort()])).digest('hex');
 const snapshot={at,coverage,count:scored.length,...compactIssues(fresh.issues),
  sampled:scored.some(p=>p.sampleLimits?.linksMayBePartial||p.sampleLimits?.hreflangPartial||p.schema?.count>p.schema?.tested)};
 site.auditHistory=[...(site.auditHistory||[]),snapshot].slice(-2);
}
export function auditComparison(site){
 const history=site.auditHistory||[],cur=history.at(-1),prev=history.at(-2);
 const out={comparable:false,reason:'Se requieren dos rastreos completos de la misma cobertura y versión de reglas.',previousAt:prev?.at||null,currentAt:cur?.at||null,added:[],resolved:[]};
 if(!cur||!prev)return out;
 if(cur.coverage!==prev.coverage){out.reason='El conjunto de URLs o la versión de reglas cambió entre los dos rastreos completos.';return out;}
 if(cur.truncated||prev.truncated){out.reason='El historial alcanzó su límite de 1.500 hallazgos o 256 KiB por rastreo.';return out;}
 if(cur.sampled||prev.sampled){out.reason='Al menos una página alcanzó un límite de extracción. No se puede confirmar una comparación completa.';return out;}
 const before=new Set(prev.issues.map(i=>i.id)),after=new Set(cur.issues.map(i=>i.id));
 return {...out,comparable:true,reason:'Mismas URLs y versión de reglas en dos rastreos completos.',added:cur.issues.filter(i=>!before.has(i.id)),resolved:prev.issues.filter(i=>!after.has(i.id))};
}
function edgesOf(page) {
 return page.outgoing||((page.links||[]).map(url=>({url,internal:true,nofollow:null,anchor:null})));
}
export function auditForSite(site){
 // Older sites may still store the previous catalogue. Reconstruct only what the recorded fields support.
 return site.audit?.version==='tecnica-html-2'?site.audit:technicalAudit({pages:site.pages||[],complete:site.audit?.coverage?.partial===false,checkedAt:site.lastReviewAt});
}
export function auditReport(site,{offset=0,limit=50,q='',status='',indexability:filter='',url=''}={}){
 const all=new Map((site.pages||[]).map(p=>[p.url,p]));
 for(const p of site.auditRedirects||[])if(!all.has(p.url)||p.checkedAt>all.get(p.url)?.checkedAt)all.set(p.url,{...p,html:false});
 const incoming=new Map(),depth=new Map(),start=new URL(site.url).href;
 const ordered=[...all.values()];
 for(const p of ordered)for(const link of edgesOf(p)){
   if(!link.internal)continue;
   if(!incoming.has(link.url))incoming.set(link.url,[]);
   incoming.get(link.url).push({url:p.url,anchor:link.anchor,nofollow:link.nofollow});
 }
 if(all.has(start)){
   const queue=[start];depth.set(start,0);
   for(let i=0;i<queue.length;i++){
     const here=queue[i],p=all.get(here);
     const targets=p.finalUrl?[p.finalUrl]:(p.links||[]);
     for(const target of targets)if(all.has(target)){
       const dist=depth.get(here)+(p.finalUrl?0:1);
       if(!depth.has(target)||dist<depth.get(target)){depth.set(target,dist);queue.push(target);}
     }
   }
 }
 const inventoryRow=p=>({url:p.url,status:p.status??null,contentType:p.contentType||null,title:p.title??null,description:p.description??null,h1:p.h1??null,
   canonical:p.canonical??null,indexability:indexability(p),depth:depth.get(p.url)??null,inlinks:(incoming.get(p.url)||[]).length,outlinks:edgesOf(p).length,
   checkedAt:p.checkedAt||null,redirectCount:p.redirects?.length??null,imageCount:p.imageCount??null,wordCount:p.wordCount??null});
 const term=String(q).trim().toLowerCase().slice(0,300);
 const rows=ordered.map(inventoryRow).filter(p=>(!term||(p.url+' '+(p.title||'')).toLowerCase().includes(term))&&(!filter||p.indexability===filter)&&
    (!status||String(p.status)===String(status)||/^[2345]xx$/.test(status)&&String(p.status)[0]===status[0])).sort((a,b)=>a.url.localeCompare(b.url));
 const from=Math.max(0,n(offset,0)),size=Math.max(1,Math.min(100,n(limit,50)));
 const live=auditForSite(site);
 const issues=live.issues||[],severity={alta:0,media:0,baja:0};for(const i of issues)if(Object.hasOwn(severity,i.severity))severity[i.severity]++;
 const p=url?all.get(url):null;
 const page=p?{...inventoryRow(p),headings:p.headings||[...(p.h1?[{level:1,text:p.h1}]:[]),...(p.h2||[]).map(text=>({level:2,text}))],
  lang:p.lang??null,elapsedMs:p.elapsedMs??null,bytes:p.bytes??null,finalUrl:p.finalUrl||p.url,redirects:p.redirects||[],metaRobots:p.metaRobots??null,headerRobots:p.headerRobots??null,
  robots:p.robots??null,images:p.images||[],missingAlt:p.missingAlt??null,hreflang:p.hreflang||[],schema:p.schema||null,
  outgoing:edgesOf(p).map(e=>({...e,status:all.get(e.url)?.status??null})),incoming:(incoming.get(p.url)||[]).slice(0,500),
  issues:issues.filter(i=>i.url===p.url),sampleLimits:p.sampleLimits||null}:null;
 return {score:live.score,version:live.version,dimensions:live.dimensions,coverage:live.coverage,severity,issues:issues.slice(0,1500),issueCount:issues.length,
  checks:live.checks,explanation:live.explanation,inventory:{rows:rows.slice(from,from+size),total:rows.length,offset:from,limit:size},page,
  comparison:auditComparison(site),limits:{maxPages:500,maxLinksPerPage:160,maxImagesPerPage:24,maxIssues:1500},
  blocked:site.auditBlocked||[],errors:site.auditErrors||[]};
}
