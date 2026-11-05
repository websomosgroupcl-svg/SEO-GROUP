import {shiftDay,validDay} from './sources.mjs';

const WEEK=7;
const MAX_HISTORY=90;
const MIN_TRAIN=14;
const MIN_VALIDATION=2;
const sum=values=>values.reduce((a,b)=>a+b,0);
const round=(value,places=1)=>Number(value.toFixed(places));
const elapsed=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000);
const localDay=(now,zone)=>new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:zone}).format(now);
function median(values){
  const v=[...values].sort((a,b)=>a-b),m=Math.floor(v.length/2);
  return v.length%2?v[m]:(v[m-1]+v[m])/2;
}
const metrics=[
  ['clicks','Clics de búsqueda',14,'Contrastar consultas, títulos y páginas que recibieron impresiones.','Conservar las páginas implicadas y revisar qué consultas ganaron clics.'],
  ['impressions','Impresiones de búsqueda',140,'Revisar las consultas y la cobertura de indexación de las páginas afectadas.','Examinar las consultas que empiezan a mostrar el sitio y su página de destino.'],
  ['sessions','Sesiones',28,'Desglosar canales y páginas de entrada en GA4 antes de atribuir el cambio al SEO.','Revisar qué páginas de entrada sostuvieron el aumento.'],
  ['keyEvents','Eventos clave',14,'Comprobar la configuración de eventos y sus páginas de origen en GA4.','Contrastar los eventos registrados con el objetivo comercial configurado.']
];
export const method='Se ajusta una tendencia robusta a las diferencias entre días separados por una semana y un nivel para cada día de la semana. El pronóstico suma los siete días siguientes a la fecha del informe. Se contrasta con semanas reservadas en orden cronológico y con repetir la última semana.';
const confidenceNote='El rango usa el error absoluto histórico de los totales semanales en la validación, con un margen mínimo de una unidad. La confianza resume disponibilidad y error histórico. El rango no ofrece una probabilidad garantizada.';
const isClosed=r=>r&&r.final!==false&&r.isFinal!==false&&r.es_final!==false&&r.is_final!==false&&r.preliminary!==true&&r.observed!==false&&r.dataState!=='all'&&r.dataState!=='hourly_all';

function searchSeries(site,chart){
  // Model one provenance for the whole window. A sample of queries cannot measure total traffic.
  if(site.demo&&!(site.totals||[]).length)return {rows:chart?.series||[],source:'Demostración · búsquedas'};
  if(!(site.totals||[]).length&&['CSV','Detalle de Search Console'].includes(chart?.source)){
    const capped=new Set(site.cappedDays||[]);
    return {rows:chart.series.filter(r=>chart.source==='CSV'||!capped.has(r.date)),source:'Muestra de consultas · '+chart.source};
  }
  return {rows:site.totals||[],source:site.demo?'Demostración · búsquedas':'Search Console · totales del sitio'};
}

function weeklyPrediction(data,gap){
  const n=data.length;
  const slopes=data.slice(7).map((v,i)=>(v-data[i])/7);
  const slope=median(slopes);
  const levels=Array.from({length:7},(_,weekday)=>{
    const intercepts=[];
    for(let i=weekday;i<n;i+=7)intercepts.push(data[i]-slope*i);
    return median(intercepts);
  });
  return sum(Array.from({length:7},(_,k)=>{
    const index=n+gap+k;
    return Math.max(0,levels[index%7]+index*slope);
  }));
}

/** Walk-forward folds with disjoint 7-day test windows and the SAME publication delay as the live forecast. */
function validate(values,gap){
  const errors=[],naiveErrors=[],targets=[];
  for(let end=values.length;end>=MIN_TRAIN+gap+WEEK;end-=WEEK){
    const cutoff=end-WEEK-gap;
    const train=values.slice(0,cutoff),actual=sum(values.slice(end-WEEK,end));
    errors.push(Math.abs(weeklyPrediction(train,gap)-actual));
    naiveErrors.push(Math.abs(sum(train.slice(-7))-actual));targets.push(actual);
  }
  const n=errors.length;
  if(!n)return null;
  const ordered=[...errors].sort((a,b)=>a-b);
  return {weeks:n,mae:sum(errors)/n,baselineMae:sum(naiveErrors)/n,wape:sum(targets)>0?100*sum(errors)/sum(targets):null,
    radius:Math.max(1,ordered[Math.ceil(0.9*n)-1])};
}

