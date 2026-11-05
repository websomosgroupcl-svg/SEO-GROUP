const e=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>x==null?'Sin dato':Number(x).toLocaleString('es-CL',{maximumFractionDigits:1});
const targetText=t=>({google:'Google',ia:'IA',ambos:'Google e IA'})[t]||t;
const deviceText=d=>({mobile:'Móvil',desktop:'Computador',tablet:'Tablet'})[String(d||'').toLowerCase()]||d||'Sin especificar';
const empty=s=>'<p class="meta">'+e(s)+'</p>';
const list=(a,fn)=>'<ul class="editor-list">'+a.map(v=>'<li>'+fn(v)+'</li>').join('')+'</ul>';
const info=(k,v)=>'<div class="editor-field"><strong>'+e(k)+'</strong><p>'+e(v||'Por definir')+'</p></div>';

export function editorialShell(){return '<section class="panel editor-desk" id="editorial-desk"><header class="panel-head"><div><p class="eyebrow">Taller de contenido</p><h2>Ideas para el redactor</h2></div><button type="button" class="btn secondary compact" data-action="my-ai">Mi IA</button></header><p>Explora las búsquedas con evidencia. Tu IA personal puede convertirlas en títulos, enfoques y estructuras de artículos.</p><form data-ideas-form class="editor-controls"><label>Cantidad<input name="limit" type="number" value="3" min="1" max="20" required inputmode="numeric"></label><button class="btn secondary" type="submit">Ver oportunidades</button><button class="btn primary" type="submit" data-generate-ai disabled>Generar ideas con mi IA</button></form><p data-provider-note class="meta" role="status">Consultando tu proveedor…</p><div data-ideas-result aria-live="polite"></div></section>';}
export function mountEditorial(root,{site,userId,load,addTask}){
  let sequence=0, closed=false,provider=null,busy=false;
  const form=root.querySelector('[data-ideas-form]'), result=root.querySelector('[data-ideas-result]');
  const generate=form.querySelector('[data-generate-ai]'),note=root.querySelector('[data-provider-note]');
  load('mi-ia').then(status=>{
    if(closed)return;
    provider=status.provider;
    generate.disabled=!provider||busy;
    if(provider)generate.textContent='Generar con '+providerNames[provider];
    note.textContent=provider?'Cada solicitud envía hasta cinco temas, sus variantes y el objetivo editorial al proveedor. Usa la cuota de tu cuenta.':'Para generar ideas, añade una clave en Mi IA. Puedes consultar hasta veinte oportunidades del sitio sin conectar un proveedor.';
  }).catch(err=>{if(!closed)note.textContent=err.message;});
  function card(v,i){
    const label=v.action||'Revisar tema', c=v.potential||{}, obj=v.objective||site.businessGoal||'Por definir',metric=c.estimatedClicks;
    const longs=(v.longTail||[]), evidence=v.evidence||[];
    const words=longs.length?list(longs,k=>'<strong>'+e(k.keyword)+'</strong><small>'+e(k.observed?'Consulta observada':'Hipótesis editorial')+' · '+e(k.source)+'</small><p>'+e(k.why)+'</p>'):empty('Faltan variantes específicas con suficiente pertinencia. Valida preguntas reales antes de ampliar el tema.');
    const proof=evidence.length?list(evidence,r=>{
      const ctr=r.impressions>0&&Number.isFinite(r.clicks)?n(r.clicks/r.impressions*100)+' %':'Sin dato';
      return '<strong>'+e(r.query)+'</strong><small>'+e(r.source||'Fuente pendiente')+' · '+e(r.startDate||'Sin fecha')+(r.endDate&&r.endDate!==r.startDate?' – '+e(r.endDate):'')+'</small><small>País · '+e(r.country||'Sin especificar')+' &nbsp; Dispositivo · '+e(deviceText(r.device))+'</small><p>'+n(r.impressions)+' impresiones · '+n(r.clicks)+' clics · CTR '+ctr+' · posición media '+n(r.position)+'</p>';
    }):empty('Aún no se registran búsquedas que permitan medir demanda. La propuesta requiere validación.');
    return '<article class="editor-idea"><div class="editor-meta"><span class="eyebrow">Idea '+String(i+1).padStart(2,'0')+'</span><span class="badge">'+e(label)+'</span><span class="badge">'+e(targetText(v.target))+'</span></div><h3>'+e(v.draft?.title||v.title)+'</h3>'+(v.draft?'<p class="badge">Borrador de '+e(providerNames[v.draft.provider])+'</p>'+info('Enfoque para el redactor',v.draft.angle):'')+'<p>'+e(v.why)+'</p><div class="editor-fields">'+info('Keyword principal',v.keyword)+info('Objetivo',obj)+'</div><p class="meta break"><strong>Página</strong> · '+e(v.page||'Propuesta de nueva página')+'</p><details class="inspect-box"><summary>Long-tail y justificación ('+n(longs.length)+')</summary>'+words+'</details><details class="inspect-box"><summary>Potencial y evidencia</summary>'+info('Potencial editorial',c.label)+empty(c.description||'La valoración depende de los datos disponibles.')+(metric==null?'':info('Escenario condicionado al CTR de referencia',n(metric)+' clics adicionales en un período equivalente'))+proof+'</details><details class="inspect-box"><summary>Estructura y medición</summary>'+list(v.draft?.outline||v.outline||[],x=>e(x))+info('Llamada a la acción',v.cta)+info('Cómo comprobar el resultado',v.measure)+'</details><div class="actions"><button class="btn primary compact" data-idea-task="'+e(v.id)+'" data-draft="'+e(v.draft?.draftId||'')+'">Crear encargo y editar</button></div></article>';
  }
  async function submit(ev){
    ev.preventDefault();if(busy)return;
    const personal=ev.submitter===generate,request=++sequence;
    const limit=Number(new FormData(form).get('limit'));if(!Number.isInteger(limit)||limit<1||limit>20)return;
    if(personal&&(!provider||limit>5)){note.textContent=provider?'Elige de una a cinco ideas por solicitud de IA.':'Abre Mi IA y añade tu clave.';return;}
    busy=true;root.dataset.preserveWork='true';form.querySelector('button').disabled=generate.disabled=true;result.setAttribute('aria-busy','true');result.innerHTML=empty(personal?'Tu proveedor está preparando los borradores…':'Buscando oportunidades en el sitio y sus consultas…');
    try{
      const path='sites/'+encodeURIComponent(site.id);
      const d=personal?await load(path+'/editorial-ia','POST',{provider,userId,limit}):await load(path+'/editorial?limit='+limit);
      if(closed||request!==sequence)return;
      result.innerHTML='<div class="editor-result-head"><h3>'+n(d.ideas.length)+' de '+n(d.requested)+(personal?' ideas solicitadas':' oportunidades solicitadas')+'</h3><p class="meta">Disponibles con los datos actuales · '+n(d.available)+(d.asOf?' · Actualizado '+e(String(d.asOf).slice(0,10)):'')+(d.demo?' · Datos de ejemplo':'')+'</p><p>'+e(d.notice||'')+'</p></div>'+d.ideas.map(card).join('')+(d.ideas.length?'':empty('Añade los servicios del negocio, importa consultas o ejecuta una revisión para obtener nuevas propuestas.'));
    }catch(err){if(!closed)result.innerHTML='<p role="alert" class="error">'+e(err.message)+'</p>';}
    finally{busy=false;if(!closed){form.querySelector('button').disabled=false;generate.disabled=!provider;result.setAttribute('aria-busy','false');}}
  }
  async function click(ev){const b=ev.target.closest('[data-idea-task]');if(!b||b.disabled)return;b.disabled=true;try{await addTask({editorialId:b.dataset.ideaTask,...(b.dataset.draft?{draftId:b.dataset.draft}:{})});}catch(err){if(!closed){const m=document.createElement('p');m.setAttribute('role','alert');m.textContent=err.message;b.after(m);}}finally{b.disabled=false;}}
  form.addEventListener('submit',submit);root.addEventListener('click',click);
  return ()=>{closed=true;sequence++;form.removeEventListener('submit',submit);root.removeEventListener('click',click);};
}

