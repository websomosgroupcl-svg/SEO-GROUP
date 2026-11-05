const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=new Intl.NumberFormat('es-CL',{maximumFractionDigits:1});
const dateFormat=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const units={clicks:'clics',impressions:'impresiones',sessions:'sesiones',keyEvents:'eventos clave'};
const num=value=>Number.isFinite(value)?count.format(value):'Sin dato';
const signed=value=>Number.isFinite(value)?(value>0?'+':'')+num(value):'Sin dato';
function date(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return 'Sin fecha';
  const d=new Date(value+'T12:00:00Z');
  return Number.isFinite(+d)?dateFormat.format(d):'Sin fecha';
}
const period=(start,end)=>date(start)+' – '+date(end);

function history(change,unit){
  if(!change)return '<div class="stat-period"><p class="stat-label">Semana observada</p><p>Aún no hay dos semanas completas y consecutivas que se puedan comparar.</p></div>';
  const difference=change.percent==null?'La semana anterior registró cero.':signed(change.percent)+' %';
  return '<div class="stat-period"><p class="stat-label">Semana observada</p><p class="stat-value">'+num(change.current)+' <span>'+unit+'</span></p><p class="stat-date">'+period(change.start,change.end)+'</p>'+
    '<p>Semana anterior · '+num(change.previous)+' '+unit+'<br><small>'+period(change.previousStart,change.previousEnd)+'</small></p>'+
    '<p class="stat-change">Cambio · '+signed(change.delta)+' '+unit+' <small>('+difference+')</small></p></div>';
}

function prediction(series,unit){
  const f=series.forecast;
  if(series.status!=='proyeccion'||!f)return '<div class="stat-period stat-estimate"><p class="stat-label">Sin proyección</p><p>'+escapeHtml(series.reason||'Falta historial suficiente para estimar la próxima semana.')+'</p></div>';
  return '<div class="stat-period stat-estimate"><p class="stat-label">Semana estimada</p><p class="stat-value">'+num(f.estimate)+' <span>'+unit+'</span></p><p class="stat-date">'+period(f.start,f.end)+'</p>'+
    '<p>Rango orientativo · '+num(f.low)+' a '+num(f.high)+' '+unit+'</p><p class="stat-confidence">Confianza '+escapeHtml(series.confidence)+'</p></div>';
}

function metric(series){
  const unit=units[series.key]||'unidades', validation=series.backtest;
  const coverage=series.lastDataAt?num(series.availableDays)+' días consecutivos hasta '+date(series.lastDataAt):'Aún no hay fechas con datos finales.';
  const validationText=validation?'<details class="stat-validation"><summary>¿Cómo rindió el modelo en el pasado?</summary><p>En '+num(validation.weeks)+' semanas de prueba, la estimación se desvió en promedio '+num(validation.mae)+' '+unit+' del resultado observado. Repetir el valor de la semana anterior habría dado un error medio de '+num(validation.baselineMae)+' '+unit+'.</p>'+
    (validation.wape==null?'':'<p>Error absoluto acumulado como porcentaje del total observado · '+num(validation.wape)+' %.</p>')+'</details>':'';
  return '<article class="stat-metric"><header><h4>'+escapeHtml(series.label)+'</h4><p class="stat-date">'+escapeHtml(series.source)+' · '+coverage+'</p></header>'+
    '<div class="stat-periods">'+history(series.change,unit)+prediction(series,unit)+'</div>'+
    (series.change?.next?'<p class="stat-action"><strong>Qué revisar</strong> '+escapeHtml(series.change.next)+'</p>':'')+validationText+'</article>';
}

export function statisticalPanel(statistics){
  if(!statistics?.series?.length)return '<section class="stat-report"><h3>Informe semanal</h3><p>El análisis estadístico estará disponible después de procesar la revisión del sitio.</p></section>';
  return '<section class="stat-report"><header><p class="eyebrow">Analista local · '+date(statistics.asOf)+'</p><h3>Informe semanal</h3><p>Compara los últimos siete días con los siete anteriores. Cuando el historial permite estimar la semana que viene, encontrarás la proyección junto a los resultados observados.</p></header>'+
    '<div class="stat-grid">'+statistics.series.map(metric).join('')+'</div>'+
    '<details class="stat-validation"><summary>Cómo se calcula la estimación y su rango</summary><p>'+escapeHtml(statistics.method)+'</p><p>'+escapeHtml(statistics.confidenceNote)+'</p></details></section>';
}