function analyzeMetric([key,label,minimum,whenDown,whenUp],records,source,asOf,sourceDay){
  const days=new Map(),duplicates=new Set();
  for(const r of records){
    if(!validDay(r.date)||r.date>=sourceDay||!isClosed(r)||!Number.isFinite(r[key])||r[key]<0||
       (r.demo&&!source.startsWith('Demostración')))continue;
    if(days.has(r.date)&&days.get(r.date)!==r[key])duplicates.add(r.date);
    days.set(r.date,r[key]);
  }
  for(const date of duplicates)days.delete(date);
  const lastDataAt=[...days.keys()].sort().at(-1)||null;
  const values=[];
  if(lastDataAt)for(let i=0;i<MAX_HISTORY;i++){
    const day=shiftDay(lastDataAt,-i);if(!days.has(day))break;
    values.unshift(days.get(day));
  }
  const out={key,label,source,availableDays:values.length,lastDataAt,status:'observacion',confidence:'sin estimar',reason:'Faltan observaciones diarias finales para esta métrica.',change:null,forecast:null,backtest:null};
  if(!lastDataAt)return out;
  const gap=elapsed(lastDataAt,asOf);
  if(values.length>=14){
    const previous=sum(values.slice(-14,-7)),current=sum(values.slice(-7)),delta=round(current-previous),percent=previous>0?round(100*delta/previous):null;
    const interpretation=label+' entre '+shiftDay(lastDataAt,-6)+' y '+lastDataAt+': '+round(current)+' frente a '+round(previous)+' en los siete días anteriores'+(percent===null?'.':' ('+(percent>0?'+':'')+percent+' %).');
    out.change={previous:round(previous),current:round(current),delta,percent,previousStart:shiftDay(lastDataAt,-13),previousEnd:shiftDay(lastDataAt,-7),
      start:shiftDay(lastDataAt,-6),end:lastDataAt,interpretation,next:Math.min(previous,current)<minimum/4?'Acumular más observaciones antes de cambiar la página.':delta<0?whenDown:delta>0?whenUp:'Continuar el seguimiento con la misma definición de métrica.'};
  }
  if(gap>4){out.reason='La última observación final es del '+lastDataAt+'. Actualizar la fuente antes de proyectar la semana próxima.';return out;}
  const needed=MIN_TRAIN+MIN_VALIDATION*WEEK+gap;
  if(values.length<needed){out.reason='Hay '+values.length+' días consecutivos hasta '+lastDataAt+'. Se requieren al menos '+needed+' para entrenar y validar con este retraso de publicación.';return out;}
  if(sum(values.slice(-28))<minimum){out.reason='Muestra insuficiente para proyectar '+label.toLowerCase()+'. Se requieren '+minimum+' registros acumulados en los últimos 28 días.';return out;}
  const v=validate(values,gap);
  out.backtest={weeks:v.weeks,mae:round(v.mae),wape:v.wape===null?null:round(v.wape),baselineMae:round(v.baselineMae)};
  if(v.wape===null||v.wape>40||v.mae>1+1.25*v.baselineMae){
    out.reason='La validación histórica mostró demasiado error o no sostuvo la comparación con repetir la última semana. Usar la comparación observada.';return out;
  }
  const estimate=weeklyPrediction(values,gap);
  out.status='proyeccion';out.reason='Proyección calculada con fechas completas y contrastada contra '+v.weeks+' semanas históricas.';
  out.confidence=v.weeks>=6&&v.wape<=15?'alta':v.weeks>=4&&v.wape<=25?'media':'baja';
  out.forecast={start:shiftDay(asOf,1),end:shiftDay(asOf,7),estimate:Math.round(estimate),low:Math.max(0,Math.floor(estimate-v.radius)),high:Math.ceil(estimate+v.radius)};
  return out;
}

export function analyzeStatistics(site,now=new Date(),detailChart=null){
  const asOf=localDay(now,'America/Santiago'),pacific=localDay(now,'America/Los_Angeles');
  const search=searchSeries(site,detailChart),analytics=site.analyticsDays||[];
  const series=metrics.map((m,i)=>i<2?analyzeMetric(m,search.rows,search.source,asOf,asOf<pacific?asOf:pacific):
    analyzeMetric(m,analytics,site.demo?'Demostración · Analytics 4':'Google Analytics 4',asOf,asOf));
  return {version:'semanal-robusto-1',asOf,method,confidenceNote,series};
}
