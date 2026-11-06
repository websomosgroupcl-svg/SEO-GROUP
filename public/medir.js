import {animal, companion} from './companions.js';
import {intentGraphic,compareGraphic,handleGraphicEvent} from './graficos.js';
const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric = n => typeof n === 'number' && Number.isFinite(n);
const format = (n, digits=1) => numeric(n) ? n.toLocaleString('es-CL', {maximumFractionDigits:digits}) : 'Sin datos';
const when = (v, long=false) => {
  if (!v) return 'Fecha pendiente';
  const day = new Date(String(v).length===10 ? v+'T12:00:00' : v);
  return Number.isNaN(+day) ? 'Fecha pendiente' : day.toLocaleDateString('es-CL',{day:'numeric',month:long?'long':'short',...(long?{year:'numeric'}:{})});
};
const names = {
  clicks:['Clics de Google','Veces que alguien pulsó un resultado del sitio en Google.'],
  impressions:['Impresiones','Veces que una página apareció en los resultados de búsqueda.'],
  ctr:['Porcentaje de clics','De cada 100 apariciones en Google, cuántas generaron un clic.'],
  position:['Posición media','Lugar medio en los resultados. Acercarse al primer lugar es una mejora.'],
  sessions:['Sesiones','Visitas registradas por Analytics 4 en todos los canales medidos.'],
  keyEvents:['Eventos clave','Acciones que el equipo marcó como importantes en Analytics 4, para todos los canales medidos.'],
  activeUsers:['Usuarios activos','Personas con actividad registrada por día. Una persona puede volver otros días.'],
};
const percent = (n) => numeric(n) ? format(n)+' %' : 'Sin datos';
const value = (n,key) => key==='ctr'?percent(n):format(n);
const direction = (v,key) => numeric(v) && v!==0 ? ((key==='position'?v<0:v>0)?'gain':'loss'):'neutral';
const signed = n => numeric(n)?(n>0?'+':'')+format(n):'';
function change(kpi,key) {
  if(!numeric(kpi?.delta))return 'Comparación pendiente';
  if(kpi.delta===0)return 'Sin variación';
  if(key==='ctr')return signed(kpi.delta)+' puntos porcentuales';
  if(key==='position')return format(Math.abs(kpi.delta))+(kpi.delta<0?' puestos mejor':' puestos peor');
  if(numeric(kpi.changePct))return signed(kpi.changePct)+' %';
  return signed(kpi.delta)+' en el período';
}
const dayRange=d=>when(d.start)+' – '+when(d.end,true);
const sourceLabel=d=>typeof d.source==='string'?d.source:(d.source?.label||'Sin fuente de búsqueda');
const panel=(title,body,kicker='')=>'<section class="md-panel">'+(kicker?'<p class="md-kicker">'+escapeHtml(kicker)+'</p>':'')+'<h3>'+escapeHtml(title)+'</h3>'+body+'</section>';
const empty=s=>'<p class="md-empty">'+escapeHtml(s)+'</p>';
const pill=s=>'<span class="md-pill">'+escapeHtml(s)+'</span>';
function kpiCard(d,key) {
  const k=d.kpis?.[key]||{}, delta=change(k,key);
  return '<article class="md-kpi"><span class="md-label">'+escapeHtml(names[key][0])+'</span><strong>'+escapeHtml(value(k.value,key))+'</strong><small class="md-delta '+direction(k.delta,key)+'">'+escapeHtml(delta)+'</small><p>'+escapeHtml(names[key][1])+'</p>'+(k.coverage?.partial?'<small class="md-partial">Cobertura parcial · '+format(k.coverage.current)+' de '+format(k.coverage.expected)+' días</small>':'')+'</article>';
}
const compact=n=>n>=1e6?format(n/1e6)+' M':n>=1e3?format(n/1e3)+' mil':format(n);
function geometry(rows,key,width=720) {
  const w=width,h=w<500?170:202,left=w<500?39:52,right=12,top=19,bottom=30,usable=h-top-bottom;
  const vals=rows.map(row=>row[key]).filter(numeric);
  const raw=Math.max(1,...vals);
  const exponent=10**Math.floor(Math.log10(raw));
  const max= Math.ceil(raw/exponent/0.5)*exponent*0.5;
  const min=key==='position'?Math.max(0,Math.floor(Math.min(...vals)-1)):0;
  const x=i=>left+((w-left-right)*i)/Math.max(1,rows.length-1);
  const y=n=>key==='position'?top+(n-min)*usable/Math.max(1,max-min):h-bottom-n*usable/max;
  const out=[]; let segment=[];
  rows.forEach((row,i)=>{if(numeric(row[key]))segment.push([x(i),y(row[key]),i,row[key]]);else if(segment.length){out.push(segment);segment=[];}});
  if(segment.length)out.push(segment);
  return {w,h,left,right,top,bottom,max,min,x,y,out,vals};
}
function guideMessage(row,key,highlights) {
  const event=highlights.find(h=>h.date===row.date&&h.metric===key);
  if(event) return event.title+' · '+event.detail;
  if(!numeric(row[key])) return 'Esta fecha queda sin observación. Puedes recorrer los días contiguos para encontrar datos.';
  return when(row.date,true)+' · '+names[key][0]+': '+value(row[key],key)+'.';
}
function chartGuide(group,rows,key,start,highlights,pct) {
  const name=group==='google'?'Miga':'Nilo', kind=group==='google'?'keywords':'revisiones';
  return '<div class="md-guide" data-guide="'+group+'"><div class="md-guide-track" aria-hidden="true"><div class="md-guide-unit" style="left:clamp(22px,'+pct+'%,calc(100% - 22px))">'+animal(kind)+'</div></div><div class="md-guide-board"><strong>'+name+' · Lectura del día</strong><p data-guide-message>'+escapeHtml(guideMessage(rows[start],key,highlights))+'</p></div></div>';
}
function chart(rows,key,d,group,width) {
  if(!rows.some(r=>numeric(r[key])))return empty(group==='google'?'Sin observaciones fechadas para esta métrica. Conecta Search Console o importa consultas con fecha.':'Vincula Analytics 4 y sincroniza datos para ver esta serie.');
  const {w,h,left,right,top,bottom,min,max,x,y,out}=geometry(rows,key,width);
  const grids=Array.from({length:4},(_,j)=>{
    const val=min+(max-min)*j/3, pos=y(val);
    const label=key==='ctr'?compact(val)+'%':compact(val);
    return '<line class="md-gridline" x1="'+left+'" x2="'+(w-right)+'" y1="'+pos+'" y2="'+pos+'"/><text class="md-tick" x="'+(left-8)+'" y="'+(pos+4)+'" text-anchor="end">'+label+'</text>';
  }).join('');
  const useIndexes=[...new Set([0,Math.round((rows.length-1)/3),Math.round((rows.length-1)*2/3),rows.length-1])];
  const dates=useIndexes.map((i,j)=>'<text class="md-tick" x="'+x(i)+'" y="'+(h-4)+'" text-anchor="'+(j===0?'start':j===useIndexes.length-1?'end':'middle')+'">'+escapeHtml(when(rows[i].date))+'</text>').join('');
  const lines=out.map(seg=>{
    const points=seg.map(([px,py])=>px.toFixed(1)+','+py.toFixed(1)).join(' ');
    const [first,last]=[seg[0],seg.at(-1)];
    return (seg.length>1?'<polygon class="md-area" points="'+first[0]+','+(h-bottom)+' '+points+' '+last[0]+','+(h-bottom)+'"/><polyline class="md-line" points="'+points+'"/>':'')+
      (seg.length===1?'<circle class="md-dot" cx="'+first[0]+'" cy="'+first[1]+'" r="3.5"/>':'');
  }).join('');
  const peak=rows.reduce((best,r,i)=>numeric(r[key])&&(best===null||(key==='position'?r[key]<rows[best][key]:r[key]>rows[best][key]))?i:best,null);
  const changes=(d.highlights||[]).filter(m=>m.metric===key).map(m=>({...m,ix:rows.findIndex(r=>r.date===m.date&&numeric(r[key]))})).filter(m=>m.ix>=0);
  const pins=changes.map(m=>'<g aria-hidden="true"><rect class="md-change-pin" x="'+(x(m.ix)-7)+'" y="'+(y(rows[m.ix][key])-7)+'" width="14" height="14" rx="3"/><text x="'+x(m.ix)+'" y="'+(y(rows[m.ix][key])+4)+'" text-anchor="middle" class="md-pin-label">'+(m.kind==='peak'?'↑':'↓')+'</text></g>').join('');
  const changeNotes=changes.length?'<ul class="md-changes">'+changes.map(m=>'<li><button type="button" class="md-jump-point" data-point="'+m.ix+'" data-group="'+group+'">'+escapeHtml(when(m.date))+' · '+escapeHtml(m.title)+'</button><p>'+escapeHtml(m.detail)+'</p></li>').join('')+'</ul>':'';
  const peakMark=peak===null?'':'<g aria-hidden="true"><line x1="'+x(peak)+'" x2="'+x(peak)+'" y1="'+y(rows[peak][key])+'" y2="'+(h-bottom)+'" class="md-peak-line"/><circle class="md-peak" r="5" cx="'+x(peak)+'" cy="'+y(rows[peak][key])+'"/></g>';
  return '<div class="md-plot" data-plot="'+group+'" data-key="'+key+'"><svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" aria-hidden="true">'+grids+lines+peakMark+pins+dates+'<line class="md-cross" x1="0" x2="0" y1="'+top+'" y2="'+(h-bottom)+'" visibility="hidden"/><circle class="md-cursor" visibility="hidden" r="4"/></svg><div class="md-tooltip" hidden></div></div>'+
    chartGuide(group,rows,key,peak,d.highlights||[],100*x(peak)/w)+'<label class="md-scrub">Explorar por día<input type="range" min="0" max="'+(rows.length-1)+'" value="'+peak+'" data-scrub="'+group+'" aria-valuetext="'+escapeHtml(when(rows[peak].date)+' · '+value(rows[peak][key],key))+'" aria-label="Explorar '+escapeHtml(names[key][0])+' por día"><output data-readout="'+group+'">'+escapeHtml(when(rows[peak].date)+' · '+value(rows[peak][key],key))+'</output></label>'+
    '<p class="md-peaknote"><i aria-hidden="true"></i><span><strong>'+escapeHtml(key==='position'?'Mejor posición del período':'Máximo observado')+'</strong> · '+escapeHtml(when(rows[peak].date)+' · '+value(rows[peak][key],key))+'</span></p>'+changeNotes;
}
function history(d,group,key,width) {
  const choices=group==='google'?['clicks','impressions','ctr','position']:['sessions','keyEvents','activeUsers'];
  const lineage=group==='google'?sourceLabel(d):(d.connections?.analytics?.label||'Analytics 4');
  const rows=d.series||[];
  const table=rows.some(r=>choices.some(k=>numeric(r[k])))?'<details class="md-details"><summary>Consultar los valores diarios</summary><div class="table-wrap"><table><caption class="sr">Valores diarios de '+escapeHtml(lineage)+'</caption><thead><tr><th>Fecha</th>'+choices.map(k=>'<th>'+names[k][0]+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><th scope="row">'+escapeHtml(when(r.date))+'</th>'+choices.map(k=>'<td>'+escapeHtml(value(r[k],k))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details>':'';
  return '<section data-section="'+group+'" class="md-chart md-panel '+(group==='analytics'?'md-analytics':'')+'"><div class="md-heading"><div><p class="md-kicker">'+escapeHtml(lineage)+'</p><h3>'+(group==='google'?'Cómo te encuentran en Google':'Qué ocurre dentro de la web')+'</h3></div><label>Métrica<select data-metric="'+group+'">'+choices.map(k=>'<option value="'+k+'" '+(key===k?'selected':'')+'>'+names[k][0]+'</option>').join('')+'</select></label></div><p class="md-explain">'+escapeHtml(names[key][1])+'</p>'+chart(rows,key,d,group,width)+table+'</section>';
}
function intentCard(d){
  return panel('Qué buscaban las personas','<p class="md-explain">Cada porción representa impresiones de las consultas disponibles. Selecciona una intención para ver cuántas apariciones reúne y cómo trabajar el contenido.</p>'+intentGraphic(d.intent),'Intención estimada · '+sourceLabel(d));
}
function aiCard(d) {
  const a=d.ai||{}, engines=a.engines||[];
  const visits=a.visits;
  const counts='<div class="md-mini"><div><small>Respuestas examinadas</small><strong>'+format(a.samples)+'</strong></div><div><small>Motores y tipos de pregunta</small><strong>'+format(engines.length)+'</strong></div><div><small>Visitas desde IA (Analytics)</small><strong>'+(visits?format(visits.sessions):'Sin datos')+'</strong>'+(visits?'<small>Período anterior: '+format(visits.previous)+'</small>':'')+'</div></div>';
  const rate=(hits,known,range)=>known>0?format(hits)+' de '+format(known)+' · '+format(range.low)+'–'+format(range.high)+' %':'No aplica';
  const data=engines.length?'<div class="table-wrap"><table><thead><tr><th>Motor y tipo</th><th>Respuestas</th><th>Mención</th><th>Cita</th><th>Recomendación</th></tr></thead><tbody>'+engines.map(r=>'<tr><th scope="row">'+escapeHtml(r.engine)+'</th><td>'+format(r.samples)+(r.refused?' ('+format(r.refused)+' sin respuesta)':'')+'</td><td>'+escapeHtml(rate(r.mentions,r.mentionsKnown,r.mentionRange))+'</td><td>'+escapeHtml(rate(r.citations,r.citationsKnown,r.citationRange))+'</td><td>'+escapeHtml(rate(r.recommendations,r.recommendKnown,r.recommendRange))+'</td></tr>').join('')+'</tbody></table></div>':empty('No hay respuestas registradas en estas fechas. Configura el panel automático o registra una muestra para observar si aparece la marca o si se enlaza su sitio.');
  const sources=visits?.sources?.length?'<p class="md-explain">Visitas por origen: '+escapeHtml(visits.sources.slice(0,6).map(s=>s.source+' '+format(s.sessions)).join(' · '))+'.</p>':'';
  const warning=(a.panelError?'<p class="md-partial">'+escapeHtml(a.panelError)+'</p>':'')+(a.estimatedSpend?'<p class="md-explain">Gasto estimado del panel en este período: US$'+format(a.estimatedSpend,2)+'.</p>':'');
  return panel('Presencia en respuestas de IA','<p class="md-explain">Las respuestas cambian entre repeticiones, así que importa la frecuencia y no una sola prueba. El rango indica entre qué valores puede estar la tasa real. Si dos rangos se cruzan, no hay un cambio demostrable. La app y la API son series distintas: no las sumes ni las compares entre sí.</p>'+warning+counts+sources+data,'Muestra de IA · '+(d.connections?.ai?.label||'Observaciones manuales'));
}
function tasksCard(site,d) {
  const ts=site.tasks||[];
  const target=t=>t.expectedOutcome||'Revisar el indicador de la página después del cambio.';
  const channels={google:'Google',ia:'IA',ambos:'Google e IA'};
  const details=ts.slice(0,8).map(t=>'<li><strong>'+escapeHtml(t.title)+'</strong>'+pill(t.appliedAt?'Cambio aplicado':'En preparación')+(channels[t.target]?' '+pill(channels[t.target]):'')+'<p><b>Objetivo.</b> '+escapeHtml(typeof target(t)==='string'?target(t):'Mejorar la respuesta de esta página a la búsqueda seleccionada.')+'</p><p><b>Resultado.</b> '+escapeHtml(t.result?.message||t.verification?.message||(t.appliedAt?'En observación desde el '+when(t.appliedAt)+'.':'Pendiente de aplicar.'))+'</p></li>').join('');
  const annotations=(d.annotations||[]).slice(0,10).map(a=>'<li><time>'+escapeHtml(when(a.date))+'</time> '+escapeHtml(a.title)+(a.url?'<small>'+escapeHtml(a.url)+'</small>':'')+'</li>').join('');
  return panel('Mejoras y resultados esperados',details?'<ul class="md-tasks">'+details+'</ul>':empty('Las mejoras que prepares en el paso 3 aparecerán aquí con su objetivo y el resultado observado.'))+(annotations?'<details class="md-details"><summary>Cambios registrados durante el período</summary><ul class="md-annotations">'+annotations+'</ul></details>':'');
}
function reportLines(site,d) {
  const result=['Informe de '+site.name,dayRange(d)+(site.demo?' · Datos de ejemplo':''),''];
  const s=d.kpis||{}, c=d.coverage||{};
  if(site.businessGoal)result.push('Objetivo del negocio. '+site.businessGoal+'.');
  if(numeric(s.clicks?.value)) {
    result.push('Búsqueda orgánica. Se observaron '+format(s.clicks.value)+' clics'+(numeric(s.impressions?.value)?' en '+format(s.impressions.value)+' impresiones':'')+'. Cobertura de '+format(c.current)+' de '+format(c.expected)+' días.');
    if(numeric(s.clicks?.changePct)) result.push('Los clics variaron '+signed(s.clicks.changePct)+' % respecto del período anterior.');
  }else result.push('Búsqueda orgánica. Pendiente de observaciones para el período.');
  if(numeric(s.sessions?.value)||numeric(s.keyEvents?.value))result.push('Analítica del sitio. '+[numeric(s.sessions?.value)?format(s.sessions.value)+' sesiones':null,numeric(s.keyEvents?.value)?format(s.keyEvents.value)+' eventos clave':null].filter(Boolean).join(' y ')+', en todos los canales medidos.');
  else result.push('Analítica del sitio. Sin datos de Analytics 4 para estas fechas.');
  if(d.ai?.samples) result.push('IA. '+(d.ai.engines||[]).map(r=>r.engine+': '+format(r.mentions)+' menciones en '+format(r.mentionsKnown)+' respuestas y '+format(r.citations)+' citas en '+format(r.citationsKnown)+'.').join(' ')+(d.ai.visits?' Visitas desde IA según Analytics: '+format(d.ai.visits.sessions)+'.':''));
  else result.push('Visibilidad en IA. Sin muestras registradas en el período.');
  const move=d.highlights?.[0]; if(move)result.push('Cambio destacado. '+move.title+'. '+(move.detail||''));
  const intervention=(site.tasks||[]).find(t=>t.appliedAt); 
  if(intervention)result.push('Intervención. '+intervention.title+'. '+(intervention.result?.message||'Seguimiento pendiente desde el '+when(intervention.appliedAt)+'.'));
  const next=site.opportunities?.find(o=>o.observed);
  if(next)result.push('Próxima acción sugerida. Revisar la página asociada a «'+next.keyword+'» y documentar si resuelve esa intención.');
  result.push('Fuentes. '+sourceLabel(d)+(numeric(s.sessions?.value)?', Analytics 4':'')+(d.ai?.samples?', muestras registradas de IA':'')+'.');
  const notes=(d.notes||[]).filter(x=>typeof x==='string'); if(notes.length)result.push('Alcance. '+notes.join(' '));
  return result;
}
function livePanel(l,site) {
  const working=['live','demo'].includes(l?.status), stamp=l?.updatedAt&&new Date(l.updatedAt);
  const time=stamp&&!Number.isNaN(+stamp)?stamp.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):null;
  const title=l?.status==='demo'?'Ejemplo de actividad reciente':working?'Actividad reciente en tu sitio':'Actividad de los últimos 30 minutos';
  const hist=(l?.series||[]).filter(p=>numeric(p.minutesAgo)&&numeric(p.views)).sort((a,b)=>b.minutesAgo-a.minutesAgo), max=Math.max(1,...hist.map(r=>r.views));
  const bars=hist.length?'<div class="md-livebars" role="img" aria-label="Vistas por minuto, desde la observación más antigua hasta la más reciente">'+hist.map(r=>'<i style="height:'+Math.max(2,100*r.views/max)+'%" title="Hace '+format(r.minutesAgo)+' min · '+format(r.views)+' vistas"></i>').join('')+'</div><details class="md-details"><summary>Ver vistas por minuto</summary><div class="table-wrap"><table><thead><tr><th>Hace</th><th>Vistas</th></tr></thead><tbody>'+hist.map(r=>'<tr><td>'+format(r.minutesAgo)+' min</td><td>'+format(r.views)+'</td></tr>').join('')+'</tbody></table></div></details>':'';
  const metrics=working?'<div class="md-mini"><div><small>Usuarios activos</small><strong>'+format(l.activeUsers)+'</strong></div><div><small>Vistas</small><strong>'+format(l.views)+'</strong></div><div><small>Eventos clave</small><strong>'+format(l.keyEvents)+'</strong></div></div>'+bars:'';
  return '<p class="md-kicker">Analytics 4 · últimos '+format(l?.windowMinutes||30)+' min'+(time?' · '+escapeHtml(time):'')+'</p><h3>'+title+'</h3>'+metrics+'<p class="md-explain">'+escapeHtml(l?.message||'Consultando la disponibilidad de Analytics 4…')+'</p>';
}
function orientation(site,d) {
  const secs=[['google','Google'],['analytics','Analytics'],['ai','Respuestas de IA'],['tasks','Mejoras'],['report','Informe para directorio']];
  return '<div class="md-orientation">'+(site.businessGoal?'<p><strong>Objetivo comercial</strong> · '+escapeHtml(site.businessGoal)+'</p>':'')+'<nav class="md-shortcuts" aria-label="Ir a la sección del informe">'+secs.map(([key,label])=>'<button type="button" data-jump="'+key+'">'+label+'</button>').join('')+'</nav></div>';
}
function controls(days) {
  return '<fieldset class="md-range"><legend>Período del informe</legend>'+[7,28,90].map(n=>'<button type="button" data-days="'+n+'" aria-pressed="'+(n===days)+'">'+n+' días</button>').join('')+'</fieldset>';
}
export function renderDashboard(site,d,options={}) {
  const google=options.google||'clicks',analytics=options.analytics||'sessions',c=d.coverage||{},hl=d.highlights||[];
  const range=dayRange(d);
  const report=reportLines(site,d);
  return '<div class="measure"><header class="md-head"><div><p class="md-kicker">Rendimiento del sitio</p><h2>Resultados del período</h2><p>'+escapeHtml(range)+(site.demo?' · Ejemplo con datos ficticios':'')+'</p></div>'+controls(d.days||28)+'</header>'+orientation(site,d)+
    '<div class="md-cards">'+['clicks','impressions','ctr','position'].map(k=>kpiCard(d,k)).join('')+'</div>'+
    '<p class="md-coverage">'+pill(sourceLabel(d))+' '+escapeHtml(format(c.current)+' de '+format(c.expected??d.days)+' días con datos de búsqueda. Período anterior: '+format(c.previous)+' de '+format(d.days)+' días con datos.')+'</p>'+
    history(d,'google',google,options.width)+
    panel('¿Cambió el resultado frente al período anterior?','<p class="md-explain">Elige una métrica. Las barras comparan dos períodos de igual duración e indican cuántos días tienen datos en cada uno.</p>'+compareGraphic(d,['clicks','impressions','sessions','keyEvents'].map(key=>[key,names[key][0]])),'Comparar períodos')+
    '<div class="md-split">'+panel('Qué está cambiando',hl.length?'<ul class="md-observations">'+hl.slice(0,5).map(m=>'<li><time>'+escapeHtml(when(m.date))+'</time><strong>'+escapeHtml(m.title)+'</strong><p>'+escapeHtml(m.detail)+'</p></li>').join('')+'</ul>':empty('Aún no hay un cambio destacado con evidencia suficiente en este período.'),'Lectura de los datos')+intentCard(d)+'</div>'+
    '<div class="md-cards md-cards-two">'+['sessions','keyEvents'].map(k=>kpiCard(d,k)).join('')+'</div>'+history(d,'analytics',analytics,options.width)+
    '<section class="md-panel" data-live>'+livePanel(options.live,site)+'</section>'+'<div data-section="ai">'+aiCard(d)+'</div><div data-section="tasks">'+tasksCard(site,d)+'</div>'+
    '<section data-section="report" class="md-report md-panel"><div class="md-heading"><div><p class="md-kicker">Para compartir con el equipo</p><h3>Resumen para directorio</h3></div><div class="actions"><button class="btn secondary compact" type="button" data-copy>Copiar informe</button><button class="btn secondary compact" type="button" data-print>Imprimir informe</button></div></div><div class="md-report-text">'+report.filter(Boolean).map((s,i)=>i<2?'<p class="'+(i===0?'md-report-title':'md-report-date')+'">'+escapeHtml(s)+'</p>':'<p>'+escapeHtml(s)+'</p>').join('')+'</div><p class="md-copy-status" role="status"></p></section></div>';
}
function jsonLoader(site) {
  return async (route,{signal}={})=>{
    const res=await fetch('/api/sites/'+encodeURIComponent(site.id)+'/'+route,{credentials:'same-origin',cache:'no-store',signal});
    const payload=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(payload.error||'La fuente no respondió. Vuelve a intentarlo.');
    return payload;
  };
}
export function mountDashboard(container,{site,load=jsonLoader(site)}={}) {
  const plotWidth=()=>Math.max(160,Math.round(container.clientWidth-(innerWidth<660?28:52)));
  const state={width:plotWidth(),days:28,google:'clicks',analytics:'sessions',live:null,data:null};
  let gone=false, requestId=0, dataAbort, liveAbort, timer, lastLive=0;
  const completed=()=>!gone&&container.isConnected;
  function draw(){if(completed()&&state.data)container.innerHTML=renderDashboard(site,state.data,state);}
  function backendError(err) {
    container.innerHTML='<div class="measure"><section class="md-panel"><h3>Informe pendiente</h3><p class="md-explain">'+escapeHtml(err.message||'No se pudo leer el informe.')+'</p><button type="button" class="btn secondary" data-reload>Volver a cargar</button></section></div>';
  }
  async function fetchMetrics(days=28) {
    const id=++requestId;
    dataAbort?.abort();dataAbort=new AbortController();
    if(!state.data)container.innerHTML=companion('revisiones',{loading:true,title:'Preparando el informe',message:'Estoy reuniendo las métricas disponibles de '+site.name+'.'});
    container.setAttribute('aria-busy','true');
    try {
      const d=await load('metrics?days='+days,{signal:dataAbort.signal});
      if(id!==requestId||!completed())return;
      state.days=days;state.data=d;
      draw();
      if(!state.live)await fetchLive();
    }catch(err){if(id===requestId&&completed()&&err.name!=='AbortError')backendError(err);}
    finally{if(id===requestId&&completed())container.removeAttribute('aria-busy');}
  }
  async function fetchLive(){
    if(!completed()||document.hidden||liveAbort)return;
    liveAbort=new AbortController();
    try {
      state.live=await load('live',{signal:liveAbort.signal});
    }catch(err){
      if(err.name==='AbortError')return;
      state.live={status:'unavailable',message:err.message||'Analytics 4 no respondió.'};
    }finally{liveAbort=null;}
    if(completed()) {
      const panel=container.querySelector('[data-live]');
      if(panel){
        const detailOpen=panel.querySelector('details')?.open;
        if(!panel.contains(document.activeElement)) {
          panel.innerHTML=livePanel(state.live,site);
          if(detailOpen&&panel.querySelector('details'))panel.querySelector('details').open=true;
        }
      }
      lastLive=Date.now();
    }
  }
  const visibility=()=>{
    clearInterval(timer);
    if(!gone&&!document.hidden) {
      if(state.data&&Date.now()-lastLive>=60000)fetchLive();
      timer=setInterval(()=>{if(completed())fetchLive();else dispose();},60000);
    }
  };
  function inspect(group,index,tooltip) {
    const plot=container.querySelector('[data-plot="'+group+'"]'),scrub=container.querySelector('[data-scrub="'+group+'"]'),out=container.querySelector('[data-readout="'+group+'"]');
    const row=state.data?.series?.[index];if(!plot||!row||!scrub||!out)return;
    const key=plot.dataset.key,rows=state.data.series,g=geometry(rows,key,+plot.querySelector('svg').viewBox.baseVal.width),px=g.x(index),n=row[key],point=plot.querySelector('.md-cursor'),cross=plot.querySelector('.md-cross'),tip=plot.querySelector('.md-tooltip');
    const label=when(row.date,true)+' · '+value(n,key);
    scrub.value=String(index);scrub.setAttribute('aria-valuetext',label);
    out.textContent=label;
    const guide=container.querySelector('[data-guide="'+group+'"]');
    if(guide&&guide.dataset.index!==String(index)){
      guide.dataset.index=String(index);
      guide.querySelector('.md-guide-unit').style.left='clamp(22px,'+(100*px/g.w)+'%,calc(100% - 22px))';
      guide.querySelector('[data-guide-message]').textContent=guideMessage(row,key,state.data.highlights||[]);
    }
    cross.setAttribute('x1',px);cross.setAttribute('x2',px);cross.setAttribute('visibility','visible');
    point.setAttribute('visibility',numeric(n)?'visible':'hidden');
    if(numeric(n)){point.setAttribute('cx',px);point.setAttribute('cy',g.y(n));}
    tip.hidden=!tooltip;
    if(tooltip){tip.textContent=label;tip.style.left=Math.min(78,Math.max(22,px/g.w*100))+'%';}
  }
  function pointer(ev){
    const plot=ev.target.closest?.('[data-plot]');
    if(!plot||!state.data)return;
    const rect=plot.getBoundingClientRect();if(rect.width<=0)return;
    const {w,left,right}=geometry(state.data.series,plot.dataset.key,+plot.querySelector('svg').viewBox.baseVal.width);
    const raw=((ev.clientX-rect.left)/rect.width*w-left)/(w-left-right);
    const index=Math.round(Math.min(1,Math.max(0,raw))*(state.data.series.length-1));
    inspect(plot.dataset.plot,index,true);
  }
  function leave(ev){
    const plot=ev.target.closest?.('[data-plot]');
    if(plot&&!plot.contains(ev.relatedTarget))plot.querySelector('.md-tooltip').hidden=true;
  }
  function input(ev){if(ev.target.matches('[data-scrub]'))inspect(ev.target.dataset.scrub,+ev.target.value,false);}
  function selectMetric(ev){
    if(!ev.target.matches('select[data-metric]'))return;
    const group=ev.target.dataset.metric;
    if(!['analytics','google'].includes(group)||!names[ev.target.value])return;
    state[group]=ev.target.value;draw();
    container.querySelector('select[data-metric="'+group+'"]')?.focus({preventScroll:true});
  }
  async function click(ev){
    if(handleGraphicEvent(ev))return;
    const jump=ev.target.closest('[data-jump]');
    if(jump){const section=container.querySelector('[data-section="'+jump.dataset.jump+'"]');
      const h=section?.querySelector('h3');if(h){h.tabIndex=-1;h.focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}return;}
    const pt=ev.target.closest('[data-point]');
    if(pt){inspect(pt.dataset.group,Number(pt.dataset.point),false);container.querySelector('[data-scrub="'+pt.dataset.group+'"]')?.focus({preventScroll:true});return;}
    const range=ev.target.closest('[data-days]');
    if(range){await fetchMetrics(Number(range.dataset.days));container.querySelector('[data-days="'+state.days+'"]')?.focus({preventScroll:true});return;}
    if(ev.target.closest('[data-reload]')){await fetchMetrics(state.days);return;}
    if(ev.target.closest('[data-print]')){window.print();return;}
    if(ev.target.closest('[data-copy]')&&state.data) {
      const report=reportLines(site,state.data).join('\n'),status=container.querySelector('.md-copy-status');
      try{await navigator.clipboard.writeText(report);status.textContent='Informe copiado.';}
      catch{
        const selection=window.getSelection(),r=document.createRange();
        r.selectNodeContents(container.querySelector('.md-report-text'));selection.removeAllRanges();selection.addRange(r);
        status.textContent='Informe seleccionado. Usa la opción Copiar de tu navegador.';
      }
    }
  }
  function dispose() {
    if(gone)return;gone=true;observer.disconnect();clearInterval(timer);dataAbort?.abort();liveAbort?.abort();
    document.removeEventListener('visibilitychange',visibility);
    for(const [type,fn] of events)container.removeEventListener(type,fn);
  }
  const observer=new ResizeObserver(()=>{const next=plotWidth();if(Math.abs(next-state.width)>6){state.width=next;draw();}});observer.observe(container);
  const events=[['pointermove',pointer],['pointerout',leave],['input',input],['change',selectMetric],['click',click],['keydown',handleGraphicEvent]];
  for(const [type,fn] of events)container.addEventListener(type,fn);
  document.addEventListener('visibilitychange',visibility);
  visibility();fetchMetrics(state.days);
  return dispose;
}

