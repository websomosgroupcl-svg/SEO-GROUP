import {healthGraphic,handleGraphicEvent} from './graficos.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'—':new Intl.NumberFormat('es-CL').format(v);
const stamp=v=>{const d=new Date(v);return v&&Number.isFinite(+d)?d.toLocaleString('es-CL'):'Sin fecha';};
const indexNames={eligible:'Apta según HTML',noindex:'Excluida por noindex',canonical:'Otra canónica',redirect:'Redirigida',http_error:'Error HTTP',unknown:'Sin comprobar'};
const safeCsv=v=>{let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const cell=(k,v)=>'<div class="inspect-field"><small>'+esc(k)+'</small><p>'+esc(v??'Sin dato')+'</p></div>';
const box=(title,content)=>'<details class="inspect-box"><summary>'+esc(title)+'</summary>'+content+'</details>';
const noData=t=>'<p class="meta">'+esc(t)+'</p>';
const tabLabels={urls:'URLs',issues:'Problemas',health:'Salud por dimensión',compare:'Comparar revisiones'};
const uiButton=(t,a,v='',cls='secondary compact')=>'<button type="button" class="btn '+cls+'" data-inspect="'+a+'" data-value="'+esc(v)+'">'+esc(t)+'</button>';
const rank={alta:0,media:1,baja:2}, destinations={google:'Google',ia:'IA',ambos:'Google e IA'};

export function mountInspector(root,{site,load,show,hero,onData}){
  const state={view:'urls',offset:0,limit:30,q:'',status:'',indexability:'',severity:'',data:null};
  let seq=0, closed=false;
  root.innerHTML='<header class="panel-head"><div><p class="eyebrow">Auditoría técnica</p><h2>Inspector del sitio</h2></div>'+uiButton('Exportar URLs filtradas','export')+'</header><div class="inspect-tabs" role="group" aria-label="Contenido del inspector">'+Object.entries(tabLabels).map(([k,v])=>uiButton(v,'tab',k)).join('')+'</div><div data-inspect-filters></div><div data-inspect-result aria-live="polite" aria-busy="true">'+noData('Leyendo las páginas de la última revisión…')+'</div>';
  const results=root.querySelector('[data-inspect-result]'), filters=root.querySelector('[data-inspect-filters]');
  const params=(extra={})=>new URLSearchParams({offset:String(state.offset),limit:String(state.limit),q:state.q,status:state.status,indexability:state.indexability,...extra}).toString();
  const get=p=>load('sites/'+encodeURIComponent(site.id)+'/audit?'+p);
  const filterPanel=()=>'<form class="inspect-filter" data-inspect-form><label>URL o título<input type="search" name="q" value="'+esc(state.q)+'" placeholder="Buscar en las páginas revisadas"></label><label>Respuesta HTTP<select name="status"><option value="">Todas</option>'+['2xx','3xx','4xx','5xx'].map(k=>'<option '+(state.status===k?'selected':'')+'>'+k+'</option>').join('')+'</select></label><label>Indexabilidad<select name="indexability"><option value="">Todas</option>'+Object.entries(indexNames).map(([k,v])=>'<option value="'+k+'" '+(k===state.indexability?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label><button class="btn secondary compact">Filtrar</button></form>';
  const issuesList=(list=[])=>list.length?[...list].sort((a,b)=>Number(Boolean(a.pendingCheck))-Number(Boolean(b.pendingCheck))||(rank[a.severity]??3)-(rank[b.severity]??3)).map(i=>{
    const action=i.pendingCheck?'<p class="meta">Esta URL necesita otra comprobación antes de confirmar el problema.</p>':'<button type="button" class="btn secondary compact" data-action="make-issue" data-id="'+esc(i.id)+'">Crear mejora</button>';
    const context=(i.target?cell('Destino de la mejora',destinations[i.target]||i.target):'')+(i.expectedOutcome?cell('Resultado esperado',i.expectedOutcome):'');
    return '<article class="inspect-issue"><div><p class="eyebrow">'+(i.pendingCheck?'Pendiente de comprobar':'Confirmado')+' · Prioridad '+esc(i.severity||'sin definir')+'</p><h3>'+esc(i.title)+'</h3><p class="meta break">'+esc(i.url)+'</p></div>'+box('Evidencia y corrección',cell(i.pendingCheck?'Evidencia de la última comprobación':'Evidencia',i.evidence)+cell('Mejora recomendada',i.fix)+context)+action+'</article>';
  }).join(''):noData('Sin hallazgos registrados para esta selección.');
  function display(){
    const d=state.data;if(!d)return;
    root.querySelectorAll('[data-inspect="tab"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===state.view)));
    filters.innerHTML=state.view==='urls'?filterPanel():state.view==='issues'?'<label class="inspect-severity">Prioridad<select data-severity><option value="">Todas</option>'+['alta','media','baja'].map(k=>'<option value="'+k+'" '+(state.severity===k?'selected':'')+'>'+esc(k)+'</option>').join('')+'</select></label>':'';
    if(state.view==='urls'){
      const inv=d.inventory||{}, rows=inv.rows||[];
      const table=rows.length?'<div class="table-wrap"><table class="inventory-table"><thead><tr><th>Página</th><th>HTTP</th><th>Indexabilidad</th><th>Profundidad</th><th>Entradas / salidas</th></tr></thead><tbody>'+rows.map(p=>'<tr><td><button type="button" class="link-btn break" data-inspect="page" data-value="'+esc(p.url)+'">'+esc(p.title||p.url)+'</button><small class="break">'+esc(p.url)+'</small></td><td>'+num(p.status)+'</td><td>'+esc(indexNames[p.indexability]||p.indexability||'Sin comprobar')+'</td><td>'+num(p.depth)+'</td><td>'+num(p.inlinks)+' / '+num(p.outlinks)+'</td></tr>').join('')+'</tbody></table></div>':noData('No hay páginas con estos filtros. Si es la primera visita, ejecuta una revisión.');
      results.innerHTML=table+'<div class="table-pages"><small>'+num(inv.total)+' páginas coincidentes'+(rows.length?' · '+num(inv.offset+1)+'–'+num(inv.offset+rows.length):'')+'</small><div class="actions">'+(state.offset?uiButton('Anterior','offset',Math.max(0,state.offset-state.limit)):'')+(state.offset+rows.length<inv.total?uiButton('Siguiente','offset',state.offset+state.limit):'')+'</div></div><p class="meta">La indexabilidad describe señales del HTML recibido. La indexación efectiva depende de Google. Los enlaces y la profundidad corresponden a las páginas rastreadas.</p>';
    }else if(state.view==='health'){
      results.innerHTML='<h3>Salud por dimensión</h3><p class="meta">'+(site.demo?'Muestra de demostración. ':'Última revisión técnica. ')+'Elige una dimensión para ver las reglas comprobadas. El puntaje pondera las reglas aprobadas sobre las evaluadas.</p>'+healthGraphic(d)+box('Cobertura y límites',coverage(d));
    }else if(state.view==='issues'){
      const list=(d.issues||[]).filter(i=>!state.severity||i.severity===state.severity);
      const current=list.filter(i=>!i.pendingCheck), pending=list.length-current.length;
      results.innerHTML='<h3 data-issues-title tabindex="-1">Problemas de la revisión</h3><p class="meta">'+num(current.length)+(current.length===1?' confirmado':' confirmados')+' · '+num(pending)+(pending===1?' pendiente de comprobar':' pendientes de comprobar')+(state.severity?' · Prioridad '+esc(state.severity):'')+'</p>'+
        (d.issueCount>d.issues.length?'<p class="inline-note">La lista incluye '+num(d.issues.length)+' de '+num(d.issueCount)+' incidencias calculadas.</p>':'')+issuesList(list);
    }else{
      const c=d.comparison||{}, summary=c.comparable?'Comprobaciones comparables entre '+stamp(c.previousAt)+' y '+stamp(c.currentAt)+'.':c.reason||'Se necesitan dos revisiones comparables del mismo alcance.';
      const changeList=(title,list=[])=>'<section><h3>'+title+' · '+num(list.length)+'</h3>'+list.map(v=>'<p><strong>'+esc(v.title||v.rule)+'</strong><br><small class="break">'+esc(v.url)+'</small></p>').join('')+'</section>';
      results.innerHTML='<p>'+esc(summary)+'</p>'+(c.comparable?'<div class="inspect-compare">'+changeList('Problemas nuevos',c.added)+changeList('Resueltos',c.resolved)+'</div>':'')+box('Cobertura y límites',coverage(d));
    }
    results.setAttribute('aria-busy','false');
  }
  function coverage(d){
    const errors=(d.errors||[]).map(x=>'<p class="meta break">'+esc(typeof x==='string'?x:[x.url,x.message].filter(Boolean).join(' · '))+'</p>').join('');
    const blocks=(d.blocked||[]).map(x=>'<p class="meta break">'+esc(typeof x==='string'?x:x.url)+'</p>').join('');
    return cell('URLs en la muestra',num(d.coverage?.pages))+cell('Comprobaciones evaluadas',num(d.coverage?.checked))+
      cell('Límites de extracción','Hasta '+num(d.limits?.maxPages)+' páginas, '+num(d.limits?.maxLinksPerPage)+' enlaces y '+num(d.limits?.maxImagesPerPage)+' imágenes por página revisada.')+
      '<p>'+esc(d.coverage?.partial?'Cobertura parcial. Se muestran solo las direcciones comprobadas.':'Comprobaciones de la última muestra guardada.')+'</p>'+
      cell('URLs bloqueadas registradas',num(d.blocked?.length||0))+blocks+cell('Errores registrados',num(d.errors?.length||0))+errors;
  }
  async function refresh(){
    const own=++seq;results.setAttribute('aria-busy','true');
    try{const d=await get(params());if(closed||own!==seq)return;d.issues=onData?.(d)||d.issues;state.data=d;display();}
    catch(err){if(closed||own!==seq)return;results.setAttribute('aria-busy','false');results.innerHTML='<p class="error">'+esc(err.message)+'</p>'+uiButton('Volver a intentar','retry');}
  }
  const list=(items,render,none='Sin datos registrados.')=>(items||[]).length?'<ul class="inspect-list">'+items.map(x=>'<li>'+render(x)+'</li>').join('')+'</ul>':noData(none);
  function pageDetail(p){
    const summary='<div class="inspect-grid">'+cell('URL',p.url)+cell('HTTP',p.status)+cell('Contenido recibido',p.contentType)+cell('Indexabilidad',indexNames[p.indexability]||p.indexability)+cell('Profundidad',p.depth)+cell('Última revisión',stamp(p.checkedAt))+'</div>';
    let visit='';try{const u=new URL(p.url);if(['http:','https:'].includes(u.protocol)&&u.origin===new URL(site.url).origin)visit='<a class="btn secondary compact" href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">Abrir página en otra pestaña</a>';}catch{}
    return summary+visit+box('Título, descripción y encabezados',cell('Título',p.title||'Ausente')+cell('Descripción',p.description||'Ausente')+cell('Canónica',p.canonical||'Sin declaración')+cell('Palabras',p.wordCount)+list(p.headings||[],h=>'H'+esc(h.level)+' · '+esc(h.text)))+
      box('Enlaces que recibe y enlaza',cell('Enlaces entrantes',p.inlinks)+list(p.incoming,x=>esc(x.url)+' · '+esc(x.anchor||'Sin texto'))+cell('Enlaces salientes',p.outlinks)+list(p.outgoing,x=>esc(x.url)+' · '+esc(x.anchor||'Sin texto')+' · '+esc(x.status||'HTTP sin comprobar')+(x.nofollow?' · nofollow':'')))+
      box('Redirecciones, robots e idioma',cell('Destino final',p.finalUrl)+cell('Meta robots',p.metaRobots||'Sin instrucción registrada')+cell('X-Robots-Tag',p.headerRobots||'Sin cabecera registrada')+cell('Idioma declarado',p.lang)+list(p.redirects,x=>esc(x.status)+' · '+esc(x.url)+' → '+esc(x.to)))+
      box('Imágenes y texto alternativo',list(p.images,x=>esc(x.url)+' · '+esc(x.alt===null?'Atributo alt ausente':x.alt===''?'Alt vacío':x.alt||'Sin dato')))+
      box('Idiomas y datos estructurados',list(p.hreflang,x=>esc(x.lang)+' · '+esc(x.url))+cell('Tipos de datos estructurados',(p.schema?.types||[]).join(', ')||'Sin tipos detectados')+cell('Bloques JSON-LD inválidos',p.schema?.invalid))+
      box('Problemas de esta URL',issuesList((p.issues||[]).map(i=>{const previous=site.audit?.issues?.find(x=>x.id===i.id);return {target:previous?.target,expectedOutcome:previous?.expectedOutcome,...i};})));
  }
  async function exportCsv(){
    const filter=params({offset:0,limit:50}), rows=[];
    let total=Infinity;
    for(let at=0;at<total;){const q=new URLSearchParams(filter);q.set('offset',String(at));const d=await get(q.toString());if(closed)return;const batch=d.inventory?.rows||[];total=Math.min(total,d.inventory?.total??0);rows.push(...batch);at+=batch.length;if(!batch.length)break;}
    const keys=['url','status','title','description','h1','canonical','indexability','depth','inlinks','outlinks','checkedAt'];
    const text=['URL;HTTP;Título;Descripción;H1;Canónica;Indexabilidad;Profundidad;Entrantes;Salientes;Revisada',...rows.map(p=>keys.map(k=>safeCsv(k==='indexability'?indexNames[p[k]]||p[k]:p[k])).join(';'))].join('\r\n');
    const a=document.createElement('a'),href=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8;'}));a.href=href;a.download='auditoria-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  async function click(ev){if(handleGraphicEvent(ev))return;const b=ev.target.closest('[data-inspect]');if(!b||b.disabled)return;const a=b.dataset.inspect,v=b.dataset.value;b.disabled=true;
    try{root.dataset.preserveWork='true';if(a==='tab'){state.view=v;if(state.data)display();else await refresh();}
      else if(a==='retry')await refresh();
      else if(a==='offset'){state.offset=Number(v);await refresh();}
      else if(a==='page'){const d=await get(params({url:v}));if(!closed&&d.page)show('Ficha de la URL',pageDetail(d.page));}
      else if(a==='export')await exportCsv();
    }catch(err){if(!closed)show('No se pudo completar',noData(err.message));}finally{b.disabled=false;}
  }
  function submit(ev){if(!ev.target.matches('[data-inspect-form]'))return;ev.preventDefault();root.dataset.preserveWork='true';const f=new FormData(ev.target);Object.assign(state,Object.fromEntries(f),{offset:0});refresh();}
  function change(ev){if(ev.target.matches('[data-severity]')){state.severity=ev.target.value;display();}}
  async function jump(ev){
    if(!ev.target.closest('[data-inspect-jump]'))return;
    root.dataset.preserveWork='true';state.view='issues';state.severity='';
    if(state.data)display();else await refresh();
    if(closed||state.view!=='issues')return;
    (root.querySelector('[data-issues-title]')||root.querySelector('[data-inspect="retry"]'))?.focus();
  }
  hero?.addEventListener('click',jump);
  root.addEventListener('click',click);root.addEventListener('keydown',handleGraphicEvent);root.addEventListener('submit',submit);root.addEventListener('change',change);refresh();
  return ()=>{closed=true;seq++;hero?.removeEventListener('click',jump);root.removeEventListener('click',click);root.removeEventListener('keydown',handleGraphicEvent);root.removeEventListener('submit',submit);root.removeEventListener('change',change);};
}
