const escapeHtml=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
const number=new Intl.NumberFormat('es-CL',{maximumFractionDigits:1});
const n=v=>Number.isFinite(v)?number.format(v):'Sin dato';
const dates=(a,b)=>a&&b&&a!==b?a+' a '+b:a||b||'Período sin informar';
const meta=v=>'<p class="meta">'+escapeHtml(v)+'</p>';
function csvCell(value){
  let text=String(value??'');
  if(/^\s*[=+@-]/u.test(text)||/^[\r\n\t]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
function download(report){
  const rows=[['Sección','Fuente','Sitio o página','Asunto','Métrica o evidencia','Valor o recomendación','Desde','Hasta','País','Dispositivo']];
  for(const s of report.sources)rows.push(['Fuente',s.name,report.url,'',s.unit,s.count]);
  if(report.technical){
    const t=report.technical;
    rows.push(['Salud técnica',report.demo?'Ejemplo':'Rastreo HTML',report.url,'','Puntos sobre 100',t.score]);
    for(const p of t.pages)rows.push(['Página','HTML',p.url,p.title,'HTTP',p.status]);
    for(const i of t.issues)rows.push(['Problema técnico','HTML',i.url,i.title,i.evidence,i.fix]);
    for(const err of t.errors)rows.push(['Error','Rastreo',err.url,'',err.message]);
    for(const url of t.blocked)rows.push(['Bloqueada','robots.txt',url]);
  }
  for(const k of report.keywords){
    for(const [name,value] of [['Clics',k.clicks],['Impresiones',k.impressions],['CTR (%)',k.ctr==null?null:Number((k.ctr*100).toFixed(2))],['Posición media',k.position],['Acción',k.action],['Long-tail',k.longTail?'Sí':'No']]){
      rows.push(['Consulta',k.source,k.page,k.keyword,name,value,k.start,k.end,k.country,k.device]);
    }
  }
  for(const g of report.gaps)rows.push(['Contenido por contrastar',g.source,g.page,g.keyword,g.evidence,g.next,g.start,g.end,g.country,g.device]);
  for(const p of report.analytics.rows)for(const [name,value] of [['Sesiones',p.sessions],['Eventos clave',p.keyEvents]])rows.push(['Página de entrada',report.demo?'Ejemplo de GA4':'CSV de GA4',p.path,'',name,value,p.date||report.analytics.period.start,p.date||report.analytics.period.end]);
  for(const text of report.limitations)rows.push(['Alcance','','','',text]);
  const csv=rows.map(row=>Array.from({length:10},(_,i)=>csvCell(row[i])).join(';')).join('\r\n');
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
  a.href=url;a.download=(report.demo?'ejemplo-':'')+'diagnostico-'+report.generatedAt.slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function technical(t){
  if(!t)return meta('Añade una URL autorizada para comprobar el estado técnico.');
  const issues=t.issues.map(i=>'<li><strong>'+escapeHtml(i.title)+'</strong> · Prioridad '+escapeHtml(i.severity)+'<small>'+escapeHtml(i.url)+'</small><p>'+escapeHtml(i.evidence)+'</p><p><b>Qué hacer</b> · '+escapeHtml(i.fix)+'</p></li>').join('');
  return '<p><b>'+n(t.coverage.pages)+' páginas revisadas</b> · '+n(t.coverage.checked)+' controles evaluados · '+(t.coverage.partial?'Muestra parcial':'Muestra completa dentro del alcance')+'</p>'+
    (issues?'<ol class="diag-items">'+issues+'</ol>':meta(t.coverage.checked?'Sin problemas detectados en los controles evaluados.':'Sin controles evaluables. Revisa los errores y la cobertura.'))+
    (t.issueCount>t.issues.length?meta('Mostrando '+t.issues.length+' de '+t.issueCount+' problemas.'):'')+
    (t.pages.length?'<details><summary>Ver las '+n(t.pages.length)+' páginas revisadas</summary><ul class="diag-items">'+t.pages.map(p=>'<li><b>'+escapeHtml(p.title||p.url)+'</b><small>HTTP '+n(p.status)+' · '+escapeHtml(p.url)+'</small></li>').join('')+'</ul></details>':'')+
    (t.errors.length?'<h4>Errores del rastreo</h4><ul class="diag-items">'+t.errors.map(err=>'<li>'+escapeHtml(err.message)+'<small>'+escapeHtml(err.url)+'</small></li>').join('')+'</ul>':'')+
    (t.blocked.length?'<h4>Exclusiones por robots.txt</h4><ul class="diag-items">'+t.blocked.map(url=>'<li>'+escapeHtml(url)+'</li>').join('')+'</ul>':'');
}
function keywords(report){
  const rows=report.keywords.slice(0,80);
  if(!rows.length)return meta('Adjunta el CSV de consultas de Search Console para ver las búsquedas y su rendimiento.');
  return meta('Se muestran '+rows.length+' de '+report.counts.keywords+' consultas o desgloses del archivo. Las impresiones miden cuántas veces apareció el sitio.')+
    '<ul class="diag-items">'+rows.map(k=>'<li><strong>'+escapeHtml(k.keyword)+'</strong> <span class="badge">'+(k.longTail?'Long-tail':'Keyword')+'</span><small>'+escapeHtml([k.source,dates(k.start,k.end),k.country,k.device].filter(Boolean).join(' · '))+'</small><p>'+[
      'Clics · '+n(k.clicks),'Impresiones · '+n(k.impressions),'CTR · '+(k.ctr==null?'Sin dato':n(k.ctr*100)+' %'),'Posición media · '+n(k.position)].join(' &nbsp; ')+'</p><small>'+escapeHtml(k.page||'URL sin desglosar')+'</small><p><b>'+escapeHtml(k.action)+'</b> · '+escapeHtml(k.reason)+'</p></li>').join('')+'</ul>';
}
function ga(report){
  const a={...report.analytics,rows:report.analytics.rows.slice(0,80)};
  if(!a.rows.length)return meta('Se necesitan filas con una página de entrada para mostrar sesiones o eventos.');
  return meta('Se muestran '+a.rows.length+' de '+report.counts.landings+' filas. Sesiones y eventos corresponden a la página de entrada en los canales exportados.')+
    '<ul class="diag-items">'+a.rows.map(p=>'<li><strong>'+escapeHtml(p.path)+'</strong><small>'+escapeHtml(p.date||dates(a.period.start,a.period.end))+'</small><p>'+n(p.sessions)+' sesiones · '+n(p.keyEvents)+' eventos clave</p></li>').join('')+'</ul>';
}
const fold=(name,body,open=false)=>'<details class="diag-fold" '+(open?'open':'')+'><summary>'+escapeHtml(name)+'</summary>'+body+'</details>';
function result(r){
  const terms=new Map(r.keywords.filter(k=>k.observed).map(k=>[k.keyword.trim().toLocaleLowerCase('es'),k.intent])),intents=new Map();
  for(const label of terms.values())intents.set(label,(intents.get(label)||0)+1);
  const intentRows=[...intents].map(([label,queries])=>({label,queries})).sort((a,b)=>b.queries-a.queries);
  const t=r.technical, first=t?.issues?.[0];
  const action=first?first.fix:r.gaps.length?r.gaps[0].next:r.keywords.length?r.keywords[0].reason:t?.errors?.length?'Revisa el error del rastreo antes de valorar la salud del sitio.':r.analytics.rows.length?'Revisa las páginas con más sesiones y comprueba qué evento representa tu objetivo.':'Consulta el alcance y los controles que se pudieron revisar.';
  const source=r.sources.map(s=>'<li>'+escapeHtml(s.name)+' · '+n(s.count)+' '+escapeHtml(s.unit)+'</li>').join('');
  const gaps=r.gaps.length?'<ul class="diag-items">'+r.gaps.slice(0,80).map(g=>'<li><strong>'+escapeHtml(g.keyword)+'</strong><small>'+escapeHtml(g.page)+'</small><p>'+escapeHtml(g.evidence)+'</p><small>'+escapeHtml([dates(g.start,g.end),g.country,g.device].filter(Boolean).join(' · '))+'</small><p>'+escapeHtml(g.next)+'</p></li>').join('')+'</ul>':
    meta('Sin huecos verificables con esta muestra. Para contrastar el contenido se necesitan una consulta con impresiones, su URL y el HTML de esa misma página.');
  return '<header class="diag-result-head"><div><p class="eyebrow">'+(r.demo?'Ejemplo · datos ficticios':'Lectura puntual')+'</p><h2 tabindex="-1">Tu diagnóstico</h2>'+meta(r.url||'Análisis de los archivos aportados')+'</div><button class="btn secondary compact" type="button" data-diag-export>Descargar informe CSV</button></header>'+
    '<div class="diag-summary"><div><small>Salud técnica</small><strong>'+(t?.score!=null?n(t.score)+' / 100':'Sin evaluar')+'</strong></div><div><small>Consultas o desgloses</small><strong>'+n(r.counts.keywords)+'</strong></div><div><small>Filas de entrada GA4</small><strong>'+n(r.counts.landings)+'</strong></div></div>'+
    '<p class="diag-next"><b>Por dónde empezar</b> '+escapeHtml(action)+'</p>'+
    (intentRows.length?fold('¿Qué buscan las personas?',meta('Cada consulta observada cuenta una vez. Selecciona una porción para interpretar la intención estimada.')+intentGraphic(intentRows,'queries'),true):'')+
    (t?.coverage?.checked?fold('Explorar puntuación por dimensión',healthGraphic(t),!intentRows.length):'')+
    fold('Salud técnica y correcciones',technical(t),Boolean(first))+
    fold('Keywords y long-tail',keywords(r),!first&&r.keywords.length>0)+fold('Huecos de contenido por contrastar',gaps)+
    fold('Páginas de entrada de GA4',ga(r),!first&&!r.keywords.length&&r.analytics.rows.length>0)+
    fold('Fuentes y límites','<ul>'+source+'</ul>'+r.limitations.map(meta).join(''),!t?.coverage?.pages);
}
export function mountDiagnostico(container,{api,user}){
  const demo=Boolean(user?.email?.endsWith('@local.example'));
  let closed=false,busy=false,report=null;
  container.innerHTML='<section class="diag-tool"><form class="panel diag-form"><h2>¿Qué quieres analizar?</h2><p>Puedes usar una sola fuente o combinar varias de la misma web. El informe solo permanece en esta vista.</p>'+
    (demo?'<p class="inline-note">En demostración puedes probar Madera Sur o analizar tus propios CSV. Para rastrear una URL, entra con una cuenta del equipo.</p>':'<label>URL pública que quieres revisar<input type="url" name="url" placeholder="https://ejemplo.cl/" maxlength="2048"></label><label class="check"><input type="checkbox" name="authorized"> Tengo autorización para revisar esta URL y las páginas de su alcance.</label>')+
    '<div class="diag-uploads"><label>Consultas de Search Console<input name="gscCsv" type="file" accept=".csv,.tsv,.txt,text/csv"><small>CSV de Consultas principales. Si incluye URL y fecha, podrás contrastar cada búsqueda con el contenido.</small></label><label>Páginas de entrada de GA4<input name="ga4Csv" type="file" accept=".csv,.tsv,.txt,text/csv"><small>Exporta el informe de Página de destino con Sesiones o Eventos clave.</small></label></div>'+
    '<small>Hasta 750 KB y 5.000 filas por archivo. El rastreo puntual revisa hasta cuatro páginas.</small><div class="actions"><button class="btn primary" type="submit">Analizar ahora</button><button class="btn secondary" type="button" data-diag-example>Probar un ejemplo</button></div><p data-diag-status role="status"></p></form><section data-diag-output class="diag-output"></section></section>';
  const form=container.querySelector('form'),status=form.querySelector('[data-diag-status]'),output=container.querySelector('[data-diag-output]');
  async function submit(example){
    if(busy)return;busy=true;status.textContent='Preparando el diagnóstico…';
    const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{
      const payload={example};
      if(!example){
        payload.url=form.elements.url?.value.trim()||'';payload.authorized=Boolean(form.elements.authorized?.checked);
        if(payload.url&&!payload.authorized)throw Error('Confirma la autorización para revisar esta URL.');
        for(const name of ['gscCsv','ga4Csv']){
          const file=form.elements[name].files[0];if(!file)continue;
          if(file.size>750000||!file.size)throw Error('Selecciona un archivo no vacío de hasta 750 KB.');
          payload[name]=await file.text();
        }
        if(!payload.url&&!payload.gscCsv&&!payload.ga4Csv)throw Error('Introduce una URL o selecciona al menos un archivo para analizar.');
      }
      report=null;output.replaceChildren();
      const r=await api('diagnostico','POST',payload);if(closed)return;
      report=r;output.innerHTML=result(r);status.textContent='Informe listo.';output.querySelector('h2').focus();
    }catch(err){if(!closed){status.textContent=err.message;status.setAttribute('role','alert');}}
    finally{busy=false;if(!closed)buttons.forEach(b=>b.disabled=false);}
  }
  function run(ev){ev.preventDefault();status.setAttribute('role','status');submit(false);}
  function click(ev){if(handleGraphicEvent(ev))return;if(ev.target.closest('[data-diag-example]')){status.setAttribute('role','status');submit(true);}if(ev.target.closest('[data-diag-export]')&&report)download(report);}
  form.addEventListener('submit',run);container.addEventListener('click',click);
  container.addEventListener('keydown',handleGraphicEvent);
  return ()=>{closed=true;report=null;form.removeEventListener('submit',run);container.removeEventListener('click',click);container.removeEventListener('keydown',handleGraphicEvent);};
}
import {intentGraphic,healthGraphic,handleGraphicEvent} from './graficos.js';
