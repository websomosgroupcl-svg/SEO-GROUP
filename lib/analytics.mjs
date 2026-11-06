import {GoogleAuth} from 'google-auth-library';
import {googleAccount} from './google-context.mjs';
import {problem,shiftDay,validDay} from './sources.mjs';

const urlFor=(id,method)=>'https://analyticsdata.googleapis.com/v1beta/properties/'+id+':'+method;
const localDate=(date,tz='America/Santiago')=>new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const idOK=x=>/^[1-9]\d{0,19}$/.test(String(x));
const exact=(fieldName,value)=>({filter:{fieldName,stringFilter:{matchType:'EXACT',value}}});
const metric=(name)=>({name});
// A GA4 stream often keeps the bare domain while the site answers on www, or the other way round.
export const sameHost=(a,b)=>{const bare=u=>new URL(u).hostname.replace(/^www\./,'');try{return bare(a)===bare(b);}catch{return false;}};
const aiSources='chatgpt\\.com|openai\\.com|perplexity|gemini\\.google\\.com|claude\\.ai|copilot\\.microsoft\\.com|meta\\.ai|grok\\.com|deepseek\\.com';
async function accessToken(){
  const raw=googleAccount('ga4').raw;
  if(!raw)throw problem('El administrador debe configurar la cuenta de servicio y darle acceso de lectura a GA4.',409);
  try{return await new GoogleAuth({credentials:JSON.parse(Buffer.from(raw,'base64').toString()),scopes:['https://www.googleapis.com/auth/analytics.readonly']}).getAccessToken();}
  catch{throw problem('No se pudo autenticar la cuenta de servicio de Analytics.',503);}
}
async function google(url,body,token,request){
  let response;
  try{response=await request(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(12000)});}
  catch{throw problem('Analytics no respondió. Vuelve a intentar en unos minutos.',503);}
  if(!response.ok)throw problem(response.status===429?'Google Analytics alcanzó su cuota temporal.':'Analytics respondió '+response.status+'. Comprueba la propiedad, el acceso de lectura y las APIs habilitadas.',response.status===429?429:502);
  return response.json();
}
export async function identifyStream(site,id,{token=accessToken,request=fetch,strictOrigin=false}={}){
  if(!idOK(id))throw problem('Introduce el ID numérico de propiedad GA4.');
  const base=new URL(site.url);
  if(base.pathname!=='/')throw problem('El informe en vivo mide un flujo web completo. Conecta GA4 desde un sitio registrado en la raíz del dominio.');
  const key=await token();
  const result=await google('https://analyticsadmin.googleapis.com/v1beta/properties/'+id+'/dataStreams?pageSize=200',null,key,request);
  const matches=(result.dataStreams||[]).filter(s=>s.type==='WEB_DATA_STREAM'&&sameHost(s.webStreamData?.defaultUri,base.href));
  if(matches.length!==1||result.nextPageToken)throw problem('Se necesita un único flujo web identificable para este dominio en la propiedad. Comprueba la URL predeterminada y los flujos en Analytics.');
  const match=matches[0];
  if(strictOrigin&&new URL(match.webStreamData.defaultUri).href!==base.origin+'/')
    throw problem('La URL predeterminada de este flujo debe coincidir con la raíz exacta del sitio, incluido el protocolo y el puerto.');
  const resource=typeof match.name==='string'&&/^properties\/([1-9]\d{0,19})\/dataStreams\/([1-9]\d{0,19})$/.exec(match.name);
  if(!resource||resource[1]!==String(id))throw problem('El flujo web devuelto por Analytics no corresponde a la propiedad solicitada.');
  const stream=resource[2];
  return {ga4PropertyId:String(id),ga4StreamId:stream};
}
export async function historicalAnalytics(site,{now=new Date(),token=accessToken,request=fetch}={}){
  const key=await token(), url=urlFor(site.ga4PropertyId,'runReport');
  const common={dimensionFilter:{andGroup:{expressions:[exact('streamId',site.ga4StreamId),exact('hostName',new URL(site.url).hostname)]}},returnPropertyQuota:true};
  const report=(dimension,names,days,limit,extra={})=>google(url,{...common,dimensions:[metric(dimension)],metrics:names.map(metric),dateRanges:[{startDate:days+'daysAgo',endDate:'yesterday'}],limit:String(limit),...extra},key,request);
  const [daily,landing,fromAi]=await Promise.all([report('date',['sessions','activeUsers','keyEvents'],180,180),report('landingPage',['sessions','keyEvents'],28,250,{orderBys:[{metric:{metricName:'sessions'},desc:true}]}),
    report('date',['sessions'],180,2000,{dimensions:[metric('date'),metric('sessionSource')],dimensionFilter:{andGroup:{expressions:[...common.dimensionFilter.andGroup.expressions,{filter:{fieldName:'sessionSource',stringFilter:{matchType:'PARTIAL_REGEXP',value:aiSources}}}]}}})]);
  const dayOf = r=>r.dimensionValues[0].value.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  const num=(r,i)=>Math.max(0,Number(r.metricValues?.[i]?.value)||0);
  const end=shiftDay(localDate(now,landing.metadata?.timeZone||daily.metadata?.timeZone||'America/Santiago'),-1);
  return {
    analyticsDays:(daily.rows||[]).map(r=>({date:dayOf(r),sessions:num(r,0),activeUsers:num(r,1),keyEvents:num(r,2)})).filter(r=>validDay(r.date)).sort((a,b)=>a.date.localeCompare(b.date)),
    ga4Landing:(landing.rows||[]).filter(r=>/^\/(?!\/)/.test(r.dimensionValues[0].value)).map(r=>({path:r.dimensionValues[0].value,sessions:num(r,0),keyEvents:num(r,1),startDate:shiftDay(end,-27),endDate:end,window:'Últimos 28 días completos de GA4'})),
    ga4AiDays:(fromAi.rows||[]).map(r=>({date:dayOf(r),source:r.dimensionValues[1]?.value||'',sessions:num(r,0)})).filter(r=>validDay(r.date)&&r.source),
    ga4UpdatedAt:now.toISOString(),ga4LastError:null
  };
}
const liveCache=new Map();
export async function liveAnalytics(site,{now=new Date(),token=accessToken,request=fetch}={}){
  const empty={windowMinutes:30,updatedAt:null,activeUsers:null,views:null,keyEvents:null,series:[]};
  if(site.demo){
    const series=Array.from({length:30},(_,i)=>({minutesAgo:29-i,views:[0,1,3,2,7,1,0,2,1,2][i%10]}));
    return {...empty,status:'demo',updatedAt:now.toISOString(),activeUsers:19,views:series.reduce((a,v)=>a+v.views,0),keyEvents:2,series,message:'Ejemplo ilustrativo de 30 minutos. Los valores son ficticios.'};
  }
  if(site.ga4LiveReviewRequired===true)return {...empty,status:'unavailable',message:'El historial se filtra al dominio. Para mostrar la actividad en vivo, el administrador debe confirmar que el flujo solo mide este sitio.'};
  if(!site.ga4PropertyId||!site.ga4StreamId)return {...empty,status:'unconnected',message:'Conecta el flujo web de Google Analytics 4 en Configuración para ver actividad reciente.'};
  const cacheKey=[site.id,site.ga4PropertyId,site.ga4StreamId].join('/');
  const cached=liveCache.get(cacheKey);if(cached&&cached.until>now.getTime())return cached.report;
  const report=(async()=>{
    try{
      const key=await token(),url=urlFor(site.ga4PropertyId,'runRealtimeReport');
      const common={dimensionFilter:exact('streamId',site.ga4StreamId),minuteRanges:[{startMinutesAgo:29,endMinutesAgo:0}]};
      const [summary,minutes]=await Promise.all([google(url,{...common,metrics:['activeUsers','screenPageViews','keyEvents'].map(metric)},key,request),google(url,{...common,dimensions:[metric('minutesAgo')],metrics:[metric('screenPageViews')]},key,request)]);
      const values=summary.rows?.[0]?.metricValues||[];
      const rows=new Map((minutes.rows||[]).map(r=>[Number(r.dimensionValues[0].value),Number(r.metricValues[0].value)]));
      const thresholded=Boolean(summary.metadata?.subjectToThresholding||minutes.metadata?.subjectToThresholding);
      const total=i=>values[i] ? Number(values[i].value) : (thresholded ? null : 0);
      return {...empty,status:'live',updatedAt:now.toISOString(),activeUsers:total(0),views:total(1),keyEvents:total(2),series:Array.from({length:30},(_,i)=>({minutesAgo:29-i,views:rows.get(29-i)??(thresholded?null:0)})),message:thresholded?'GA4 aplica umbrales de privacidad. Algunos valores pueden estar omitidos.':'Últimos 30 minutos del flujo web vinculado. Las vistas incluyen repeticiones.'};
    }catch(e){return {...empty,status:'unavailable',message:e.status?e.message:'No se pudo consultar GA4.'};}
  })();
  liveCache.set(cacheKey,{until:now.getTime()+60000,report});
  return report;
}
// Fill example sources only inside an explicitly fictional demo, including existing local demo sessions.
export function metricsInput(site,now=new Date()){
  if(!site.demo)return site;
  const day=localDate(now);
  const analyticsDays=Array.from({length:90},(_,i)=>{
    const sessions=68+Math.round(10*Math.cos(i*0.9))+Math.floor(i/5)+(i===77?55:0)-(i===68?31:0);
    return {date:shiftDay(day,i-90),sessions,activeUsers:Math.round(sessions*.8),keyEvents:Math.round(sessions/16)};
  });
  const examples=['Gemini','ChatGPT','Perplexity','Gemini','ChatGPT','Perplexity'].map((engine,i)=>({engine,date:shiftDay(day,-3-i*3),prompt:'¿Dónde encontrar muebles de madera para una cocina pequeña?',mentioned:i%3!==1,cited:i%3===0,citedUrl:i%3===0?site.url+'mesas-plegables':'',demo:true}));
  return {...site,analyticsDays,aiObservations:[...examples,...(site.aiObservations||[])]};
}