export function analysisShell(){return '<section class="panel method-panel" id="metodo-analista" data-analysis><header class="panel-head"><div><p class="eyebrow">Método y evidencia</p><h2>Cómo analizamos esta web</h2></div></header><div data-analysis-body role="status">Leyendo el análisis más reciente…</div></section>';}
export function mountAnalysis(root,{site,load}){
  let closed=false, seq=0;
  const body=root.querySelector('[data-analysis-body]');
  async function refresh(){
    const id=++seq;
    try{
      const a=await load('sites/'+encodeURIComponent(site.id)+'/analysis');if(id!==seq||closed)return;
      const when=t=>{if(!t||!Number.isFinite(Date.parse(t)))return 'Sin revisión registrada';return new Date(t).toLocaleString('es-CL');};
      body.innerHTML='<p>'+e(a.schedule)+'</p><div class="editor-fields">'+info('Motor utilizado',a.mode==='estadistico-local+ollama'?'Análisis estadístico y priorización con '+(a.model||'Ollama'):'Analizador estadístico del sitio')+info('Última revisión procesada',when(a.lastRunAt))+info('Este informe',a.automatic?'Guardado al completar una revisión':'Calculado al abrir el informe')+'</div><p class="meta">'+e(a.aiStatus)+(a.demo?' · Demostración con datos ficticios.':'')+'</p>'+statisticalPanel(a.statistics)+'<div class="analysis-findings">'+(a.findings||[]).map(f=>'<article><span class="badge">'+e(f.source)+'</span><h3>'+e(f.title)+'</h3><p>'+e(f.meaning)+'</p>'+info('Qué hacer',f.next)+'<small class="break">'+e(Array.isArray(f.evidence)?f.evidence.join(' · '):f.evidence)+'</small></article>').join('')+'</div>'+(!(a.findings||[]).length?empty('Aún se necesita evidencia para interpretar cambios en esta web.'):'')+
      '<details class="inspect-box"><summary>Historial del análisis</summary>'+((a.history||[]).length?list(a.history,h=>e(when(h.at))+' · '+e(h.mode)+' · '+n(h.count)+' hallazgos'):empty('El historial aparecerá después de ejecutar una revisión.'))+'</details>';
    }catch(err){if(!closed)body.innerHTML='<p class="error">'+e(err.message)+'</p><button type="button" data-analysis-retry class="btn secondary compact">Volver a intentar</button>';}
  }
  function click(ev){if(ev.target.closest('[data-analysis-retry]'))refresh();}
  root.addEventListener('click',click);refresh();return ()=>{closed=true;seq++;root.removeEventListener('click',click);};
}
import {providerNames} from './mi-ia.js';
import {statisticalPanel} from './estadistica-ui.js';
