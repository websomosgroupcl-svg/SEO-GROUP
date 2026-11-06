import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import ipaddr from 'ipaddr.js';

const BOT = 'SEOBestia';
const AGENT = 'SEOBestia/1.0';
const LIMIT = 1_000_000;
const BINARY = /\.(?:pdf|png|jpe?g|webp|gif|svg|ico|zip|gz|css|js|mp[34]|woff2?|xml|xlsx?)$/i;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
const bound = (s,n) => clean(s).slice(0,n);

export function publicAddress(address) {
  if (!ipaddr.isValid(address)) return false;
  const addr = ipaddr.process(address);
  if (addr.range() !== 'unicast') return false;
  if (addr.kind() === 'ipv6') {
    // Only globally routable IPv6. Exclude transition mechanisms mapped into other networks.
    return addr.match(ipaddr.parseCIDR('2000::/3')) && !addr.match(ipaddr.parseCIDR('2001::/23')) && !addr.match(ipaddr.parseCIDR('2002::/16'));
  }
  return !addr.match(ipaddr.parseCIDR('192.0.0.0/24')) && !addr.match(ipaddr.parseCIDR('192.88.99.0/24'));
}

export function siteURL(input) {
  const u = new URL(input);
  const host = u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port || (!isIP(host) && (!host.includes('.') || /\.(?:local|internal|localhost|test|invalid|onion)\.?$/i.test(host))) || (isIP(host) && !publicAddress(host))) throw Error('Dirección fuera del alcance permitido.');
  u.hash = '';
  if (u.href.length > 2048) throw Error('URL demasiado extensa.');
  return u;
}

function scoped(input, base, origin) {
  try {
    const u = siteURL(new URL(input,base));
    return u.origin === origin ? u.href : null;
  } catch { return null; }
}

