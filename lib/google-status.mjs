import {GoogleAuth} from 'google-auth-library';
import {googleAccount} from './google-context.mjs';
import {hasGsc,problem,propertyOf} from './sources.mjs';
import {historicalAnalytics,sameHost} from './analytics.mjs';

// Read-only by scope: this module can inspect Google's view of a site but never change it.
const scopes={search:'webmasters.readonly',tags:'tagmanager.readonly',analytics:'analytics.readonly'};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const inspectPerRun=25,gtmEveryDays=7;

function tokenFor(kind) {
  try{
    const credentials=JSON.parse(Buffer.from(googleAccount(kind==='analytics'?'ga4':'gsc').raw,'base64').toString());
    return new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/'+scopes[kind]]}).getAccessToken();
  }catch{throw problem('No se pudo autenticar la cuenta de servicio de Google.',503);}
}
async function google(url,kind,{token,request,body}) {
  let res;
  try{res=await request(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+await token(kind),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});}
  catch(e){throw e.status?e:problem('Google no respondió.',503);}
  if(!res.ok)throw problem('Google respondió HTTP '+res.status+'.',res.status);
  return res.json();
}

// Rotates through the pages: never inspected first, then the oldest. The API allows 2,000 per property per day.
export async function inspectPages(site,pages,{token,request,now,limit=inspectPerRun}) {
  const known=site.indexStatus||{};
  const queue=[...new Set(pages.filter(p=>p.status===200&&p.html!==false).map(p=>p.url))]
    .sort((a,b)=>String(known[a]?.checkedAt||'').localeCompare(String(known[b]?.checkedAt||''))).slice(0,limit);
  const results={};
  let error='';
  for(let i=0;i<queue.length&&!error;i+=4){
    await Promise.all(queue.slice(i,i+4).map(async url=>{
      try{
        const r=(await google('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect','search',{token,request,body:{inspectionUrl:url,siteUrl:site.gscProperty,languageCode:'es'}})).inspectionResult?.indexStatusResult||{};
        results[url]={verdict:r.verdict||null,coverage:r.coverageState||null,indexing:r.indexingState||null,robots:r.robotsTxtState||null,fetch:r.pageFetchState||null,
          googleCanonical:r.googleCanonical||null,userCanonical:r.userCanonical||null,lastCrawl:r.lastCrawlTime||null,checkedAt:now.toISOString()};
      }catch(e){error=e.status===429?'Search Console alcanzó su cuota de inspección.':e.message;}
    }));
  }
  return {results,error};
}

export function indexSummary(status,now) {
  const rows=Object.entries(status||{});
  const problems=rows.filter(([,r])=>r.verdict&&r.verdict!=='PASS').map(([url,r])=>({url,verdict:r.verdict,coverage:r.coverage}));
  const canonical=rows.filter(([,r])=>r.googleCanonical&&r.userCanonical&&r.googleCanonical!==r.userCanonical).map(([url,r])=>({url,googleCanonical:r.googleCanonical}));
  return {at:now.toISOString(),checked:rows.length,indexed:rows.filter(([,r])=>r.verdict==='PASS').length,problems:problems.slice(0,30),problemCount:problems.length,canonical:canonical.slice(0,10),canonicalCount:canonical.length};
}

