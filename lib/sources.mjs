import { parse } from 'csv-parse/sync';
import { GoogleAuth } from 'google-auth-library';
import {googleAccount} from './google-context.mjs';

export function problem(message, status = 400) {
  return Object.assign(new Error(message), {status});
}
const folded = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const iso = d => d.toISOString().slice(0,10);
export const shiftDay = (day, delta) => iso(new Date(Date.parse(day + 'T12:00:00Z') + delta * 86400000));
export function validDay(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && iso(new Date(s)) === s;
}
export function parseCsv(csv, site) {
  if (typeof csv !== 'string' || !csv.trim() || Buffer.byteLength(csv) > 1500000) throw problem('Elige un CSV de hasta 1,5 MB.');
  const headers = {
    query: ['query','queries','top queries','consulta','consultas','consultas principales','keyword','palabra clave'],
    page: ['page','pagina','url','landing page'], date: ['date','fecha'], clicks: ['clicks','clics'],
    impressions: ['impressions','impresiones'], position: ['position','average position','posicion','posicion media'],
    country: ['country','pais'], device: ['device','dispositivo']
  };
  const keys = new Map(Object.entries(headers).flatMap(([key,names])=>names.map(name=>[name,key])));
  const firstLine = csv.split(/\r?\n/,1)[0];
  const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
  let rows;
  try {
    rows = parse(csv,{bom:true,trim:true,skip_empty_lines:true,delimiter:delim,max_record_size:24000,
      columns(names) {
        const cols = names.map(n=>keys.get(folded(n)) || false);
        if (!cols.includes('query') || new Set(cols.filter(Boolean)).size !== cols.filter(Boolean).length) throw problem('Revisa las columnas del CSV. Se requiere «Consulta» y nombres sin repetir.');
        return cols;
      }});
  } catch(e) {throw problem(e.status ? e.message : 'CSV inválido. Revisa el separador, las comillas y las columnas.');}
  if (!rows.length || rows.length > 5000) throw problem('Importa entre 1 y 5.000 filas por archivo.');
  return rows.map((r,i)=>{
    const bad = msg=>{throw problem('Fila '+(i+2)+': '+msg);};
    if (!r.query || r.query.length>400) bad('consulta vacía o demasiado larga.');
    const number = (key, integer=false)=>{
      if (!r[key]) return null;
      const n=Number(r[key].replace(',','.'));
      if (!Number.isFinite(n) || n<0 || (integer && !Number.isSafeInteger(n))) bad('métrica inválida en '+key+'.');
      return n;
    };
    const page=r.page || '';
    if (page && !inSite(page,site.url)) bad('la página debe pertenecer al sitio.');
    if (r.date && !validDay(r.date)) bad('usa fechas AAAA-MM-DD.');
    const clicks=number('clicks',true), impressions=number('impressions',true);
    if (clicks!=null && impressions!=null && clicks>impressions) bad('clics superiores a impresiones.');
    return {query:r.query,page,date:r.date||'',country:r.country||site.country,device:r.device||'',clicks,impressions,position:number('position'),source:'CSV',observed:impressions!==null||clicks!==null};
  });
}

export function inSite(candidate,scope) {
  try {
    const page=new URL(candidate),base=new URL(scope);
    return page.origin===base.origin && !page.username&&!page.password&&
      (page.pathname===base.pathname||page.pathname.startsWith(base.pathname.replace(/\/?$/, '/')));
  } catch {return false;}
}
export function propertyOf(url, value) {
  const base = new URL(url), domain=String(value||'').match(/^sc-domain:([a-z0-9.-]+)$/i)?.[1]?.toLowerCase();
  if(domain&&(base.hostname===domain||base.hostname.endsWith('.'+domain))) return 'sc-domain:'+domain;
  try { const x=new URL(value); if (inSite(base.href,x.href)&&!x.username&&!x.password&&!x.hash&&!x.search) return x.href; } catch {}
  throw problem('La propiedad de Search Console debe contener el dominio o prefijo del sitio.');
}
export function hasGsc() {return Boolean(googleAccount('gsc').raw);}
async function authorization() {
  if (!hasGsc()) throw problem('Configura la cuenta de servicio de Google en el servidor.',503);
  try {
    const credentials=JSON.parse(Buffer.from(googleAccount('gsc').raw,'base64').toString());
    return await new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/webmasters.readonly']}).getAccessToken();
  } catch {throw problem('No se pudo autenticar la cuenta de servicio de Google.',503);}
}
export async function verifyProperty(site,{token=authorization,request=fetch}={}) {
  const property=propertyOf(site.url,site.gscProperty);
  const access=await token();
  try {
    const r=await request('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(property),{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw problem('Search Console no confirmó acceso a la propiedad (HTTP '+r.status+').',400);
    const proof=await r.json();
    if(proof.siteUrl!==property||!['siteOwner','siteFullUser','siteRestrictedUser'].includes(proof.permissionLevel))throw problem('La cuenta de servicio no tiene permiso de lectura verificado para esta propiedad.',403);
    return property;
  }catch(e){if(e.status)throw e;throw problem('No se pudo verificar la conexión con Search Console.',503);}
}
export async function syncGsc(site, {now=new Date(), token=authorization, request=fetch}={}) {
  const prop=propertyOf(site.url,site.gscProperty);
  const access=await token();
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
  const parts=Object.fromEntries(today.formatToParts(now).map(p=>[p.type,p.value]));
  const end=shiftDay([parts.year,parts.month,parts.day].join('-'),-1);
  const start=site.gscUntil ? [shiftDay(site.gscUntil,-3),shiftDay(end,-27)].sort()[1] : shiftDay(end,-27);
  if(start>end)throw problem('La última sincronización no corresponde al período disponible.',400);
  // A domain property can contain several protocols, subdomains or client folders.
  // Apply the scope server-side to totals and details, then check detail URLs again.
  const base=new URL(site.url),prefix=base.origin+base.pathname.replace(/\/$/,'');
  const pattern='^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([/?]|$)';
  const filters=[{filters:[{dimension:'page',operator:'includingRegex',expression:pattern}]}];
  const deadline=AbortSignal.timeout(120000);
  const url='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(prop)+'/searchAnalytics/query';
  const query=async (dimensions,startDate,endDate,limit)=>{
    const response=await request(url,{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({startDate,endDate,dimensions,type:'web',dataState:'final',rowLimit:limit,dimensionFilterGroups:filters}),signal:AbortSignal.any([deadline,AbortSignal.timeout(15000)])});
    if(!response.ok) throw problem('Search Console respondió '+response.status+'. Comprueba permisos o cuota.',503);
    const body=await response.json();
    if(body.rows!==undefined&&!Array.isArray(body.rows))throw problem('Respuesta de Search Console inválida.',502);
    return body.rows||[];
  };
  // One bounded page per day keeps long-tail coverage explicit when capped.
  const totals=await query(['date'], start,end,100);
  const rows=[]; const capped=[];
  for(const day of totals) {
    const date=day.keys[0];
    const detail=await query(['query','page','country','device'],date,date,501);
    if(detail.length>500) capped.push(date);
    for(const r of detail.slice(0,500)) if(inSite(r.keys[1],site.url)) rows.push({date,query:r.keys[0],page:r.keys[1],country:r.keys[2],device:r.keys[3],clicks:r.clicks,impressions:r.impressions,position:r.position,source:'Search Console',observed:true});
  }
  return {start,end,rows,capped,totals:totals.map(r=>({date:r.keys[0],clicks:r.clicks,impressions:r.impressions,position:r.position}))};
}

