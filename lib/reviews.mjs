import { enqueueJob, claimJob, finishJob, failJob } from './store.mjs';
import { saveDailyBackup } from './backup.mjs';
import {planArchive,saveGscArchive,commitSearchRows} from './gsc-archive.mjs';
import { crawlSite } from './crawl.mjs';
import { auditSite } from './seo.mjs';
import { measure } from './site.mjs';
import { syncGsc, shiftDay, problem } from './sources.mjs';
import { searchTrend } from './performance.mjs';
import { historicalAnalytics } from './analytics.mjs';
import {rememberAudit,auditComparison} from './audit-report.mjs';
import {graphRules} from './technical-audit.mjs';

export const localDay=(now=new Date())=> new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function schedule(state,{now=new Date()}={}) {
  const day=localDay(now);
  for(const site of state.sites.filter(s=>!s.demo)) {
    const prev=site.lastReviewAt && localDay(new Date(site.lastReviewAt));
    if(prev && prev<shiftDay(day,-1)) site.missedSince=prev;
    enqueueJob(state,{siteId:site.id,day,now});
    const daily=state.jobs.find(j=>j.siteId===site.id&&j.day===day&&j.type==='daily');
    // Permit one extra crawl batch per day, without refreshing GSC again.
    if((site.hasCrawlCursor||site.crawlCursor?.queue?.length)&&daily?.status==='done')
      enqueueJob(state,{siteId:site.id,day,type:'crawl-continuation',now});
  }
  if(state.sites.some(s=>!s.demo)) enqueueJob(state,{siteId:'_system',day,type:'backup',now});
  state.jobs=state.jobs.filter(j=>!['done','failed'].includes(j.status)||j.day>=shiftDay(day,-90));
}
export function manualReview(state,site) {
  const day=localDay();
  const current=state.jobs.find(j=>j.siteId===site.id&&['pending','running'].includes(j.status));
  if(current) return current;
  const count=state.jobs.filter(j=>j.siteId===site.id&&j.day===day&&j.type.startsWith('manual')).length;
  if(count>=3) throw problem('Se alcanzaron las tres revisiones manuales de hoy. La revisión diaria conserva su turno.',429);
  return enqueueJob(state,{siteId:site.id,day,type:'manual-'+(count+1)});
}
export async function runNext(store,{now=new Date(),crawl=crawlSite,source=syncGsc,analytics=historicalAnalytics,backup=saveDailyBackup,archive=saveGscArchive}={}) {
  const wallStart=Date.now();
  const endClock=()=>new Date(now.getTime()+Date.now()-wallStart);
  const job=await store.mutate(st=>claimJob(st,{now,leaseMs:13*60000}),{keys:['jobs']});
  if(!job) return false;
  try {
    if(job.type==='backup') {
      await backup(store,job.day);
      await store.mutate(st=>finishJob(st,job.id,job.leaseToken,{result:'Respaldo cifrado completado',now:endClock()}),{keys:['jobs']});
      return true;
    }
    const site=(await store.read({keys:['sites'],siteId:job.siteId})).sites.find(s=>s.id===job.siteId);
    if(!site) throw Error('Sitio no disponible.');
    const touch=now.toISOString(),continuation=job.type==='crawl-continuation';
    if(continuation&&!site.crawlCursor){await store.mutate(st=>finishJob(st,job.id,job.leaseToken,{result:'Cola ya completada',now:endClock()}),{keys:['jobs']});return true;}
    const full = !site.nextFull || job.day>=site.nextFull || Boolean(site.crawlCursor);
    const priorityUrls=site.tasks.filter(t=>t.page&&!['descartada','cerrada'].includes(t.status)).map(t=>t.page);
    const snapshot=site.demo ? {pages:site.pages,errors:[],complete:true,checkedAt:touch} :
      await crawl(site,{maxPages:full?50:30,timeBudgetMs:85000,cursor:full?site.crawlCursor:null,priorityUrls});
    let gsc=null, gscError=null;
    if(site.gscProperty&&!site.demo&&!continuation) {
      try {gsc=await source(site,{now});} catch(e){gscError=e.status?e.message:'Search Console no respondió. Se conservan los últimos datos.';}
    }
    const verified=[];
    let archiveError=false;
    if(gsc){
      try{
        const batches=planArchive(site,gsc,job.day);
        // This limit reserves bucket capacity for database backups.
        if((site.gscArchives||[]).length+batches.length>1000)throw Error('Archivo completo.');
        for(const rows of batches)verified.push({rows,meta:await archive(store,site.id,rows)});
      }catch{archiveError=true;}
    }
    let analyticsData=null, analyticsError=null;
    if(site.ga4PropertyId&&site.ga4StreamId&&!site.demo&&!continuation){
      try{analyticsData=await analytics(site,{now});}catch(e){analyticsError=e.status?e.message:'Analytics no respondió. Se conservan los datos anteriores.';}
    }
    await store.mutate(state=>{
      const s=state.sites.find(x=>x.id===job.siteId);
      if(site.ga4PropertyId===s.ga4PropertyId&&site.ga4StreamId===s.ga4StreamId){
        if(analyticsData)Object.assign(s,analyticsData);
        if(analyticsError)s.ga4LastError=analyticsError;
      }
      const prev=new Map(s.pages.map(p=>[p.url,p]));
      const changes=[];
      for(const p of snapshot.pages) {
        const old=prev.get(p.url);
        if(!old) changes.push({url:p.url,kind:'Página descubierta'});
        else if(['status','contentHash','title','canonical','noindex'].some(k=>p[k]!==old[k])) changes.push({url:p.url,kind:'Cambio observado'});
        prev.set(p.url,{...p,checkedAt:touch});
      }
      s.pages=[...prev.values()].sort((a,b)=>String(a.checkedAt||'').localeCompare(String(b.checkedAt||''))).slice(-500);
      s.crawlCursor=full?snapshot.cursor:null;
      const sweepStart=site.crawlCursor&&site.fullSince ? site.fullSince:touch;
      const previousGap=Boolean(site.crawlCursor&&site.fullGap);
      const gap=previousGap||Boolean(snapshot.errors.length||snapshot.robotsBlocked||snapshot.truncated);
      const sweepDone=full&&!gap&&!snapshot.cursor&&snapshot.complete;
      s.fullSince=snapshot.cursor?sweepStart:null;
      s.fullGap=Boolean(snapshot.cursor&&gap);
      if(full&&!snapshot.cursor&&snapshot.pages.length) s.nextFull=shiftDay(job.day,7);
      const previous=new Map((s.audit?.issues||[]).map(i=>[i.id,i]));
      const inspected=new Map(snapshot.pages.map(p=>[p.url,p]));
      const scored=sweepDone?s.pages.filter(p=>p.checkedAt>=sweepStart):snapshot.pages;
      const fresh=auditSite({...snapshot,complete:sweepDone,pages:scored});
      // Keep the actual observation date when combining several batches in one full crawl.
      const stamps=new Map(scored.map(p=>[p.url,p.checkedAt||touch]));
      for(const i of fresh.issues)i.checkedAt=stamps.get(i.url)||touch;
      function canRecheck(i) {
        if(!i)return false;
        if(graphRules.has(i.rule)) return graphComparable&&stamps.has(i.url);
        const p=inspected.get(i.url);
        return p&&(i.rule==='http'||p.status===200&&p.html!==false);
      }
      const active=new Set(fresh.issues.map(i=>i.id));
      rememberAudit(s,snapshot,scored,fresh,sweepDone,touch);
      const graphComparable=sweepDone&&auditComparison(s).comparable;
      const unverified=[...previous.values()].filter(i=>!active.has(i.id)&&!canRecheck(i));
      fresh.issues.push(...unverified.map(i=>({...i,pendingCheck:true})));
      fresh.coverage.pendingIssues=unverified.length;
      s.audit=fresh;
      const current=new Set(s.audit.issues.map(i=>i.id));
      if(gsc && site.gscProperty===s.gscProperty) {
        const dateSet=new Set(gsc.totals.map(r=>r.date));
        const saved=commitSearchRows(s,gsc,verified,job.day);
        if(!saved)gscError=archiveError?'El archivo histórico no se pudo comprobar. Se conserva el detalle anterior. El administrador debe revisar el almacén de copias.':'El detalle de consultas está detenido en el límite de 50.000 filas. Los datos protegidos se conservan. Revisa el historial en Conexiones.';
        s.totals=s.totals.filter(r=>!dateSet.has(r.date)).concat(gsc.totals).sort((a,b)=>a.date.localeCompare(b.date));
        s.gscTotalsUntil=s.totals.at(-1)?.date||null;
        s.gscDetailState=saved?'vigente':'detenido';
        s.gscDetailNotice=saved?'':gscError;
        if(!gscError){
          s.gscUntil=s.totals.at(-1)?.date||null;
          s.cappedDays=[...new Set([...(s.cappedDays||[]).filter(d=>!dateSet.has(d)),...gsc.capped])];
        }
      }
      const errors=[...snapshot.errors.map(e=>e.message),...(gscError?[gscError]:[]),...(analyticsError?[analyticsError]:[])];
      const partial=errors.length || !snapshot.complete || gap || gsc?.capped.length;
      const sourceStatus=continuation?'Continuación del rastreo.':s.gscProperty?(gscError||(gsc?'Search Console consultada.':'Conexión no comprobada.')):'Search Console sin conectar.';
      const message=[snapshot.pages.length+' páginas comprobadas.',sourceStatus,snapshot.cursor?'Quedan páginas en la cola.':'',gsc?.capped.length?'Detalle de búsquedas limitado a 500 filas por día.':'',snapshot.robotsBlocked?snapshot.robotsBlocked+' rutas excluidas por robots.txt.':'',errors.filter(e=>e!==gscError).slice(0,2).join(' ')].filter(Boolean).join(' ');
      const events=s.audit.issues.filter(i=>!previous.has(i.id)).map(i=>({title:i.title,message:i.url,at:touch}));
      if(gsc&&!gscError&&site.gscProperty===s.gscProperty&&gsc.totals.length){
        const end=gsc.totals.map(r=>r.date).sort().at(-1);
        const trend=searchTrend(s,end,touch);
        s.performanceState=trend.state;
        events.unshift(...trend.alerts);
      }
      if(errors.length) events.unshift({title:'Fuente o revisión parcial',message:errors[0],at:touch});
      const alerts=[...events,...s.alerts];
      s.alerts=alerts.filter((a,i)=>alerts.findIndex(b=>b.title===a.title&&b.message===a.message)===i).slice(0,40);
      s.lastReviewAt=touch;
      if(!partial&&!continuation) s.lastCompleteAt=touch;
      const review={at:touch,status:partial?'parcial':'completa',message,pagesChecked:snapshot.pages.length,changes:changes.slice(0,25)};
      s.reviews.unshift(review);s.reviews=s.reviews.slice(0,90);
      for(const t of s.tasks) {
        measure(s,t);
        if(t.origin?.startsWith('issue:')){
          const issueId=t.origin.slice(6);
          if(active.has(issueId)) t.verification={state:'persiste',at:touch,message:'La comprobación sigue detectando la incidencia.'};
          else if(canRecheck(previous.get(issueId))&&!current.has(issueId))
            t.verification={state:'revisada',at:touch,message:'La regla ya no señala el problema en la página comprobada.'};
        }
      }
      finishJob(state,job.id,job.leaseToken,{result:review.status,now:endClock()});
    },{keys:['sites','jobs'],siteId:job.siteId});
    if(!continuation&&typeof store.read==='function') {
      try {const {updateAnalysis}=await import('./analyst.mjs');await updateAnalysis(store,job.siteId,{now,allowModel:true});}
      catch {console.error('No se pudo actualizar el análisis posterior a la revisión.');}
    }
  } catch(e) {
    if(e.status===409)return true;
    try {await store.mutate(st=>failJob(st,job.id,job.leaseToken,{error:e.status?e.message:'La ejecución falló. Revisa la configuración del servidor y del respaldo.',retryAt:job.attempts<3?endClock().getTime()+300000:null,now:endClock()}),{keys:['jobs']});}
    catch(leaseError){if(leaseError.status!==409)throw leaseError;}
  }
  return true;
}