export async function readSitemaps(site,{token,request}) {
  const data=await google('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site.gscProperty)+'/sitemaps','search',{token,request});
  return (data.sitemap||[]).slice(0,20).map(m=>({path:m.path,lastSubmitted:m.lastSubmitted||null,lastDownloaded:m.lastDownloaded||null,errors:Number(m.errors)||0,warnings:Number(m.warnings)||0,pending:Boolean(m.isPending),
    urls:(m.contents||[]).reduce((n,c)=>n+(Number(c.submitted)||0),0)}));
}

// Containers come from the IDs seen in the site's own HTML, so an account's other sites stay out of this report.
export async function readTags(site,ids,{token,request,wait=pause}) {
  const api='https://tagmanager.googleapis.com/tagmanager/v2/';
  const get=async path=>{await wait(4500);return google(api+path,'tags',{token,request});}; // ponytail: fixed pause for GTM's ~15 calls per minute, raise it on 429.
  const wanted=new Set(ids),containers=[];
  for(const account of (await get('accounts')).account||[]){
    if(!wanted.size)break;
    for(const c of (await get(account.path+'/containers')).container||[]){
      if(!wanted.has(c.publicId))continue;
      wanted.delete(c.publicId);
      const live=await get(c.path+'/versions:live');
      const tags=(live.tag||[]).map(t=>({name:t.name,type:t.type,paused:Boolean(t.paused),event:(t.parameter||[]).find(p=>p.key==='eventName')?.value||null}));
      containers.push({id:c.publicId,name:c.name,version:live.containerVersionId||null,versionName:live.name||null,tags:tags.slice(0,60),tagCount:tags.length,triggerCount:(live.trigger||[]).length});
    }
  }
  const events=new Set(containers.flatMap(c=>c.tags).filter(t=>t.event&&!t.paused).map(t=>t.event));
  let keyEvents=null;
  if(site.ga4PropertyId)keyEvents=((await google('https://analyticsadmin.googleapis.com/v1beta/properties/'+site.ga4PropertyId+'/keyEvents','analytics',{token,request})).keyEvents||[]).map(k=>k.eventName);
  // A key event outside GTM may still fire from a site snippet: this is something to check, not proof of a fault.
  // GA4 creates «purchase» by default in every property, so its absence says nothing.
  return {containers,notFound:[...wanted],keyEvents,missingKeyEvents:containers.length&&keyEvents?keyEvents.filter(k=>k!=='purchase'&&!events.has(k)):[]};
}

const onceFor=token=>{const tokens=new Map();return kind=>{if(!tokens.has(kind))tokens.set(kind,token(kind));return tokens.get(kind);};};
const attempter=errors=>async(label,work)=>{try{return await work();}catch(e){errors.push(label+': '+(e.status?e.message:'sin respuesta.'));return undefined;}};

// Everything the account can read, whatever the site.
export async function discoverGoogle({token=tokenFor,request=fetch}={}) {
  const errors=[],attempt=attempter(errors),ctx={token:onceFor(token),request};
  const gsc=await attempt('Search Console',async()=>((await google('https://www.googleapis.com/webmasters/v3/sites','search',ctx)).siteEntry||[])
    .filter(e=>['siteOwner','siteFullUser','siteRestrictedUser'].includes(e.permissionLevel)).map(e=>e.siteUrl));
  const ga4=await attempt('Google Analytics',async()=>{
    const admin='https://analyticsadmin.googleapis.com/v1beta/',properties=[];
    let page='';
    do{
      const data=await google(admin+'accountSummaries?pageSize=200'+(page?'&pageToken='+encodeURIComponent(page):''),'analytics',ctx);
      properties.push(...(data.accountSummaries||[]).flatMap(a=>a.propertySummaries||[]));
      page=data.nextPageToken;
    }while(page);
    return Promise.all(properties.map(async p=>{
      const id=p.property.split('/')[1];
      const streams=((await google(admin+'properties/'+id+'/dataStreams?pageSize=200','analytics',ctx)).dataStreams||[])
        .filter(s=>s.type==='WEB_DATA_STREAM'&&/\/dataStreams\/[1-9]\d{0,19}$/.test(s.name)).map(s=>({id:s.name.split('/').pop(),uri:s.webStreamData?.defaultUri}));
      return {id,name:p.displayName,streams};
    }));
  });
  const gtm=await attempt('Tag Manager',async()=>{
    const api='https://tagmanager.googleapis.com/tagmanager/v2/',found=[];
    // ponytail: no pause, so more than ~14 accounts can hit GTM's ~15 calls per minute. Add readTags' wait if that happens.
    for(const a of (await google(api+'accounts','tags',ctx)).account||[])found.push(...((await google(api+a.path+'/containers','tags',ctx)).container||[]).map(c=>({id:c.publicId,name:c.name})));
    return found;
  });
  return {gsc,ga4,gtm,errors};
}

// The narrowest Search Console property wins. A stream is only taken when it is the only one for that host.
export function matchSite(site,{gsc,ga4}) {
  const fits=(gsc||[]).flatMap(p=>{try{return [propertyOf(site.url,p)];}catch{return [];}});
  const gscProperty=fits.sort((a,b)=>a.startsWith('sc-domain:')-b.startsWith('sc-domain:')||b.length-a.length)[0]||null;
  const streams=new URL(site.url).pathname!=='/'?[]:(ga4||[]).flatMap(p=>p.streams.filter(s=>sameHost(s.uri,site.url)).map(s=>({propertyId:p.id,streamId:s.id})));
  return {gscProperty,stream:streams.length===1?streams[0]:null,ambiguous:streams.length>1?streams.map(s=>s.propertyId):[]};
}

// Only fills what is empty: a property someone already linked is never replaced.
export async function linkDiscovered(sites,found,transport) {
  return Promise.all(sites.map(async site=>{
    const match=matchSite(site,found),change={};
    if(!site.gscProperty&&match.gscProperty)change.gscProperty=match.gscProperty;
    if(!site.ga4PropertyId&&match.stream){
      change.ga4PropertyId=match.stream.propertyId;change.ga4StreamId=match.stream.streamId;
      // The daily review retries the history, so a quota here must not lose the link.
      try{Object.assign(change,await historicalAnalytics({...site,...change},transport));}catch{}
    }
    return {id:site.id,name:site.name,url:site.url,gsc:change.gscProperty||site.gscProperty||null,ga4:change.ga4PropertyId||site.ga4PropertyId||null,ambiguous:site.ga4PropertyId?[]:match.ambiguous,change};
  }));
}

// Each source fails on its own: a quota in one must not lose the others, nor the review.
export async function googleStatus(site,pages,{now=new Date(),token=tokenFor,request=fetch,wait}={}) {
  if(!hasGsc()&&token===tokenFor)return null;
  const out={},errors=[],attempt=attempter(errors),ctx={token:onceFor(token),request,now,wait};
  if(site.gscProperty){
    const inspected=await attempt('Indexación',()=>inspectPages(site,pages,ctx));
    if(inspected){out.indexed=inspected.results;if(inspected.error)errors.push('Indexación: '+inspected.error);}
    out.sitemaps=await attempt('Sitemaps',()=>readSitemaps(site,ctx));
  }
  const due=!site.gtm?.at||(now-new Date(site.gtm.at))/86400000>=gtmEveryDays;
  const ids=[...new Set(pages.flatMap(p=>p.gtmIds||[]))];
  if(due&&ids.length){
    const tags=await attempt('Etiquetas',()=>readTags(site,ids,ctx));
    if(tags)out.gtm={...tags,at:now.toISOString()};
  }
  return {...out,errors};
}
