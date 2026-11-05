import {shiftDay, validDay} from './sources.mjs';

const rules={
  clicks:{label:'clics',minimum:10,absolute:10},
  impressions:{label:'impresiones',minimum:200,absolute:100}
};
const usable=r=>validDay(r.date)&&r.final!==false&&r.isFinal!==false&&r.preliminary!==true&&
  [r.clicks,r.impressions].every(n=>Number.isFinite(n)&&n>=0)&&r.clicks<=r.impressions;
const pct=(before,after)=>Math.round(100*(after-before)/before);

// A missing Search Console row is unknown. Neither totals nor page snapshots fill gaps with zero.
function weeks(days,end){
  const prior={clicks:0,impressions:0},recent={clicks:0,impressions:0};
  for(let offset=-13;offset<=0;offset++){
    const row=days.get(shiftDay(end,offset));if(!row||!usable(row))return null;
    const window=offset<-6?prior:recent;
    window.clicks+=row.clicks;window.impressions+=row.impressions;
  }
  return {prior,recent};
}

function examplePage(site,end,metric,sign){
  const start=shiftDay(end,-13);
  if((site.cappedDays||[]).some(d=>d>=start&&d<=end))return null;
  const pages=new Map();
  for(const r of site.rows||[]){
    if(r.source!=='Search Console'||!r.page||r.date<start||r.date>end||!usable(r))continue;
    if(!pages.has(r.page))pages.set(r.page,new Map());
    const days=pages.get(r.page),v=days.get(r.date)||{date:r.date,clicks:0,impressions:0};
    v.clicks+=r.clicks;v.impressions+=r.impressions;days.set(r.date,v);
  }
  let page=null,best=0;
  for(const [url,days] of pages){
    if(days.size!==14)continue;
    const stats=weeks(days,end);if(!stats)continue;
    const change=sign*(stats.recent[metric]-stats.prior[metric]);
    if(change>best){best=change;page=url;}
  }
  return page;
}

/** Consume only after a successful final-data sync. Persist state to avoid an alert on every moving window. */
export function searchTrend(site,end,at){
  const state={...(site.performanceState||{})},alerts=[];
  if(!validDay(end)||!at||end>at.slice(0,10)||end<shiftDay(at.slice(0,10),-7)||state.end>end)return {state,alerts};
  const totals=new Map((site.totals||[]).map(r=>[r.date,r]));
  const stats=weeks(totals,end);
  if(!stats||Math.min(stats.prior.impressions,stats.recent.impressions)<200)return {state,alerts};
  state.end=end;
  const period={beforeStart:shiftDay(end,-13),beforeEnd:shiftDay(end,-7),afterStart:shiftDay(end,-6),afterEnd:end};
  for(const [metric,r] of Object.entries(rules)){
    const a=stats.prior[metric],b=stats.recent[metric],diff=b-a;
    if(a<r.minimum)continue;
    const direction=Math.abs(diff)>=r.absolute&&Math.abs(diff)/a>=0.30 ? (diff>0?'subida':'caída') : 'estable';
    const changed=state[metric]!==direction;
    state[metric]=direction;
    if(!changed||direction==='estable')continue;
    const page=examplePage(site,end,metric,Math.sign(diff));
    const follow=direction==='subida'?'Revisar las consultas que ganaron visibilidad y conservar los apartados que responden a ellas.':
      metric==='clicks'?'Contrastar consultas y posición media. Si las impresiones se mantienen, revisar intención y título.':
      'Comparar la demanda del período y revisar acceso e indexación de las páginas afectadas.';
    const message=r.label+': '+a+' ('+period.beforeStart+' a '+period.beforeEnd+') → '+b+' ('+period.afterStart+' a '+end+'), '+pct(a,b)+' %. '+follow+(page?' Página con variación en el detalle observado: '+page:'');
    alerts.push({title:(direction==='subida'?'Aumento':'Caída')+' de '+r.label+' en Google',message,url:page||site.url,scope:page?'Página de referencia':'Sitio',period,
      source:'Search Console',metric,direction,before:a,after:b,kind:'rendimiento',at});
  }
  return {state,alerts};
}
