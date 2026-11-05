const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>typeof n==='number'&&Number.isFinite(n);
const fmt=n=>number(n)?n.toLocaleString('es-CL',{maximumFractionDigits:1}):'Sin datos';
const shortDate=date=>{const d=new Date(date+'T12:00:00');return Number.isFinite(+d)?d.toLocaleDateString('es-CL',{day:'numeric',month:'short'}):'Sin fecha';};
const pct=n=>number(n)?fmt(n)+' %':'Sin evaluar';
const clamp=n=>Math.max(0,Math.min(100,n));
const colors=['#67519b','#39838a','#ba683e','#997633','#8e587e'];
const button=(i,body,selected=false)=>'<button type="button" data-gfx-select="'+i+'" aria-pressed="'+selected+'">'+body+'</button>';
const details=items=>'<div class="gfx-details" aria-live="polite" aria-atomic="true">'+items.map((html,i)=>'<div data-gfx-detail="'+i+'"'+(i?' hidden':'')+'>'+html+'</div>').join('')+'</div>';
const track=(width,tone=colors[0])=>number(width)?'<span class="gfx-track" aria-hidden="true"><i style="width:'+clamp(width)+'%;background:'+tone+'"></i></span>':'<span class="gfx-track is-unknown" aria-hidden="true"></span>';
const copy=(heading,text)=>'<strong>'+esc(heading)+'</strong><p>'+esc(text)+'</p>';
const group=(name,body)=>'<div class="gfx" data-gfx role="group" aria-label="'+esc(name)+'">'+body+'</div>';

const intents={
  informacional:['Busca una respuesta','Revisa si las páginas responden a la pregunta y muestran ejemplos comprobables.'],
  transaccional:['Quiere realizar una acción','Comprueba si la página permite comprar, reservar o pedir una cotización.'],
  comercial:['Está comparando opciones','Ayuda a decidir con precios, diferencias y condiciones que el equipo pueda verificar.'],
  navegacional:['Busca una marca o un destino','Comprueba que la página oficial o de contacto sea fácil de encontrar.'],
  'por revisar':['Intención por revisar','Lee las consultas de esta categoría en Keywords y comprueba qué necesidad expresan.']
};
export function intentGraphic(intent=[],unit='impressions') {
  const unitLabel=unit==='queries'?'consultas':'impresiones';
  const rows=intent.filter(r=>number(r[unit])&&r[unit]>0),total=rows.reduce((sum,r)=>sum+r[unit],0);
  if(!total)return '<p class="md-empty">Para calcular esta distribución se requieren consultas fechadas con impresiones.</p>';
  let offset=0;
  const arcs=rows.map((r,i)=>{
    const share=r[unit]*100/total;
    const length=rows.length===1?share:Math.max(share*.62,share-.8),color=colors[i%colors.length];
    const part='<circle data-gfx-slice="'+i+'" class="gfx-slice'+(i===0?' is-chosen':'')+'" cx="60" cy="60" r="45" pathLength="100" fill="none" stroke="'+color+'" stroke-dasharray="'+length+' '+(100-length)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 60 60)"><title>'+esc(r.label)+' · '+pct(share)+'</title></circle>';
    offset+=share;return part;
  }).join('');
  const legend=rows.map((r,i)=>button(i,'<i class="gfx-dot" style="background:'+colors[i%colors.length]+'"></i><span>'+esc(r.label)+'</span><b>'+pct(r[unit]*100/total)+'</b>',i===0)).join('');
  const caption=rows.map(r=>{
    const intent=Object.hasOwn(intents,r.label)?intents[r.label]:intents['por revisar'];
    return copy(intent[0],fmt(r[unit])+' de '+fmt(total)+' '+unitLabel+' del detalle observado. '+intent[1]);
  });
  const centre=total<10000?fmt(total):Intl.NumberFormat('es-CL',{notation:'compact',maximumFractionDigits:1}).format(total);
  return group('Distribución de las '+unitLabel+' por intención','<div class="gfx-donut-layout"><div class="gfx-donut"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">'+arcs+'</svg><div aria-hidden="true"><strong>'+centre+'</strong><span>'+unitLabel+'</span></div></div><div class="gfx-legend">'+legend+'</div></div>'+details(caption));
}