export async function publicGet(input) {
  const url = siteURL(input);
  const hostname = url.hostname.replace(/^\[|\]$/g,'');
  // Pin the socket to a checked DNS result. Passing the hostname to fetch after this check
  // would cause a second lookup and allow a rebinding race.
  const addresses = isIP(hostname) ? [{address:hostname, family:isIP(hostname)}] : await lookup(hostname,{all:true,verbatim:true});
  if (!addresses.length || addresses.some(({address})=>!publicAddress(address))) throw Error('El destino no tiene exclusivamente direcciones públicas.');
  const chosen = addresses.find(a=>a.family===4) ?? addresses[0];
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve,reject) => {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 9000);
    const req = client.request(url, { method:'GET', agent:false, signal:controller.signal, autoSelectFamily:false, family:chosen.family,
      lookup(_name,opts,cb) { opts.all ? cb(null,[chosen]) : cb(null,chosen.address,chosen.family); },
      headers:{'user-agent':AGENT,'accept':'text/html, application/xhtml+xml, application/xml, text/plain;q=0.9','accept-encoding':'identity'} },
    res => {
      const headers = res.headers, status = Number(res.statusCode);
      let size = 0;
      const chunks = [];
      res.on('error',reject);
      if (status >= 300 && status < 400) { resolve({status,headers,body:''}); res.destroy(); return; }
      if (Number(headers['content-length']) > LIMIT) { req.destroy(Error('La respuesta supera 1 MB.')); return; }
      res.on('data', chunk => {
        size += chunk.length;
        if (size > LIMIT) req.destroy(Error('La respuesta supera 1 MB.'));
        else chunks.push(chunk);
      });
      res.on('end',()=>resolve({status,headers,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);
    req.on('close',()=>clearTimeout(timer));
    req.end();
  });
}

function robotsTokens(text) { return /(?:^|[\s,;:])(?:noindex|none)(?:[\s,;]|$)/i.test(text); }

// HTML textContent omits <br> and joins adjacent paragraphs. Recover explicit
// layout boundaries without inserting spaces around inline emphasis or links.
const blockTags = new Set('address article aside blockquote br dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main nav ol p pre section summary table tbody td th tr ul'.split(' '));
function pageText(root) {
  if (!root) return '';
  const stack=[root],chunks=[];
  while (stack.length) {
    const node=stack.pop();
    if(node===null){chunks.push(' '); continue;}
    if(node.type==='text'){chunks.push(node.data); continue;}
    if(!node.children || ['script','style','template','noscript'].includes(node.name))continue;
    const display=node.attribs?.style?.match(/(?:^|;)\s*display\s*:\s*([\w-]+)/i)?.[1]?.toLowerCase();
    if(display==='none'||node.attribs?.hidden!==undefined)continue;
    const boundary=display ? ['block','flex','grid','list-item','table-row','flow-root'].includes(display) : blockTags.has(node.name);
    if(boundary){chunks.push(' ');stack.push(null);}
    for(let i=node.children.length-1;i>=0;i--)stack.push(node.children[i]);
  }
  return clean(chunks.join(''));
}

export function extractPage(html,url,status=200,headers={}) {
  const $ = cheerio.load(html);
  const meta = name => $('meta[name]').filter((_,n)=>String($(n).attr('name')).toLowerCase()===name).map((_,n)=>$(n).attr('content')||'').get().join(', ');
  const robots = [meta('robots'),meta('googlebot'),String(headers['x-robots-tag']||'')].join(', ');
  const nofollow = /(?:^|[\s,;:])(?:nofollow|none)(?:[\s,;]|$)/i.test(robots);
  const origin = new URL(url).origin;
  const base = (()=>{try{return new URL($('base[href]').first().attr('href')||url,url).href;}catch{return url;}})();
  const links = new Set();
  const resolveUrl=raw=>{try{if(!raw)return null;const u=new URL(raw,base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>2048)return null;u.hash='';return u.href;}catch{return null;}};
  const outgoing=[],unique=new Set();
  for(const node of $('a[href]').toArray()){
    const a=$(node),target=resolveUrl(a.attr('href'));
    if(!target||unique.has(target))continue;
    if(outgoing.length>=160)break;
    unique.add(target);outgoing.push({url:target,anchor:bound(pageText(node),100),internal:new URL(target).origin===origin,nofollow:nofollow||/\bnofollow\b/i.test(a.attr('rel')||'')});
  }
  if (!nofollow) $('a[href]').each((_,n)=>{
    if (links.size >= 160 || /\bnofollow\b/i.test($(n).attr('rel')||'')) return;
    const href = scoped($(n).attr('href'),base,origin);
    if (href && !BINARY.test(new URL(href).pathname)) links.add(href);
  });
  const rawCanonical = $('link[rel]').filter((_,n)=>String($(n).attr('rel')).toLowerCase().split(/\s+/).includes('canonical')).first().attr('href');
  let canonical = null;
  if (rawCanonical) { try {canonical = new URL(rawCanonical,base).href;} catch {canonical=rawCanonical.slice(0,300);} }
  const headings = $('h1').map((_,n)=>bound(pageText(n),240)).get();
  const h2 = $('h2').map((_,n)=>bound(pageText(n),240)).get().slice(0,25);
  const imageCount = $('img').length;
  const missingAlt = $('img:not([alt])').length;
  const images=$('img').slice(0,24).map((_,n)=>({url:resolveUrl($(n).attr('src'))||'',alt:$(n).attr('alt')==null?null:bound($(n).attr('alt'),140)})).get();
  const headingList=$('h1,h2,h3,h4,h5,h6').slice(0,40).map((_,n)=>({level:Number(n.name.slice(1)),text:bound(pageText(n),240)})).get();
  const alternates=$('link[hreflang]').filter((_,n)=>String($(n).attr('rel')).toLowerCase().split(/\s+/).includes('alternate'));
  const hreflang=alternates.slice(0,40).map((_,n)=>({lang:bound($(n).attr('hreflang'),64),url:resolveUrl($(n).attr('href'))||null})).get();
  const jsonld=$('script[type="application/ld+json"]'), types=new Set();let invalid=0;
  jsonld.slice(0,20).each((_,el)=>{
    try{
      const data=JSON.parse($(el).text());
      if(!data||typeof data!=='object'){invalid++;return;}
      const items=Array.isArray(data)?data:[data];
      for(const obj of items.flatMap(x=>[x,...(Array.isArray(x?.['@graph'])?x['@graph']:[])])){
        for(const type of [obj?.['@type']].flat())if(typeof type==='string'&&types.size<30)types.add(bound(type,100));
      }
    }catch{invalid++;}
  });
  const schema={count:jsonld.length,tested:Math.min(20,jsonld.length),invalid,types:[...types]};
  const canonicals=$('link[rel]').filter((_,n)=>String($(n).attr('rel')).toLowerCase().split(/\s+/).includes('canonical')).length;
  $('script,style,noscript,template,nav,footer,header').remove();
  const content=$('main,article').first().length ? $('main,article').first() : $('body');
  const main=pageText(content.get(0));
  // Preserve the existing fingerprint of the site's source so an extractor
  // upgrade alone does not open a false content-change alert.
  const sourceText=clean(content.text());
  return {url,status,html:true,title:bound($('title').first().text(),350),description:bound(meta('description'),600),
    h1:headings[0]||'',h1Count:headings.length,h2,canonical,noindex:robotsTokens(robots),robots:bound(robots,180),
    imageCount,missingAlt,viewport:Boolean(meta('viewport')),gtmIds:[...new Set(String(html).match(/\bGTM-[A-Z0-9]{4,12}\b/g)||[])].slice(0,5),wordCount:main ? main.split(' ').length : 0,contentHash:createHash('sha256').update(sourceText).digest('hex'),
    keywordExcerpts:$('main p,article p').slice(0,8).map((_,n)=>bound(pageText(n),320)).get().filter(Boolean),
    links:[...links],outgoing,images,headings:headingList,hreflang,schema,canonicals,lang:bound($('html').attr('lang'),64),metaRobots:bound([meta('robots'),meta('googlebot')].filter(Boolean).join(', '),180),
    headerRobots:bound(headers['x-robots-tag'],180),contentType:String(headers['content-type']||'text/html').split(';')[0],
    sampleLimits:{links:160,images:24,headings:40,hreflang:40,jsonld:20,linksMayBePartial:outgoing.length===160,hreflangPartial:alternates.length>40}};
}

// An authorized site may answer on the www or HTTPS variant of its own host. Other hosts stay out of scope.
const bareHost=u=>u.hostname.replace(/^www\./,'');
const sameSiteVariant=(from,to)=>bareHost(from)===bareHost(to)&&(to.protocol==='https:'||from.protocol==='http:');
class OriginMoved extends Error { constructor(target){super('La web responde en otra variante.');this.target=target;} }

export async function crawlSite(site,options={}) {
  if (site?.authorized !== true) throw Error('El rastreo requiere autorización del sitio.');
  const started=Date.now(), budget=Math.min(120_000,Number(options.timeBudgetMs)||90_000);
  let home=siteURL(site.url), current=options;
  // http://a.cl can need two moves: first to https://a.cl and then to https://www.a.cl.
  for(let moves=0;;moves++) {
    try {
      const result=await crawlFrom(home,current,moves<2);
      return moves?{...result,home:home.href}:result;
    } catch(e) {
      if(!(e instanceof OriginMoved))throw e;
      const next=new URL(home); next.protocol=e.target.protocol; next.host=e.target.host;
      const rebase=value=>{try{const u=new URL(value);if(u.origin!==home.origin)return value;u.protocol=next.protocol;u.host=next.host;return u.href;}catch{return value;}};
      current={...current,timeBudgetMs:Math.max(1,budget-(Date.now()-started)),priorityUrls:current.priorityUrls?.map(rebase),
        cursor:current.cursor&&{...current.cursor,queue:(current.cursor.queue||[]).map(rebase),visited:(current.cursor.visited||[]).map(rebase)}};
      home=next;
    }
  }
}

async function crawlFrom(home,options,canMove) {
  const origin = home.origin;
  const inPath=href=>{
    const path=new URL(href).pathname;
    // Servers may decode a path more than once before routing. Reject ambiguous encoded
    // separators and percent escapes before testing the authorized directory boundary.
    if(/%(?:2f|5c|25)/i.test(path))return false;
    return path===home.pathname||path.startsWith(home.pathname.replace(/\/?$/,'/'));
  };
  const get = options.request || publicGet;
  const wait = options.wait || pause;
  const maxPages = Math.max(1,Math.min(100,Number(options.maxPages)||30));
  const deadline = Date.now() + Math.min(120_000,Number(options.timeBudgetMs)||90_000);
  const pages=[], errors=[], skipped=[], seen=new Set((options.cursor?.visited||[]).slice(0,500)), queue=[], queued=new Set();
  let robotsBlocked=0, delay=500, last=0, policy=null, deferred=false, truncated=false;
  const report = (url,message)=>{if(errors.length<100) errors.push({url,message});};
  function add(value,base=home.href) {
    const href = scoped(value,base,origin);
    if (!href || !inPath(href) || BINARY.test(new URL(href).pathname) || seen.has(href) || queued.has(href)) return;
    if (seen.size+queue.length>=500) {truncated=true;return;}
    queue.push(href); queued.add(href);
  }
  const allowed = href=>policy?.isAllowed(href,BOT)!==false;
  async function request(start,obey=true,page=false) {
    let url = start;const redirects=[],began=Date.now();
    for(let hop=0;hop<=4;hop++) {
      if(obey&&!allowed(url)) throw Error('Ruta excluida por robots.txt.');
      if(Date.now()+Math.max(0,last+delay-Date.now())>=deadline) {deferred=true;throw Error('Lote pendiente por tiempo de revisión.');}
      await wait(Math.max(0,last+delay-Date.now())); last=Date.now();
      const r=await get(url);
      if (![301,302,303,307,308].includes(r.status)) return {...r,url,redirects,elapsedMs:Date.now()-began};
      if (!r.headers.location) throw Error('Redirección sin destino.');
      const to=scoped(r.headers.location,url,origin);
      if(!to){
        let target=null;
        try{target=siteURL(new URL(r.headers.location,url));}catch{}
        if(target&&canMove&&!pages.length&&(page||start===robotsUrl)&&sameSiteVariant(home,target))throw new OriginMoved(target);
        throw Error(target?'La web redirige a '+target.origin+'. Usa esa dirección si también está autorizada.':'Redirección fuera del sitio autorizado.');
      }
      redirects.push({url,status:r.status,to});url=to;
      if(page&&!inPath(url)) throw Error('Redirección fuera del sitio autorizado.');
    }
    throw Error('Demasiadas redirecciones.');
  }
  const checkedAt = new Date().toISOString();
  const robotsUrl=origin+'/robots.txt', notes=[];
  try {
    const r=await request(robotsUrl,false);
    // RFC 9309: a 4xx means no rules apply. A 429 or 5xx still stops the crawl.
    const unavailable=r.status>=400&&r.status<500&&r.status!==429;
    if (!unavailable && !(r.status>=200 && r.status<300)) throw Error('robots.txt no disponible (HTTP '+r.status+').');
    if (unavailable && ![404,410].includes(r.status)) notes.push('robots.txt respondió HTTP '+r.status+', posible bloqueo del rastreador. Se revisó sin sus reglas. Si las páginas también responden con error, permite el acceso a SEOBestia antes de interpretar la nota.');
    policy=robotsParser(robotsUrl,r.status===200?r.body:'');
    const crawlDelay=Number(policy.getCrawlDelay(BOT));
    if(crawlDelay>60) throw Error('La pausa solicitada por robots.txt supera la ventana del piloto.');
    delay=Math.max(delay,(crawlDelay||0)*1000);
  } catch(e) {
    if(e instanceof OriginMoved)throw e;
    report(robotsUrl,e.message);
    return {checkedAt,pages,errors,skipped,robotsBlocked,complete:false,cursor:options.cursor||null};
  }
  if(options.cursor?.queue?.length) for(const value of options.cursor.queue) add(value);
  else {
    for(const value of (options.priorityUrls||[]).slice(0,80)) add(value);
    add(home.href);
    const maps = [...new Set([...policy.getSitemaps(), origin+'/sitemap.xml'])];
    for(let i=0;i<maps.length&&i<4&&!deferred;i++) {
      const loc=scoped(maps[i],home.href,origin);
      if(!loc||!allowed(loc)) continue;
      try {
        const r=await request(loc); if([404,410].includes(r.status))continue;
        if (r.status!==200) {report(loc,'Sitemap HTTP '+r.status);continue;}
        const $=cheerio.load(r.body,{xmlMode:true});
        if($('sitemapindex').length) $('sitemap > loc').slice(0,3).each((_,n)=>maps.push(clean($(n).text())));
        else $('url > loc').slice(0,501).each((_,n)=>add(clean($(n).text()),r.url));
      } catch(e){if(!deferred) report(loc,e.message);}
    }
  }
  let attempted=0;
  while(queue.length && attempted<maxPages && !deferred && Date.now()<deadline){
    const target=queue.shift(); queued.delete(target);
    if(seen.has(target)) continue;
    if(!allowed(target)){robotsBlocked++; skipped.push(target);seen.add(target);continue;}
    attempted++;
    try {
      const r=await request(target,true,true);
      const html=/text\/html|application\/xhtml\+xml/i.test(String(r.headers['content-type']||''));
      const page = html ? extractPage(r.body,r.url,r.status,r.headers) : {url:r.url,status:r.status,html:false,links:[]};
      page.links=page.links.filter(inPath);
      if(page.outgoing)page.outgoing=page.outgoing.filter(e=>!e.internal||inPath(e.url));
      page.redirects=r.redirects;page.elapsedMs=r.elapsedMs;page.bytes=Buffer.byteLength(r.body||'');page.contentType=String(r.headers['content-type']||'').split(';')[0]||null;
      if(r.url!==target) page.requestedUrl=target;
      pages.push(page); seen.add(r.url);seen.add(target);
      if(r.status===200) for(const l of page.links) add(l);
    } catch(e) {
      if(e instanceof OriginMoved)throw e;
      if(deferred){queue.unshift(target);break;}
      report(target,e.message);seen.add(target);
    }
  }
  return {checkedAt,pages,errors,skipped,robotsBlocked,truncated,notes,complete:!queue.length&&!errors.length&&!truncated,
    cursor:queue.length?{queue,visited:[...seen].slice(0,500)}:null};
}