export function compareGraphic(d,options) {
  const entries=options.filter(([k])=>d.kpis?.[k]);
  if(!entries.length)return '';
  const legend=entries.map(([,name],i)=>button(i,esc(name),i===0)).join('');
  const panels=entries.map(([key,name])=>{
    const k=d.kpis[key], c=k.coverage||{}, expected=c.expected??d.days;
    // The API only exposes the previous value for comparisons with complete coverage.
    const comparable=number(k.previous)&&number(k.value);
    const max=Math.max(1,number(k.value)?k.value:0,number(k.previous)?k.previous:0);
    const bars=[[d.previousStart,d.previousEnd,'Anterior',k.previous,c.previous,colors[1]],[d.start,d.end,'Actual',k.value,c.current,colors[0]]].map(([from,to,label,n,count,color])=>
      '<div class="gfx-compare-row"><div><strong>'+label+'</strong><small>'+shortDate(from)+' – '+shortDate(to)+'</small></div>'+track(number(n)?n*100/max:null,color)+'<div class="gfx-end"><b>'+(!number(n)&&count>0?'Sin comparar':fmt(n))+'</b><small>'+fmt(count)+'/'+fmt(expected)+' días</small></div></div>').join('');
    const delta=k.value-k.previous;
    const summary=comparable?(delta===0?'El total coincide en ambos períodos.':fmt(Math.abs(delta))+' '+name.toLocaleLowerCase('es')+(delta>0?' más':' menos')+' que en el período anterior.'):'La diferencia requiere dos períodos completos. Revisa la cobertura de cada uno.';
    const source=['sessions','keyEvents'].includes(key)?(d.connections?.analytics?.label||'Analytics 4'):(typeof d.source==='string'?d.source:'Búsqueda');
    return '<div class="gfx-period-bars">'+bars+'</div>'+copy(summary,'Fuente · '+source+(['sessions','keyEvents'].includes(key)?'. Incluye todos los canales medidos.':'.'));
  });
  return group('Comparar métricas entre períodos','<div class="gfx-chips">'+legend+'</div>'+details(panels));
}

export function enginesGraphic(engines=[]) {
  if(!engines.length)return '';
  const entries=engines.map((r,i)=>button(i,'<span class="gfx-engine-name">'+esc(r.engine)+'</span><span class="gfx-paired">'+[['Menciones',r.mentionRate,colors[0]],['Citas',r.citationRate,colors[1]]].map(([name,rate,color])=>'<span><small>'+name+'</small>'+track(rate,color)+'<b>'+pct(rate)+'</b></span>').join('')+'</span>',i===0)).join('');
  const panels=engines.map(r=>{
    const detail=(label,count,known)=>number(known)&&known>0?label+' en '+fmt(count)+' de '+fmt(known)+' respuestas evaluadas.':'Faltan respuestas evaluadas para '+label.toLocaleLowerCase('es')+'.';
    return copy(r.engine+' · '+fmt(r.samples)+' respuestas registradas',detail('Menciones',r.mentions,r.mentionsKnown)+' '+detail('Citas',r.citations,r.citationsKnown)+' Compara motores que hayan recibido preguntas equivalentes.');
  });
  return group('Menciones y citas por motor','<div class="gfx-engine-list">'+entries+'</div>'+details(panels));
}

export function healthGraphic(audit) {
  const dims=audit.dimensions||[];
  if(!dims.length)return '<p class="meta">Ejecuta una revisión para evaluar las dimensiones técnicas.</p>';
  const bars=dims.map((r,i)=>button(i,'<span>'+esc(r.label)+'</span>'+track(r.score,colors[i%colors.length])+'<b>'+(number(r.score)?fmt(r.score)+' / 100':'Sin evaluar')+'</b>',i===0)).join('');
  const panels=dims.map(r=>{
    const checks=(audit.checks||[]).filter(c=>c.dimension===r.id);
    const issues=(audit.issues||[]).filter(c=>c.dimension===r.id&&!c.pendingCheck);
    const selected=issues[0];
    const breakdownCounts=v=>fmt(v.passed)+(v.passed===1?' aprobada':' aprobadas')+' · '+fmt(v.failed)+(v.failed===1?' fallida':' fallidas')+' · '+fmt(v.skipped)+' sin evaluar';
    const intro=copy(r.label,breakdownCounts(r)+'.');
    const advice=selected?'<p><b>Por dónde empezar.</b> '+esc(selected.title)+'. '+esc(selected.fix)+'</p>':number(r.score)?'<p>No hay una incidencia confirmada en el listado de esta dimensión.</p>':'<p>La muestra necesita una comprobación aplicable para calcular esta puntuación.</p>';
    const breakdown=checks.length?'<details class="gfx-audit-checks"><summary>Ver reglas de esta dimensión</summary><ul>'+checks.map(c=>'<li><b>'+esc(c.label)+'</b><span>'+breakdownCounts(c)+'</span></li>').join('')+'</ul></details>':'';
    return intro+advice+breakdown;
  });
  return group('Puntuación técnica por dimensión','<div class="gfx-health">'+bars+'</div>'+details(panels));
}

// The SVG and its keyboard-accessible legend select the same detail.
export function handleGraphicEvent(ev) {
  const hit=ev.target.closest?.('[data-gfx-select],[data-gfx-slice]');
  const root=hit?.closest('[data-gfx]');
  if(!root)return false;
  const buttons=Array.from(root.querySelectorAll('[data-gfx-select]'));
  let index=Number(hit.dataset.gfxSelect??hit.dataset.gfxSlice);
  if(ev.type==='keydown'){
    const keys={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1,Home:-index,End:buttons.length-1-index};
    if(!Object.hasOwn(keys,ev.key))return false;
    ev.preventDefault();index=(index+buttons.length+keys[ev.key])%buttons.length;
  }
  buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  root.querySelectorAll('[data-gfx-detail]').forEach((el,i)=>{el.hidden=i!==index;});
  root.querySelectorAll('[data-gfx-slice]').forEach((el,i)=>el.classList.toggle('is-chosen',i===index));
  if(ev.type==='keydown'||hit.hasAttribute('data-gfx-slice'))buttons[index]?.focus({preventScroll:true});
  return true;
}
