import {mountInspector} from './inspector.js';
import {mountAnalysis,mountEditorial,analysisShell,editorialShell} from './redaccion.js';
import {companion} from './companions.js';
import {syncMascota,openMascota,creditMascota} from './mascota.js';
import {configurePersonalAI} from './mi-ia.js';
import {mountDiagnostico} from './diagnostico.js';
import {mountConnections} from './conexiones.js';
import {mountTeam} from './equipo.js';

(async function(){
  function takePrivateLink(){
    const match=/^#\/(activar-admin|unirse)(?:\/(.*))?$/.exec(location.hash);if(!match)return null;
    history.replaceState(null,'',location.pathname+location.search);
    return {kind:match[1],code:/^(?:[A-Za-z0-9_-]{43}|[a-f0-9]{64})$/.test(match[2]||'')?match[2]:null};
  }
  let privateLink=takePrivateLink();
  const $ = s => document.querySelector(s);
  const app = $('#app'), dialog = $('#modal'), notice = $('#notice');
  const state = { user:null, demoAvailable:false, sites:[], site:null, tab:'hoy', users:[], q:'', filter:'all',longTail:false,page:0 };
  let requestToken=0, timer, refreshTimer, dialogFocus, dialogAction, pending=false;
  const e = x => String(x ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = n => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)) ? Number(n).toLocaleString('es-CL',{maximumFractionDigits:1}):'—';
  const date = (v,time=false) => {if(!v) return 'Pendiente'; const d = new Date(v.length===10 ? v+'T12:00:00':v);return Number.isNaN(+d)?'Sin fecha':d.toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit'}:{})});};
  const paths = {globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',plus:'<path d="M12 4v16M4 12h16"/>',today:'<path d="M4 6h16v14H4zM4 10h16M8 3v5m8-5v5"/>',audit:'<path d="M4 5h16v14H4zM6 13h3l2-4 2 7 2-4h3"/>',keywords:'<circle cx="9" cy="10" r="6"/><path d="m14 15 5 6"/>',tasks:'<path d="M7 5h13M7 12h13M7 19h13M3 5h.1M3 12h.1M3 19h.1"/>',review:'<path d="M4 9a8 8 0 1 1 0 6m0-11v6h6"/>',settings:'<path d="M3 6h18M3 17h18"/><circle cx="8" cy="6" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',out:'<path d="M10 4H4v16h6m3-13 5 5-5 5m-5-5h10"/>',users:'<circle cx="9" cy="8" r="4"/><path d="M2 20c0-8 14-8 14 0m1-16c4 0 5 7 1 8m0 2c3 0 4 3 4 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M8 13h7m-7 4h7"/>',bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zm5 3h4"/>',home:'<path d="m3 11 9-8 9 8m-16 0v10h14V11"/>'};
  const icon=k=>`<svg class="icon-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${paths[k]||paths.file}</svg>`;
  const brand='<span class="brand"><img src="/isotipo.svg" alt="">SEOBESTIA</span>';
  const btn=(text,act,id='',css='secondary',ic='')=>`<button type="button" class="btn ${css}" data-action="${e(act)}" data-id="${e(id)}">${ic?icon(ic):''}${e(text)}</button>`;
  const badge=(text,css='')=>`<span class="badge ${css}">${e(text)}</span>`;
  const blank=text=>`<p class="empty">${e(text)}</p>`;
  const human=x=>({pending:'Pendiente',running:'En curso',done:'Finalizado',failed:'Fallido',demo:'Demostración',completa:'Completa',parcial:'Parcial'}[x]||String(x||'Pendiente').replaceAll('_',' '));
  const warn=s=>/crit|alta|error|fall|bloque|high/i.test(s)?'bad':/media|alert|pend|partial|parcial|warn/i.test(s)?'warn':/correct|complet|resuelt|ok|success|hech/i.test(s)?'good':'';
  // Route IDs remain stable so saved links still open the same place.
  const stages = [
    {key:'auditoria',label:'Auditar',hint:'Revisar la salud del sitio',icon:'audit'},
    {key:'keywords',label:'Keywords',hint:'Elegir búsquedas útiles',icon:'keywords'},
    {key:'tareas',label:'Mejoras',hint:'Trabajar en una página',icon:'tasks'},
    {key:'revisiones',label:'Medir',hint:'Seguir los resultados',icon:'review'}
  ];
  const sections=[['hoy','Plan del sitio'],...stages.map(s=>[s.key,s.label]),['conexiones','Conexiones'],['ajustes','Configuración']];
  let globalPage='sitios',createAfterLogin=false,connectionSource='gsc';
  const isDemoAccount=()=>Boolean(state.user?.email.endsWith('@local.example'));
  function workspaceNav(){
    const links=[['sitios','Mis sitios'],['diagnostico','Diagnóstico sin agregar']];
    if(state.user?.role==='admin'||isDemoAccount())links.push(['usuarios','Usuarios']);
    return '<nav class="global-nav" aria-label="Espacio del equipo">'+links.map(([page,label])=>'<a href="#/'+page+'" '+(!state.site&&page===globalPage?'aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>';
  }
  const stageNumber=key=>String(stages.findIndex(s=>s.key===key)+1).padStart(2,'0');
  const applied=t=>Boolean(t.appliedAt&&t.page&&['aplicada','en_seguimiento','cerrada'].includes(t.status));
  const drafting=t=>['pendiente','en_curso'].includes(t.status);
  const reviewing=s=>(s.jobs||[]).some(j=>['pending','running'].includes(j.status));
  function stageIntro(key,title,copy){return '<header class="step-intro"><p class="eyebrow">'+e(stages.some(s=>s.key===key)?'Paso '+stageNumber(key)+' de 04':key)+'</p><h1>'+e(title)+'</h1><p>'+e(copy)+'</p></header>';}
  function nextCard(k,title,copy,action){return '<section class="next-card"><div class="guide-copy"><p class="eyebrow">'+e(k)+'</p><h2>'+e(title)+'</h2><p>'+e(copy)+'</p>'+action+'</div></section>';}
  const advance=(to,label)=>btn(label,'tab',to,'primary','arrow');
  const ruleNames={description:'Añade una descripción a esta página',title:'Dale un título claro a esta página',h1:'Añade un encabezado que explique la página',http:'Comprueba por qué falla esta dirección',broken:'Corrige los enlaces que llevan a un error',noindex:'Comprueba si esta página debe aparecer en Google',canonical:'Revisa la página que indicas como principal',alt:'Describe las imágenes que necesitan texto alternativo','duplicate-title':'Distingue estas páginas con títulos propios','duplicate-description':'Escribe una descripción propia para esta página','duplicate-content':'Comprueba por qué dos páginas tienen el mismo texto',lang:'Indica el idioma del contenido',chain:'Enlaza directamente al destino final'};
  const issueName=i=>ruleNames[i.rule]||i.title;
  const issueOrder={alta:0,media:1,baja:2};
  const orderedIssues=s=>[...(s.audit?.issues||[])].sort((a,b)=>(issueOrder[a.severity]??3)-(issueOrder[b.severity]??3));
  const detailLine=(name,value)=>'<div class="detail"><h3>'+e(name)+'</h3><p class="break">'+e(value)+'</p></div>';
  const urlLabel=u=>{try{const url=new URL(u);return url.host+url.pathname;}catch{return u||'Página por definir';}};
  let openEditor=null, focusOnNavigation=false, unmountMetrics=null;
  let moduleCleanups=[];
  function stopMetrics(){unmountMetrics?.();unmountMetrics=null;moduleCleanups.forEach(fn=>fn());moduleCleanups=[];}
  async function startMetrics(container,site){
    try {
      const {mountDashboard}=await import('./medir.js');
      if(container.isConnected)unmountMetrics=mountDashboard(container,{site});
    }catch{if(container.isConnected)container.innerHTML='<p role="alert" class="empty">No se pudo abrir el panel de medición. '+btn('Intentar otra vez','retry')+'</p>';}
  }
  const states=['pendiente','en_curso','aplicada','en_seguimiento','cerrada','descartada'];
  const toast=t=>{clearTimeout(timer);notice.textContent=t;timer=setTimeout(()=>notice.textContent='',5500)};
  async function api(path,method='GET',body){
    const actorId=state.user?.id;
    let r;try{r=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});}catch{throw new Error('No se pudo conectar. Comprueba la conexión y vuelve a intentarlo.');}
    const data=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401&&path!=='login'&&state.user?.id===actorId&&actorId){if(dialog.open)dialog.close();await showSignedOut();}throw new Error(data.error||`No se pudo completar la operación (${r.status}).`);}
    if(data.petMilestone&&actorId===state.user?.id&&path.startsWith('sites/'))creditMascota({userId:actorId,siteId:decodeURIComponent(path.split('/')[1]),taskId:data.id,milestone:data.petMilestone});
    return data;
  }
  const sitePath=(suffix='')=>'sites/'+encodeURIComponent(state.site.id)+suffix;
  function show(title,html,onSubmit=null,action=''){
    if(!dialog.open)dialogFocus=document.activeElement;dialogAction=onSubmit;
    dialog.innerHTML=`<div class="inside"><header><div><p class="eyebrow">${e(state.site?.name||'SEOBESTIA')}</p><h2 id="dialog-title" tabindex="-1">${e(title)}</h2></div>${btn('Cerrar','close','','secondary compact')}</header>${onSubmit?`<form id="dialog-form">${html}<p role="alert" class="inline-note error" id="form-error"></p><div class="actions"><button class="btn primary">${e(action||'Guardar')}</button>${btn('Cancelar','close')}</div></form>`:html}</div>`;
    if(!dialog.open)dialog.showModal();
    $('#dialog-title')?.focus();
  }
  dialog.addEventListener('close',()=>{dialogAction=null;dialog.innerHTML='';dialogFocus?.isConnected&&dialogFocus.focus()});
  dialog.addEventListener('cancel',ev=>{if(pending)ev.preventDefault()});
  const field=(label,key,opts={})=>`<label>${e(label)}<input name="${key}" type="${opts.type||'text'}" ${opts.required===false?'':'required'} ${opts.max?`maxlength="${opts.max}"`:''} ${opts.min?`minlength="${opts.min}"`:''} value="${e(opts.value||'')}" ${opts.auto?`autocomplete="${opts.auto}"`:''} ${opts.placeholder?`placeholder="${e(opts.placeholder)}"`:''}></label>`;
  function login({email='',message=''}={}){
    stopMetrics();
    syncMascota({user:null,site:null,tab:null});
    const intro='<section class="login-art">'+brand+'<div><p class="eyebrow">El taller de tu web</p><h1>¿Qué página mejoramos hoy?</h1><p>Encuentra una búsqueda que le importe a tu público y convierte esa idea en una mejora concreta.</p><ol class="login-route">'+stages.map((s,i)=>'<li><span>0'+(i+1)+'</span> '+e(s.label)+'</li>').join('')+'</ol></div><footer>Una web, paso a paso.</footer></section>';
    const demo=state.demoAvailable?'<div class="login-demo"><p class="eyebrow">¿Primera visita?</p><h3>Prueba con Madera Sur</h3><p class="meta">Explora el recorrido con una tienda de ejemplo y datos ficticios.</p>'+btn('Explorar demostración','demo','','secondary','arrow')+'</div>':'';
    const setup=state.setupAvailable?'<div class="inline-note"><p class="meta">Para empezar con tus propias webs, crea la primera cuenta de este equipo.</p>'+btn('Crear administrador local','setup','','secondary compact')+'</div>':'';
    const signup=state.signupAvailable?'<div class="login-signup"><span>¿Necesitas acceso para trabajar?</span>'+btn('Crear mi cuenta','signup','','secondary compact')+'</div>':'';
    app.innerHTML='<main id="main" tabindex="-1" class="login-shell">'+intro+'<div class="login-form"><section><p class="eyebrow">Espacio del equipo</p><h2>Bienvenido al taller</h2>'+signup+(message?'<p class="signup-receipt" role="status">'+e(message)+'</p>':'')+'<form id="login-form" class="fields">'+field('Usuario o correo electrónico','email',{auto:'username',value:email})+field('Contraseña','password',{type:'password',auto:'current-password'})+'<p id="login-error" class="inline-note error" role="alert"></p><button class="btn primary">Entrar '+icon('arrow')+'</button></form>'+(state.localAdminAvailable?'<p class="inline-note">Administración local · usuario <strong>admin</strong> y contraseña <strong>admin</strong>.</p>':'')+demo+setup+'</section></div></main>';
    document.title='Acceso · SEOBESTIA';
  }
  function signup(){
    show('Crear mi cuenta','<div class="fields"><p>Usa el correo que reconoce tu equipo. Después podrás entrar para consultar tu solicitud. El administrador aprueba el acceso y asigna las webs.</p>'+field('Nombre','name',{max:100,auto:'name'})+field('Usuario o correo','email',{type:'text',max:254,auto:'username'})+field('Contraseña','password',{type:'password',auto:'new-password',min:1,max:512})+'<small>Puedes usar una clave sencilla.</small></div>',async data=>{
      const r=await api('signup','POST',{name:data.name.trim(),email:data.email.trim(),password:data.password});
      return {signupEmail:data.email.trim(),message:r.message||'Ya puedes entrar con tu correo y contraseña para consultar tu acceso.'};
    },'Solicitar acceso');
  }
  function privateScreen(){
    const owner=privateLink?.kind==='activar-admin';let content='',title='';
    stopMetrics();clearTimeout(refreshTimer);requestToken++;syncMascota({user:null,site:null,tab:null});
    if(!privateLink?.code){
      title='El enlace está incompleto';content='<p>Pide un enlace nuevo al administrador.</p>'+btn('Volver','private-cancel');
    }else if(state.user){
      title='Tienes una sesión abierta';content='<p>Estás usando '+e(state.user.email)+'. Para continuar con este enlace, cierra la sesión actual.</p><div class="actions">'+btn('Cerrar sesión y continuar','private-switch','','primary')+btn('Mantener mi sesión','private-cancel')+'</div>';
    }else if(owner){
      title='Vincular este navegador como administrador';content='<p>Usa únicamente un perfil de navegador que controles. Cualquier persona con acceso a este perfil podrá entrar como administrador con el usuario <b>admin</b> y la contraseña <b>admin</b>.</p><p>Al vincularlo se consume el enlace de activación. Después tendrás que introducir la contraseña para entrar.</p><div class="actions">'+btn('Vincular este navegador','owner-pair','','primary')+btn('Cancelar','private-cancel')+'</div>';
    }else{
      title='Únete al equipo';content='<p>Con esta invitación puedes crear tu cuenta de miembro y entrar directamente. Ya dentro podrás agregar una web autorizada o pedir que te asignen una existente.</p><form id="invite-form" class="fields">'+field('Nombre','name',{max:100,auto:'name'})+field('Usuario o correo','email',{type:'text',max:254,auto:'username'})+field('Contraseña','password',{type:'password',min:1,max:512,auto:'new-password'})+'<small>Puedes usar una clave sencilla. Si ya tienes una cuenta, escribe su contraseña actual.</small><button class="btn primary">Unirme y entrar</button>'+btn('Volver al acceso','private-cancel')+'</form>';
    }
    app.innerHTML='<main id="main" tabindex="-1" class="approval-shell"><section class="panel approval-card">'+brand+'<p class="eyebrow">Acceso privado</p><h1 tabindex="-1">'+title+'</h1>'+content+'<p id="private-error" class="error" role="alert"></p></section></main>';
    document.title=title+' · SEOBESTIA';app.querySelector('h1').focus({preventScroll:true});
  }
  async function joinTeam(data){
    const invite=privateLink;if(invite?.kind!=='unirse'||!invite.code)return;
    await api('signup','POST',{name:data.name.trim(),email:data.email.trim(),password:data.password,inviteCode:invite.code});
    if(privateLink!==invite)return;
    privateLink=null;
    try{await api('login','POST',{email:data.email,password:data.password});await signedIn();}
    catch{login({email:data.email,message:'Vuelve a introducir tu contraseña para entrar al equipo.'});}
  }
  async function showSignedOut(){
    state.user=null;state.site=null;state.sites=[];clearTimeout(refreshTimer);
    const seq=++requestToken;history.replaceState(null,'',location.pathname);
    const info=await api('session').catch(()=>null);
    if(seq!==requestToken||state.user)return;
    if(info)state.signupAvailable=info.signupAvailable;
    login();
  }
  function approvalScreen(){
    stopMetrics();syncMascota({user:null,site:null,tab:null});state.site=null;state.sites=[];createAfterLogin=false;
    app.innerHTML='<main class="approval-shell" id="main" tabindex="-1"><section class="panel approval-card">'+brand+'<p class="eyebrow">Acceso al equipo</p><h1 tabindex="-1">Tu cuenta espera aprobación</h1><p>Entraste con <strong class="break">'+e(state.user.email)+'</strong>. Un administrador debe aprobar tu solicitud y elegir a qué webs tendrás acceso.</p><p>Si ya hablaste con tu equipo, consulta el estado aquí.</p><div class="actions">'+btn('Consultar estado','approval-check','','primary','review')+btn('Cerrar sesión','logout','','secondary')+'</div><p data-approval-status role="status"></p></section></main>';
    document.title='Aprobación pendiente · SEOBESTIA';
    app.querySelector('h1').focus({preventScroll:true});focusOnNavigation=false;
  }
  async function checkApproval(){
    const id=state.user?.id,info=await api('session');if(state.user?.id!==id)return;
    state.user=info.user;
    if(!state.user){state.signupAvailable=info.signupAvailable;login({message:'Vuelve a entrar para consultar el estado de tu cuenta.'});return;}
    if(state.user.pendingApproval){$('[data-approval-status]').textContent='Tu solicitud sigue pendiente de aprobación.';return;}
    route();toast('Tu cuenta ya tiene acceso al equipo.');
  }
  function top(){const u=state.user;return '<header class="top"><div class="bar"><div class="left">'+brand+'<span class="stamp">Taller de posicionamiento</span></div>'+workspaceNav()+'<div class="right"><button data-action="my-ai" class="personal-nav">Mi IA</button><button data-action="pet-open" class="personal-nav" aria-label="Abrir mi mascota" title="Mi mascota"><img src="/isotipo.svg" alt="" width="22" height="22"></button><span class="identity"><span class="avatar">'+e((u.name||u.email||'U')[0].toUpperCase())+'</span><span class="username">'+e(u.name||u.email)+'</span></span><button data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">'+icon('out')+'</button></div></div></header>';}
  function route(id='',tab='hoy'){const target=id?'#/sitio/'+encodeURIComponent(id)+'/'+tab:'#/sitios';if(location.hash===target)loadRoute();else location.hash=target;}
  function destination(page){const hash='#/'+page;if(location.hash===hash)loadRoute();else location.hash=hash;}
  function teamAccess(page,newSiteAfter=false){
    const hint=state.localAdminAvailable?'En este computador puedes entrar con el usuario <b>admin</b> y la contraseña <b>admin</b>.':'Utiliza una cuenta personal de tu equipo.';
    show('Entrar al espacio del equipo','<div class="fields"><p>Estás practicando en la demostración. Entra con una cuenta del equipo para gestionar webs y usuarios.</p><p class="inline-note">'+hint+'</p>'+field('Usuario o correo','email',{value:state.localAdminAvailable?'admin':'',auto:'username'})+field('Contraseña','password',{type:'password',auto:'current-password'})+'</div>',async data=>{
      const entry=await api('login','POST',data);state.user=entry.user;state.site=null;createAfterLogin=newSiteAfter;return {destination:page,message:'Sesión iniciada.'};
    },'Entrar');
  }
  async function loadRoute(){
    if(privateLink){privateScreen();return;}
    if(!state.user)return; const seq=++requestToken;clearTimeout(refreshTimer);
    if(state.user.pendingApproval){approvalScreen();return;}
    const [,part,encoded,sub]=location.hash.split('/');let id='';
    globalPage=['usuarios','diagnostico'].includes(part)?part:'sitios';
    try{if(part==='sitio'&&encoded)id=decodeURIComponent(encoded);}catch{route();return;}
    const busy=setTimeout(()=>{
      if(seq!==requestToken||dialog.open||!state.user||!focusOnNavigation)return;
      const host=$('.workspace-main')||$('#main');if(!host)return;
      const next=sections.some(x=>x[0]===sub)?sub:'hoy';
      host.innerHTML=companion(next,{loading:true,message:'Un momento, estoy reuniendo los datos de esta sección.'});
    },450);
    try{
      const {sites}=await api('sites');if(seq!==requestToken)return;state.sites=sites;
      if(id){const site=await api('sites/'+encodeURIComponent(id));if(seq!==requestToken)return;state.site=site;state.tab=sections.some(x=>x[0]===sub)?sub:'hoy';}else state.site=null;
      render();
      if(focusOnNavigation&&!dialog.open){focusOnNavigation=false;const heading=app.querySelector('h1')||$('#main');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});window.scrollTo(0,0);}}
      if(state.site&&state.tab!=='revisiones'&&reviewing(state.site)) {const poll=()=>{if(dialog.open||pending||app.querySelector('[data-preserve-work]')||document.activeElement?.matches('input,textarea,select'))refreshTimer=setTimeout(poll,6500);else loadRoute();};refreshTimer=setTimeout(poll,6500);}
    }catch(err){
      if(seq!==requestToken||!state.user)return;
      const demoLink=isDemoAccount()&&id&&!state.sites.some(s=>s.id===id);
      const open=demoLink?btn('Entrar al espacio del equipo','site-access',id,'primary'):'';
      app.innerHTML=top()+`<main class="frame" id="main" tabindex="-1"><div class="overview"><h1>${demoLink?'Abre el sitio con tu cuenta del equipo':'No se pudo abrir la vista'}</h1><p role="alert">${demoLink?'Estás en una sesión de demostración. Para abrir este enlace, inicia sesión con una cuenta que tenga acceso al sitio.':e(err.message)}</p></div><div class="actions">${open}${btn('Volver a intentar','retry')}${btn('Mis sitios','sites')}</div></main>`;
    }finally{clearTimeout(busy);}
  }
  function head(k,title,actions=''){return `<div class="section-head"><div><p class="eyebrow">${e(k)}</p><h2>${e(title)}</h2></div><div class="actions">${actions}</div></div>`;}
  function sidebar(s){
    const siteSelect=state.sites.length>1?'<label class="site-switch">Cambiar de sitio<select aria-label="Cambiar sitio" id="site-select">'+state.sites.map(x=>'<option value="'+e(x.id)+'" '+(x.id===s.id?'selected':'')+'>'+e(x.name)+'</option>').join('')+'</select></label>':'';
    const current=key=>state.tab===key?'aria-current="page"':'';
    const steps=stages.map((st,i)=>'<button class="step-link" data-action="tab" data-id="'+st.key+'" '+(state.tab===st.key?'aria-current="step"':'')+'><span class="step-index">0'+(i+1)+'</span><span class="step-copy"><strong>'+e(st.label)+'</strong><small>'+e(st.hint)+'</small></span></button>').join('');
    return '<aside class="sidebar"><div class="site-mast"><p class="eyebrow">Tu sitio</p><h2>'+e(s.name)+'</h2><p class="meta break">'+e(urlLabel(s.url))+' · '+e(s.country)+'</p>'+siteSelect+'</div><button class="side-home" data-action="tab" data-id="hoy" '+current('hoy')+'>'+icon('home')+' Plan del sitio</button><nav class="step-nav" aria-label="Pasos del recorrido"><p class="eyebrow">Tu recorrido</p>'+steps+'</nav><div class="site-tools"><button data-action="sites">'+icon('globe')+' Mis sitios</button><button data-action="new-site">'+icon('plus')+' Agregar sitio</button><button data-action="tab" data-id="conexiones" '+current('conexiones')+'>'+icon('globe')+' Conexiones de Google</button><button data-action="tab" data-id="ajustes" '+current('ajustes')+'>'+icon('settings')+' Configuración</button></div></aside>';
  }
  function directory(){
    const sites=state.sites;
    const cards=sites.map(x=>'<button class="site-card" data-action="site" data-id="'+e(x.id)+'"><span class="row">'+badge(x.demo?'Ejemplo':x.country||'Web')+icon('arrow')+'</span><h2>'+e(x.name)+'</h2><p class="meta break">'+e(urlLabel(x.url))+'</p><div class="item"><span>Salud técnica</span><strong>'+(x.score==null?'Pendiente':number(x.score)+'/100')+'</strong></div><small>Última revisión · '+e(date(x.lastReviewAt))+'</small></button>').join('');
    return '<main class="frame directory" id="main" tabindex="-1">'+stageIntro('Espacio del equipo','Mis sitios','Elige entre seguir una web cada día o resolver una consulta puntual.')+'<div class="workspace-switches"><section class="workspace-choice"><p class="eyebrow">Seguimiento diario</p><h2>Agregar un sitio</h2><p>Guarda la web del equipo, conecta Google y sigue las mejoras en el tiempo.</p>'+btn('Agregar sitio','new-site','','primary','plus')+'</section><section class="workspace-choice"><p class="eyebrow">Una sola revisión</p><h2>Diagnóstico sin agregar</h2><p>Analiza una URL autorizada o trae tus archivos. Descarga los hallazgos al terminar.</p>'+btn('Abrir diagnóstico puntual','diagnostic','','secondary','audit')+'</section></div><h2>Webs en tu espacio</h2><div class="site-grid">'+(cards||blank('Todavía no tienes sitios. Agrega una web para iniciar su seguimiento.'))+'</div></main>';
  }
  function render(){
    stopMetrics();
    const s=state.site;
    if(!s){
      const standalone=globalPage!=='sitios',team=globalPage==='usuarios';
      const heading=team?'Usuarios del equipo':standalone?'Diagnóstico sin agregar':'Mis sitios';
      app.innerHTML=top()+(standalone?'<main class="frame directory" id="main" tabindex="-1">'+stageIntro('Espacio del equipo',heading,team?'Crea accesos y elige qué webs puede gestionar cada persona.':'Haz una revisión puntual y descarga tu informe sin registrar la web.')+'<div id="workspace-section"></div></main>':directory());
      const container=$('#workspace-section');
      if(team){
        if(state.user.role==='admin')moduleCleanups.push(mountTeam(container,{api,user:state.user,sites:state.sites,show}));
        else container.innerHTML='<section class="panel"><h2>Administración del equipo</h2><p>Este apartado requiere una cuenta administradora.</p>'+(isDemoAccount()?btn('Entrar como administrador','team-access','','primary'):'')+'</section>';
      }else if(standalone){
        moduleCleanups.push(mountDiagnostico(container,{api,user:state.user}));
        if(isDemoAccount())container.querySelector('.inline-note')?.insertAdjacentHTML('beforeend',' '+btn('Entrar para analizar una URL','diagnostic-access','','secondary compact'));
      }
      syncMascota({user:state.user,site:null,tab:globalPage});document.title=heading+' · SEOBESTIA';
      if(!standalone&&createAfterLogin){createAfterLogin=false;queueMicrotask(newSite);}
      return;
    }
    const label=sections.find(x=>x[0]===state.tab)?.[1]||'Plan del sitio';
    const breadcrumb='<div class="workspace-top"><span><button data-action="tab" data-id="hoy">'+e(s.name)+'</button> / '+e(label)+'</span>'+(s.demo?badge('Datos de ejemplo','demo'):badge('Sitio del equipo'))+'</div>';
    let contents=({hoy:today,auditoria:audit,keywords:keywords,tareas:tasks,revisiones:reviews,conexiones:()=>stageIntro('Fuentes de datos','Conexiones de Google','Sigue la guía ilustrada y verifica la propiedad que corresponde a esta web.')+'<section id="google-guides"></section>',ajustes:settings})[state.tab](s);
    const guideText={hoy:'Empieza con la próxima acción que tenga evidencia en tu sitio.',auditoria:'Abre una URL para inspeccionar su respuesta, enlaces y señales técnicas.',keywords:'Explora las consultas o prepara un encargo con keywords y long-tail para tu redactor.',tareas:'Revisa el encargo y registra la fecha cuando publiques el cambio.',revisiones:'Compara períodos completos y comprueba qué datos respaldan cada resultado.',ajustes:'Define el objetivo del negocio y conecta las fuentes que usa el equipo.'};
    const msg=companion(state.tab,{message:guideText[state.tab],compact:true,loading:state.tab==='auditoria'&&reviewing(s),tone:state.tab==='auditoria'&&orderedIssues(s).some(i=>i.severity==='alta')?'warning':'normal'});
    contents=state.tab==='conexiones'?contents:state.tab==='auditoria'?contents.replace('<section class="panel" id="url-inspector"',msg+'<section class="panel" id="url-inspector"'):contents.replace('</header>','</header>'+msg);
    if(['hoy','revisiones'].includes(state.tab))contents+=analysisShell();
    app.innerHTML=top()+'<div class="workspace">'+sidebar(s)+'<main class="workspace-main" id="main" tabindex="-1">'+breadcrumb+contents+'</main></div>';
    document.title=label+' · '+s.name+' · SEOBESTIA';
    const connectionRoot=$('#google-guides');
    if(connectionRoot)moduleCleanups.push(mountConnections(connectionRoot,{site:s,user:state.user,api,initialSource:connectionSource,onConnected:(source,property)=>{if(source==='gsc')s.gscProperty=property;else s.ga4PropertyId=property;}}));
    syncMascota({user:state.user,site:s,tab:state.tab});
    if(state.tab==='revisiones')startMetrics($('#metrics-dashboard'),s);
    const inspector=$('#url-inspector'), editorial=$('#editorial-desk'), analysis=$('[data-analysis]');
    let lastSummary=inspector?auditSummary(s):'';
    if(inspector)moduleCleanups.push(mountInspector(inspector,{site:s,load:api,show,hero:$('.inspect-hero'),onData(d){
      const previous=new Map((s.audit?.issues||[]).map(i=>[i.id,i]));
      const issues=d.issues.map(i=>({target:previous.get(i.id)?.target,expectedOutcome:previous.get(i.id)?.expectedOutcome,...i}));
      s.audit={...s.audit,score:d.score,version:d.version,coverage:d.coverage,issueCount:d.issueCount,issues};
      const hero=$('.inspect-hero'), updated=auditSummary(s);
      if(lastSummary!==updated){hero.innerHTML=updated;lastSummary=updated;}
      return issues;
    }}));
    if(editorial)moduleCleanups.push(mountEditorial(editorial,{site:s,userId:state.user.id,load:api,addTask}));
    if(analysis)moduleCleanups.push(mountAnalysis(analysis,{site:s,load:api}));
    if(openEditor && openEditor.site===s.id && state.tab==='tareas'){const id=openEditor.id;openEditor=null;editTask(id);}
  }
  function today(s){
    const open=s.tasks.find(drafting), watching=s.tasks.find(applied), urgent=orderedIssues(s).find(i=>i.severity==='alta'&&!i.pendingCheck);
    let card;
    if(open)card=nextCard('Continúa donde lo dejaste','Tienes una mejora en preparación',open.title,btn('Continuar con la mejora','task',open.id,'primary','arrow'));
    else if(urgent||!s.audit?.coverage?.pages)card=nextCard('Siguiente paso','Empieza por la salud de tu web',urgent?'La revisión detectó un problema de prioridad alta. Comprueba la página afectada antes de preparar contenido.':'Comprueba qué páginas se pueden analizar y si hay problemas que resolver.',advance('auditoria','Abrir diagnóstico'));
    else if(watching)card=nextCard('Siguiente paso','Revisa qué pasó con tu mejora',watching.title,advance('revisiones','Ver seguimiento'));
    else card=nextCard('Siguiente paso','Elige una búsqueda para trabajar','La web ya tiene un diagnóstico. Revisa qué buscan las personas y elige una página para mejorar.',advance('keywords','Elegir una búsqueda'));
    const activity='<aside class="context-rail"><p class="eyebrow">Estado del sitio</p><h2>De un vistazo</h2>'+detailLine('Puntuación técnica',s.audit?.score==null?'Pendiente':number(s.audit.score)+' de 100')+detailLine('Última revisión',date(s.lastReviewAt,true))+detailLine('Datos de búsqueda hasta',s.dataUntil?date(s.dataUntil):'Sin datos fechados')+'</aside>';
    return stageIntro('Plan del sitio', 'Tu plan para '+s.name,'Trabaja en una página a la vez. Puedes volver a cualquiera de los cuatro pasos cuando lo necesites.')+card+'<div class="work-layout"><div class="work-main"><section class="panel"><div class="panel-head"><h2>Novedades de la web</h2>'+icon('bell')+'</div>'+((s.alerts||[]).slice(0,4).map(a=>'<div class="item"><div><h3>'+e(a.title)+'</h3><p>'+e(a.message)+'</p></div></div>').join('')||blank('Todavía no hay alertas registradas. Las próximas revisiones aparecerán aquí.'))+btn('Ver las revisiones','tab','revisiones','secondary compact')+'</section></div>'+activity+'</div>';
  }
  function describe(x){if(x==null)return 'Sin evaluar';if(typeof x!=='object')return String(x);return Object.entries(x).filter(([k,v])=>typeof v!=='object'&&v!=null).map(([k,v])=>`${human(k)}: ${v}`).join(' · ')||'Sin detalle';}
  function auditSummary(s){
    const a=s.audit||{}, coverage=a.coverage||{}, issues=orderedIssues(s), pages=coverage.pages||0;
    const total=a.issueCount??issues.length, pending=coverage.pendingIssues??issues.filter(i=>i.pendingCheck).length;
    const confirmed=Math.max(0,total-pending), first=issues.find(i=>!i.pendingCheck), active=reviewing(s);
    const completed=Boolean(s.lastReviewAt||pages), score=a.score==null?'Pendiente':number(a.score)+' / 100';
    const title=confirmed?(confirmed===1?'1 problema confirmado':number(confirmed)+' problemas confirmados'):!completed?(active?'Primer diagnóstico en curso':'Tu web espera su primer diagnóstico'):!pages?'Todavía faltan páginas por comprobar':pending?'Quedan problemas por volver a comprobar':'Sin problemas confirmados en la muestra';
    const priority=first?'<div class="inspect-first"><small>Empieza aquí · Prioridad '+e(first.severity)+'</small><b>'+e(issueName(first))+'</b><span class="meta break">'+e(urlLabel(first.url))+'</span></div>':'';
    let coverageText=pages?number(pages)+(pages===1?' página revisada':' páginas revisadas')+' · '+number(coverage.checked)+' controles evaluados':completed?'La revisión no pudo comprobar ninguna página.':'Al revisar la web verás qué páginas pudimos comprobar.';
    if(completed&&coverage.partial)coverageText+=' · Cobertura parcial';
    if(pending)coverageText+=' · '+number(pending)+(pending===1?' hallazgo anterior pendiente de comprobar':' hallazgos anteriores pendientes de comprobar');
    if(completed&&s.lastReviewAt)coverageText+=' · '+date(s.lastReviewAt,true);
    const inspect=confirmed||pending?'<button type="button" class="btn primary compact" data-inspect-jump aria-controls="url-inspector">'+icon('arrow')+(confirmed?'Ver qué corregir':'Ver hallazgos pendientes')+'</button>':'';
    const next=pages&&!issues.some(i=>i.severity==='alta')?btn('Seguir a Keywords','tab','keywords',!inspect&&!coverage.partial?'primary compact':'secondary compact','arrow'):'';
    const rerun=btn(active?'Actualizar estado':completed?'Volver a revisar':'Revisar la web',active?'retry':'run','',inspect||next&&!coverage.partial?'secondary compact':'primary compact','review');
    return '<div class="inspect-score"><p class="eyebrow">Salud técnica</p><strong class="score-number">'+e(score)+'</strong><p>Los controles aprobados suman puntos. Los de mayor importancia pesan más.</p></div><div class="inspect-takeaway"><h2>'+e(title)+'</h2>'+priority+'<p class="meta">'+e(coverageText)+'</p><div class="actions">'+inspect+next+rerun+'</div></div>';
  }
  function audit(s){
    return stageIntro('auditoria','Auditar','Descubre qué necesita atención y abre cada problema para ver la página afectada y cómo corregirlo.')+
      '<section class="inspect-hero" aria-label="Resultado del diagnóstico">'+auditSummary(s)+'</section>'+
      '<section class="panel" id="url-inspector" aria-label="Inspector de páginas"></section>';
  }
  function issue(id){const i=state.site.audit?.issues.find(x=>x.id===id);if(!i)return;
    show(issueName(i),badge('Prioridad '+i.severity,warn(i.severity))+detailLine('Página afectada',i.url)+detailLine('Dónde se busca el efecto',targets[validTarget(i.target)])+detailLine('Resultado esperado',i.expectedOutcome||'Resolver la incidencia comprobada.')+detailLine('Qué se encontró',describe(i.evidence))+detailLine('Qué puedes hacer',i.fix||'Revisa la página con el equipo.')+'<p class="meta">Comprobación · '+e(date(i.checkedAt,true))+'</p><div class="actions">'+btn('Preparar esta corrección','make-issue',id,'primary','arrow')+'</div>');
  }
  const targets={google:'Google',ia:'IA',ambos:'Google e IA'};
  const validTarget=t=>Object.hasOwn(targets,t)?t:'google';
  const targetOptions=chosen=>Object.entries(targets).map(([k,v])=>'<option value="'+k+'" '+(validTarget(chosen)===k?'selected':'')+'>'+e(v)+'</option>').join('');
  const measuredTag=o=>o.observed?'Consulta observada':o.inContent===true?'En el contenido':'Idea sugerida';
  const existing=o=>o.observed||o.inContent===true;
  const contentStatus=o=>o.inContent===true?'Encontrada en el contenido':o.inContent===false?'Sin coincidencia en títulos y encabezados revisados':'Presencia sin comprobar';
  const scopeDate=o=>o.startDate?date(o.startDate)+(o.endDate&&o.endDate!==o.startDate?' – '+date(o.endDate):''):'Sin período informado';
  const ctr=a=>a==null?'—':number(a*100)+' %';
  const targetPlan={google:'Trabajar la respuesta a la intención y mejorar cómo aparece la página en Google. Revisar impresiones, clics y CTR tras aplicar el cambio.',ia:'Preparar una respuesta clara y respaldada por fuentes. Comparar menciones y enlaces citados en una muestra de preguntas a motores de IA.',ambos:'Trabajar la intención en Google y la claridad de la respuesta para IA. Seguir los clics orgánicos y, por separado, las citas observadas.'};
  const goalText=(o,s)=>o.goal||s.businessGoal||'Definir el objetivo comercial de esta web';
  const categoryName=o=>o.longTail?'Long-tail':'Keyword';
  function activeGroup(s){return state.filter==='all'?((s.opportunities||[]).some(existing)?'seen':'idea'):state.filter;}
  function filtered(s){const q=state.q.toLocaleLowerCase('es').trim();const group=activeGroup(s);return (s.opportunities||[]).filter(o=>(!state.longTail||o.longTail)&&((group==='seen')===Boolean(existing(o)))&&[o.keyword,o.page,o.intent,o.group,...(o.variants||[])].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(q));}
  function keywordTable(s){
    const arr=filtered(s),page=Math.min(state.page,Math.max(0,Math.ceil(arr.length/30)-1)),visible=arr.slice(page*30,page*30+30);
    if(!arr.length)return blank(state.q||state.longTail?'Ninguna keyword coincide con este filtro.':activeGroup(s)==='seen'?'Todavía no hay consultas observadas ni términos identificados en los encabezados revisados.':'Todavía no hay propuestas pendientes de validar.');
    const columns=['Keyword y origen','Clics','Impresiones','CTR','Posición media','Volumen mensual'];
    const cell=(name,value)=>'<td class="num" data-label="'+name+'">'+e(value)+'</td>';
    const row=o=>'<tr><th scope="row"><button class="link-btn" data-action="opportunity" data-id="'+e(o.id)+'">'+e(o.keyword)+'</button><span class="kw-tags">'+badge(categoryName(o),o.longTail?'kw-longtail':'')+badge(measuredTag(o),o.observed?'good':'warn')+badge(targets[validTarget(o.target)])+'</span><small>'+e(o.source)+' · '+e(scopeDate(o))+'</small><small>'+e(o.action)+' · '+e(o.intent||'Intención por revisar')+'</small></th>'+cell('Clics',number(o.clicks))+cell('Impresiones',number(o.impressions))+cell('CTR',ctr(o.ctr))+cell('Posición media',number(o.position))+cell('Volumen mensual',o.volume==null?'Sin dato':number(o.volume))+'</tr>';
    return '<table class="kw-table"><thead><tr>'+columns.map(c=>'<th scope="col">'+e(c)+'</th>').join('')+'</tr></thead><tbody>'+visible.map(row).join('')+'</tbody></table><div class="table-pages"><small>'+number(page*30+1)+'–'+number(page*30+visible.length)+' de '+number(arr.length)+' resultados</small><div class="actions">'+(page?btn('Anterior','kw-page',page-1,'secondary compact'):'')+((page+1)*30<arr.length?btn('Siguiente','kw-page',page+1,'secondary compact'):'')+'</div></div>';
  }
  function keywords(s){
    const all=s.opportunities||[], seen=all.filter(existing),ideas=all.filter(o=>!existing(o)),group=activeGroup(s),current=group==='seen';
    const groupBtn=(key,label,count)=>'<button type="button" class="kw-group" data-action="kw-group" data-id="'+key+'" aria-pressed="'+(group===key)+'">'+e(label)+' <span>'+number(count)+'</span></button>';
    const detailWarning=s.gscDetailState==='detenido'?'<p class="inline-note" role="status"><strong>Consultas de Search Console detenidas.</strong> Último detalle conservado: '+e(s.gscUntil||'sin fecha')+'. Totales hasta '+e(s.gscTotalsUntil||'sin fecha')+'. El administrador puede exportar los datos en Conexiones.</p>':'';
    return stageIntro('keywords','Keywords','Encuentra qué búsquedas ya traen visibilidad y elige nuevas oportunidades según la intención, el negocio y las páginas que puedes mejorar.')+detailWarning+editorialShell()+
      '<section class="panel keyword-panel"><div class="panel-head"><div><p class="eyebrow">Investigación del sitio</p><h2>Mapa de keywords</h2></div><div class="actions">'+btn('Importar consultas','import','','secondary compact','plus')+btn('Exportar selección','export','','secondary compact','file')+'</div></div>'+
      '<div class="kw-groups" role="group" aria-label="Grupo de keywords">'+groupBtn('seen','Actuales',seen.length)+groupBtn('idea','Sugeridas',ideas.length)+'</div>'+
      '<div class="kw-explanation"><h3>'+e(current?'Términos con presencia o rendimiento':'Qué búsquedas conviene trabajar')+'</h3><p>'+e(current?'Las consultas observadas tienen datos de búsqueda. «En el contenido» identifica un término del sitio cuya demanda aún se desconoce. Abre cada término para ver su evidencia.':'Estas propuestas se basan en los servicios, las páginas revisadas y las fuentes disponibles. Comprueba su relación con el objetivo comercial antes de preparar una mejora.')+'</p></div>'+
      '<p class="meta"><strong>Objetivo del sitio</strong> · '+e(s.businessGoal||'Por definir en Configuración')+'<br>Última revisión · '+e(date(s.lastReviewAt,true))+' · Datos de búsqueda hasta '+e(s.dataUntil?date(s.dataUntil):'fecha pendiente')+'</p>'+
      (s.opportunityCount>all.length?'<p class="inline-note">Selección de '+number(all.length)+' de '+number(s.opportunityCount)+' oportunidades por prioridad. Los grupos, filtros y la exportación se aplican a esta selección.</p>':'')+
      '<div class="toolbar"><label>Buscar en el grupo<input id="query" type="search" value="'+e(state.q)+'" placeholder="Keyword, intención o página"></label><label class="check longtail"><input type="checkbox" id="longtail" '+(state.longTail?'checked':'')+'> Solo long-tail</label></div><div class="table-wrap" id="keyword-results">'+keywordTable(s)+'</div>'+
      '<details class="kw-help"><summary>Qué significa cada métrica</summary><p><strong>Impresiones</strong> cuenta las veces que apareció el resultado. <strong>Clics</strong> cuenta las veces que se abrió. <strong>CTR</strong> es el porcentaje de impresiones que produjo un clic. <strong>Posición media</strong> resume las posiciones observadas durante el período.</p><p><strong>Volumen mensual</strong> se refiere a demanda del mercado. Las métricas sin observaciones se muestran con un guion. Una long-tail expresa una necesidad específica, por ejemplo una pregunta que incluye requisito o ubicación.</p></details></section>';
  }
  function tasks(s){
    const list=s.tasks||[], first=list.find(drafting);
    const card=first?nextCard('Mejora en preparación',first.title,'Revisa la propuesta, ajusta el texto y guarda los cambios. Cuando el equipo los aplique en la web, registra la publicación.',btn('Editar la mejora','task',first.id,'primary','file')):
      list.some(applied)?nextCard('Siguiente acción','Comprueba el resultado de lo publicado','Las mejoras con página y fecha de aplicación ya se pueden seguir en el último paso.',advance('revisiones','Ver seguimiento')):
      nextCard('Siguiente acción','Elige el punto de partida','Una búsqueda o un problema del diagnóstico puede convertirse en el primer plan de trabajo del equipo.',advance('keywords','Buscar una oportunidad'));
    const cards=list.map(t=>'<article class="task">'+badge(human(t.status),warn(t.status))+'<h3>'+e(t.title)+'</h3><p class="meta break">'+e(urlLabel(t.page))+(t.appliedAt?' · Aplicada '+e(date(t.appliedAt)):'')+'</p><div class="actions">'+btn('Ver o editar la mejora','task',t.id,'secondary compact')+(drafting(t)?btn('Registrar cambio publicado','mark-applied',t.id,'secondary compact','review'):applied(t)?btn('Ver seguimiento','tab','revisiones','secondary compact'):'')+'</div></article>').join('');
    return stageIntro('tareas','Mejoras','Convierte lo que descubriste en un cambio concreto. El equipo revisa el plan y aplica el cambio en la web.')+card+'<section class="panel"><div class="panel-head"><h2>Mejoras del equipo</h2>'+badge(String(list.length))+'</div>'+(cards||blank('Cuando elijas una búsqueda y pulses «Preparar esta mejora», encontrarás aquí su guía editable.'))+'</section>';
  }
  function reviews(s){
    const active=s.tasks.filter(applied), draft=s.tasks.find(drafting);
    const monitored=active.map(t=>'<article class="task">'+badge(human(t.status))+'<h3>'+e(t.title)+'</h3><p class="meta break">'+e(urlLabel(t.page))+' · Cambio del '+e(date(t.appliedAt))+'</p><p>'+e(t.result?resultText(t.result):'Aún se está reuniendo evidencia para comparar el rendimiento.')+'</p>'+(t.verification?'<p class="inline-note">'+e(t.verification.message)+' · '+e(date(t.verification.at))+'</p>':'')+btn('Abrir mejora','task',t.id,'secondary compact')+'</article>').join('');
    const next=active.length?'':nextCard('Para empezar a medir',draft?'Registra el cambio cuando esté publicado':'Prepara tu primera mejora',draft?'Cuando el cambio esté en la web, indica la página y la fecha. Así conoceremos dónde empieza el seguimiento.':'El seguimiento de una mejora comienza cuando el equipo registra su publicación. Mientras tanto, aquí puedes consultar las revisiones diarias.',draft?btn('Ver la mejora','task',draft.id,'primary','arrow'):advance('keywords','Elegir una búsqueda'));
    const logs=(s.reviews||[]).map(r=>'<div class="item"><div><h3>'+e(date(r.at,true))+'</h3><p>'+e(r.message)+'</p>'+(r.changes?.length?'<details><summary>Ver cambios por página ('+r.changes.length+')</summary>'+r.changes.map(c=>'<p class="meta break">'+e(typeof c==='string'?c:[c.kind,c.url].filter(Boolean).join(' · '))+'</p>').join('')+'</details>':'')+'<small>Páginas comprobadas · '+number(r.pagesChecked)+'</small></div>'+badge(human(r.status),warn(r.status))+'</div>').join('');
    return stageIntro('revisiones','Medir','Sigue las búsquedas, las visitas y las citas en respuestas de IA. Cada indicador conserva su fuente y su período.')+
    '<div class="actions">'+btn('Ver la interpretación semanal','weekly-report','','secondary compact','review')+'</div><div id="metrics-dashboard" aria-label="Medición del sitio"><p class="empty" role="status">Cargando métricas…</p></div>'+
    '<section class="panel"><div class="panel-head"><div><p class="eyebrow">Evidencia manual</p><h2>Respuestas de IA</h2></div>'+btn('Registrar observación de IA','ai-capture','','secondary compact','plus')+'</div><p class="meta">Añade una pregunta que hayas probado y declara si el motor mencionó la marca o citó una página del sitio.</p></section>'+
    (active.length?'<section class="panel"><div class="panel-head"><h2>Mejoras en seguimiento</h2>'+badge(String(active.length))+'</div>'+monitored+'</section>':next)+'<section class="panel"><div class="panel-head"><h2>Revisiones diarias</h2>'+btn('Revisar ahora','run','','secondary compact','review')+'</div><p class="meta">Datos de búsqueda hasta · '+e(s.dataUntil?date(s.dataUntil):'Sin fecha de datos')+'</p>'+((s.jobs||[]).length?'<details><summary>Estado de los trabajos recientes</summary>'+s.jobs.slice(0,5).map(j=>badge(human(j.status),warn(j.status))).join(' ')+'</details>':'')+(logs||blank('El historial aparecerá después de la primera revisión.'))+'</section>';
  }
  function settings(s){
    const admin=state.user.role==='admin',canLink=!s.demo&&(admin||s.memberIds?.includes(state.user.id));
    const profile=[['Dominio',s.url],['País e idioma',[s.country,s.language].filter(Boolean).join(' · ')],['Actividad',s.business],['Servicios',s.services]].map(([k,v])=>detailLine(k,v||'Pendiente')).join('');
    return stageIntro('Herramientas del equipo','Configura el sitio','Consulta el perfil del negocio, sus fuentes de datos y quién puede trabajar en él.')+
      '<div class="columns"><section class="panel"><h2>Perfil del sitio</h2>'+profile+(admin&&!s.demo?'<div class="actions">'+btn('Editar ficha','site-profile')+btn('Retirar del seguimiento','site-remove')+'</div>':'')+'</section><section class="panel"><h2>Datos de búsqueda</h2><p class="detail break">'+e(s.gscProperty||'Puedes conectar Search Console o importar las consultas desde un archivo.')+'</p><p class="meta">'+number(s.rowsCount)+' observaciones disponibles.</p><div class="actions">'+(canLink?btn('Vincular propiedad','gsc'):'')+btn('Importar CSV','import')+'</div></section>'+
      '<section class="panel"><h2>Objetivo comercial</h2><p>'+e(s.businessGoal||'Define qué acción esperas de las visitas a esta web.')+'</p>'+btn('Editar objetivo','edit-goal','','secondary compact')+'</section>'+
      '<section class="panel"><h2>Google Analytics 4</h2><p>'+e(s.ga4PropertyId?'Propiedad '+s.ga4PropertyId:'Pendiente de conexión')+'</p>'+(s.ga4LastError?'<p class="inline-note error">'+e(s.ga4LastError)+'</p>':'')+'<p class="meta">Aporta sesiones y eventos clave para valorar el resultado de las páginas.</p>'+(canLink?btn('Vincular GA4','ga4','','secondary compact'):'')+'</section>'+
      (admin?'<section class="panel"><div class="panel-head"><h2>Acceso al sitio</h2>'+icon('users')+'</div><p class="meta">Elige los miembros del equipo que pueden preparar mejoras para esta web.</p><div class="actions">'+btn('Gestionar permisos','site-members')+'</div></section>':'')+'</div>';
  }
async function siteMembers(){
  const site=state.site, {users}=await api('users');if(state.site?.id!==site.id)return;
  const eligible=users.filter(u=>u.role==='member' && !u.disabled && !u.pendingApproval);
  const owner=users.find(u=>u.id===site.ownerId);
  const note=`<p class="meta">El propietario${owner?' ('+e(owner.name)+')':''} y los administradores conservan acceso. Selecciona al propietario si también debe conectar las propiedades de Google.</p>`;
  if(!eligible.length){show('Permisos de '+site.name,`${blank('Crea un miembro en Usuarios para asignarle esta web.')}${note}<div class="actions">${btn('Ir a Usuarios','users','','','users')}</div>`);return;}
  const assigned=new Set(site.memberIds||[]);
  show('Permisos de '+site.name,`<div class="fields"><p>Selecciona las personas que podrán trabajar en esta web y vincular sus propiedades de Google. La credencial compartida solo la gestiona el administrador.</p><fieldset><legend>Miembros del equipo</legend>${eligible.map(u=>`<label class="check member-row"><input type="checkbox" name="memberIds" value="${e(u.id)}" ${assigned.has(u.id)?'checked':''}><span>${e(u.name)}<small>${e(u.email)}</small></span></label>`).join('')}</fieldset>${note}</div>`,async (_,form)=>{await api('sites/'+encodeURIComponent(site.id)+'/members','PATCH',{memberIds:new FormData(form).getAll('memberIds')});return 'Permisos del sitio guardados.';},'Guardar permisos');
}

  function opportunity(id){
    const s=state.site,o=s.opportunities.find(x=>x.id===id);if(!o)return;
    const t=validTarget(o.target), related=(o.related||[]).slice(0,4), signal=o.contentEvidence||null;
    const origin=[o.source,scopeDate(o),o.country||s.country,o.device||'Dispositivo sin especificar'].filter(Boolean).join(' · ');
    const metrics=[['Clics',number(o.clicks)],['Impresiones',number(o.impressions)],['CTR',ctr(o.ctr)],['Posición media',number(o.position)],['Volumen mensual',o.volume==null?'Sin dato':number(o.volume)]];
    const proof='<div class="kw-proof"><p><strong>'+e(measuredTag(o))+' · '+e(contentStatus(o))+'</strong></p><p>'+e(signal?'Coincidencia en '+(signal.part||'contenido')+' de '+urlLabel(signal.url)+'. '+(signal.text||''):o.reason||'Aún falta validar este término.')+'</p><small>'+e(origin)+'</small></div>';
    const outcome=o.pageOutcomes;
    const extra=outcome?'<p class="meta">En la página de destino, GA4 registró '+number(outcome.sessions)+' sesiones y '+number(outcome.keyEvents)+' eventos clave. '+e(outcome.window||'Ventana de la fuente')+'. Las cifras corresponden a la página completa.</p>':'';
    show(o.keyword,'<div class="badges">'+badge(categoryName(o),o.longTail?'kw-longtail':'')+badge(measuredTag(o),o.observed?'good':'warn')+'</div>'+proof+'<div class="kw-metrics">'+metrics.map(([k,v])=>'<div><small>'+e(k)+'</small><strong>'+e(v)+'</strong></div>').join('')+'</div>'+
      detailLine('Intención estimada',o.intent||'Por revisar')+detailLine('Objetivo comercial',goalText(o,s))+detailLine('Página para trabajar',o.page||'Por asignar después de comprobar la intención')+
      detailLine('Próxima acción',o.action+' · '+o.reason)+(o.validation?detailLine('Cómo validarlo',o.validation):'')+extra+
      '<div class="kw-plan"><label>Destino de la mejora<select id="op-target" data-op="'+e(id)+'">'+targetOptions(t)+'</select></label><p class="meta" id="op-target-help">'+e(targetPlan[t])+'</p><label>Resultado esperado<textarea id="op-outcome" rows="2" maxlength="1000">'+e(o.expectedOutcome||targetPlan[t])+'</textarea></label><p class="meta">El equipo medirá este objetivo después de publicar el cambio.</p></div>'+
      '<div class="actions">'+btn('Preparar esta mejora','make-op',id,'primary','arrow')+'</div><details><summary>Ver datos y contexto de la búsqueda</summary>'+detailLine('Última revisión del sitio',date(o.reviewedAt||s.lastReviewAt,true))+detailLine('Prioridad estimada',number(o.priority)+' / 100')+(related.length?detailLine('Búsquedas relacionadas',related.map(r=>r.keyword+' ('+r.source+')').join(' · ')):'')+(o.observed?btn('Ver observaciones','evidence',id,'secondary compact'):'')+'<div id="evidence"></div></details>');
  }
  async function evidence(id,offset=0){
    const root=$('#evidence');if(!root)return;
    const r=await api(sitePath('/evidence?opportunityId='+encodeURIComponent(id)+'&offset='+offset));if(!root.isConnected)return;
    const rows=r.rows||[];root.innerHTML=`<div class="section-head"><h3>Observaciones de origen</h3></div><p class="meta">${rows.length?number(offset+1)+'–'+number(offset+rows.length):'0'} de ${number(r.total??rows.length)}</p><div class="table-wrap"><table><thead><tr><th>Fecha y página</th><th>Consulta</th><th>Impresiones</th><th>Clics</th><th>Posición</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date?e(date(r.date)):'Período importado'}<small class="break">${e(r.page||'Sin URL')}</small></td><td>${e(r.query)}<small>${e(r.country)} · ${e(r.source)}</small></td><td>${number(r.impressions)}</td><td>${number(r.clicks)}</td><td>${number(r.position)}</td></tr>`).join('')}</tbody></table></div><div class="actions">${offset>0?`<button type="button" class="btn secondary compact" data-action="evidence" data-id="${e(id)}" data-offset="${Math.max(0,offset-40)}">Anterior</button>`:''}${offset+rows.length<r.total?`<button type="button" class="btn secondary compact" data-action="evidence" data-id="${e(id)}" data-offset="${offset+rows.length}">Siguiente</button>`:''}</div>`;
  }
  async function loadTaskVersions(section,offset=0){
    const panel=section.querySelector('[data-version-list]'), token=String((Number(panel.dataset.request)||0)+1);
    panel.dataset.request=token;panel.setAttribute('aria-busy','true');panel.textContent='Cargando versiones…';
    try{
      const result=await api(sitePath('/tasks/'+encodeURIComponent(section.dataset.taskVersions)+'/versions?offset='+offset));
      if(!section.isConnected||panel.dataset.request!==token)return;
      const versions=result.versions||[],nav=(label,at)=>'<button type="button" class="btn secondary compact" data-version-offset="'+at+'">'+label+'</button>';
      const actions=(result.offset>0?nav('Más recientes',Math.max(0,result.offset-result.limit)):'')+(result.offset+versions.length<result.total?nav('Más antiguas',result.offset+result.limit):'');
      section.dataset.loaded='true';
      panel.innerHTML=(versions.length?'<p class="meta">'+number(result.offset+1)+'–'+number(result.offset+versions.length)+' de '+number(result.total)+'</p>':'<p>Todavía no hay versiones guardadas.</p>')+
        versions.map((v,i)=>'<details class="detail"><summary>Versión '+number(result.total-result.offset-i)+' · '+e(date(v.at,true))+' · '+e(v.author||'Equipo')+'</summary><pre>'+e(v.brief)+'</pre></details>').join('')+'<div class="actions">'+actions+'</div>';
    }catch(err){if(section.isConnected&&panel.dataset.request===token)panel.innerHTML='<p role="alert">'+e(err.message)+'</p><button type="button" class="btn secondary compact" data-version-offset="'+offset+'">Reintentar</button>';}
    finally{if(panel.dataset.request===token)panel.setAttribute('aria-busy','false');}
  }
  dialog.addEventListener('toggle',ev=>{
    const section=ev.target;if(section.matches?.('[data-task-versions]')&&section.open&&!section.dataset.loaded&&section.querySelector('[data-version-list]').getAttribute('aria-busy')!=='true')loadTaskVersions(section);
  },true);
  dialog.addEventListener('click',ev=>{const btn=ev.target.closest('[data-version-offset]');if(btn)loadTaskVersions(btn.closest('[data-task-versions]'),Number(btn.dataset.versionOffset));});
  function editTask(id){const t=state.site.tasks.find(x=>x.id===id);if(!t)return;
    const statusOptions=states.map(x=>'<option value="'+x+'" '+(t.status===x?'selected':'')+'>'+e(human(x))+'</option>').join('');
    show(t.title,'<div class="fields">'+(t.evidence?'<p class="inline-note">'+e(t.evidence)+'</p>':'')+
      '<label>Destino de la mejora<select name="target">'+targetOptions(t.target)+'</select></label><label>Resultado esperado<textarea name="expectedOutcome" rows="2" maxlength="1000">'+e(t.expectedOutcome||targetPlan[validTarget(t.target)])+'</textarea></label>'+
      '<label>Guía para esta mejora<textarea name="brief" rows="10" required maxlength="24000">'+e(t.brief)+'</textarea></label>'+
      '<div class="fields two">'+field('Responsable','responsible',{value:t.responsible||state.user.name,max:100})+field('Página objetivo','page',{value:t.page,type:'url',required:false})+'</div>'+
      '<details><summary>Estado e historial</summary><div class="fields"><label>Estado<select name="status">'+statusOptions+'</select></label>'+field('Fecha del cambio en la web','appliedAt',{type:'date',value:t.appliedAt?.slice(0,10),required:false})+
      '<small>Para registrar una mejora aplicada, indica tanto la página como la fecha.</small>'+(t.verification?'<p>'+e(t.verification.message)+'</p>':'')+(t.result?'<p>'+e(resultText(t.result))+'</p>':'')+
      '<details data-task-versions="'+e(t.id)+'"><summary>Versiones guardadas ('+number(t.versionCount??t.versions?.length??0)+')</summary><div data-version-list aria-live="polite"></div></details></div></details></div>',
      async data=>{const updated=await api(sitePath('/tasks/'+encodeURIComponent(id)),'PATCH',{...data,expectedUpdatedAt:t.updatedAt});return {message:'Mejora guardada.',tab:applied(updated)?'revisiones':'tareas'};},'Guardar mejora');
  }
  function markApplied(id){const t=state.site.tasks.find(x=>x.id===id);if(!t)return;
    show('Registrar cambio publicado','<div class="fields"><p>Completa este paso cuando el equipo ya haya aplicado la mejora <strong>'+e(t.title)+'</strong> en su web.</p>'+field('URL de la página modificada','page',{type:'url',value:t.page||'',placeholder:state.site.url})+field('Fecha en que se aplicó','appliedAt',{type:'date'})+'<small>Usaremos esta fecha para comparar las búsquedas anteriores y posteriores.</small></div>',async data=>{await api(sitePath('/tasks/'+encodeURIComponent(id)),'PATCH',{...data,status:'aplicada',expectedUpdatedAt:t.updatedAt});return {message:'Cambio registrado. Ya puedes seguir su evolución.',tab:'revisiones'};},'Registrar y ver seguimiento');
  }
  function resultText(r){if(typeof r==='string')return r;return [r.message||r.summary||r.reason||r.conclusion||human(r.status),r.deltaClicks!=null?`Cambio de clics: ${number(r.deltaClicks)}`:'',r.deltaImpressions!=null?`Cambio de impresiones: ${number(r.deltaImpressions)}`:''].filter(Boolean).join(' · ');}
  async function addTask(body){
    const sid=state.site.id,r=await api(sitePath('/tasks'),'POST',body);
    if(dialog.open)dialog.close();
    openEditor={site:sid,id:r.id};
    route(sid,'tareas');toast(r.petMilestone?'La guía de mejora está lista para editar.':'Esta búsqueda ya tiene un encargo abierto. Se conservó la edición del equipo.');
  }
  function newSite(){
    if(isDemoAccount()){teamAccess('sitios',true);return;}
    show(state.sites.length?'Agrega una web':'Agrega tu primera web','<div class="fields"><p>Usaremos el sitio y sus servicios para preparar el diagnóstico y sugerir búsquedas relevantes.</p>'+field('Nombre del sitio','name',{placeholder:'Nombre comercial',max:100})+field('Dirección de la web','url',{type:'url',placeholder:'https://ejemplo.cl'})+'<div class="fields two">'+field('País objetivo','country',{value:'Chile',max:80})+field('Idioma','language',{value:'es',max:30})+'</div>'+field('¿A quién atiende el negocio?','business',{placeholder:'Ej. Familias que buscan muebles a medida',max:600})+'<label>Productos o servicios prioritarios<textarea name="services" maxlength="600" required placeholder="Ej. Mesas plegables, escritorios angostos"></textarea></label><label class="check"><input type="checkbox" name="authorized" required> Tengo autorización para analizar esta web y revisar sus páginas públicas.</label></div>',async data=>{const r=await api('sites','POST',{...data,authorized:data.authorized==='on'});route(r.id,'auditoria');return 'Sitio agregado. El primer diagnóstico está en cola.';},'Agregar e iniciar diagnóstico');
  }
  function importCsv(){show('Importar consultas',`<div class="fields"><p>Usa un CSV exportado o pega una tabla. El encabezado <strong>Consulta</strong> es obligatorio.</p><label>Archivo CSV o TSV<input type="file" id="csv-file" accept=".csv,.tsv,text/csv,text/tab-separated-values"></label><label>Contenido del archivo<textarea rows="6" name="csv" id="csv-text" required placeholder="Consulta;Página;Fecha;Impresiones;Clics;Posición"></textarea></label><small>Hasta 5.000 filas y 1,5 MB. Fechas en formato AAAA-MM-DD. Si falta una métrica, deja vacía su celda.</small></div>`,async data=>{await api(sitePath('/import'),'POST',data);return 'Consultas importadas.';},'Importar consultas');}
  function editGoal(){show('Objetivo comercial','<div class="fields">'+field('¿Qué acción quieres que hagan los visitantes?','businessGoal',{value:state.site.businessGoal,placeholder:'Por ejemplo, solicitudes de presupuesto',max:240})+'<small>Se usará para valorar la utilidad comercial de cada oportunidad.</small></div>',async data=>{await api(sitePath('/goal'),'PATCH',data);return 'Objetivo comercial guardado.';},'Guardar objetivo');}
  function captureAI(){
    show('Registrar observación de IA','<div class="fields"><p>Registra una respuesta que hayas comprobado. Una mención de la marca y un enlace a tu sitio son evidencias diferentes.</p><div class="fields two"><label>Motor<select name="engine">'+['ChatGPT','Gemini','Perplexity','Claude','Copilot','AI Overviews','AI Mode','Otro'].map(x=>'<option>'+e(x)+'</option>').join('')+'</select></label>'+field('Fecha de la consulta','date',{type:'date',value:new Intl.DateTimeFormat('sv-SE').format(new Date())})+'</div><label>Pregunta exacta<textarea name="prompt" rows="3" required maxlength="1200"></textarea></label>'+field('URL de tu sitio citada en la respuesta (opcional)','citedUrl',{type:'url',placeholder:state.site.url,required:false})+'<label class="check"><input type="checkbox" name="mentioned"> La respuesta mencionó la marca</label><small>Si tampoco hubo cita, deja la URL vacía. Esa observación también cuenta para la muestra.</small></div>',async data=>{await api(sitePath('/ai-observations'),'POST',{engine:data.engine,date:data.date,prompt:data.prompt,citedUrl:data.citedUrl.trim(),mentioned:data.mentioned==='on'});return 'Observación registrada en la muestra del sitio.';},'Guardar observación');
  }
  function exportCsv(){const arr=filtered(state.site);if(!arr.length){toast('No hay oportunidades para exportar.');return;}const keys=['keyword','category','group','country','device','intent','observed','presence','source','startDate','endDate','impressions','clicks','ctrPercent','position','volume','page','action','priority','reason','goal','target','expectedOutcome'];
    const protect=v=>{const text=String(v??'');return '"'+(/^[\s]*[=+\-@]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};
    const csv=['Consulta;Tipo;Grupo;País;Dispositivo;Intención;Observada;Presencia en títulos y encabezados;Fuente;Inicio;Fin;Impresiones;Clics;CTR (%);Posición;Volumen;Página;Acción;Prioridad;Motivo;Objetivo comercial;Destino editorial;Resultado esperado',...arr.map(o=>{const line={...o,category:categoryName(o),observed:o.observed?'Sí':'No',presence:contentStatus(o),ctrPercent:o.ctr==null?'':o.ctr*100,goal:goalText(o,state.site),target:targets[validTarget(o.target)]};return keys.map(k=>protect(line[k])).join(';');})].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='oportunidades-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function signedIn(demo=false){state.user=(await api('session')).user;if(!state.user)throw new Error('No se pudo iniciar la sesión.');state.q='';state.filter='all';state.page=0;state.longTail=false;if(demo){const {sites}=await api('sites');if(sites[0]){route(sites[0].id);return;}}if(!demo&&location.hash.startsWith('#/sitio/'))await loadRoute();else route();}
  function errorMsg(err){
    if(dialog.open){let box=$('#form-error')||dialog.querySelector('[role=alert]');if(!box){box=document.createElement('p');box.className='inline-note error';box.setAttribute('role','alert');dialog.querySelector('.inside').append(box);}box.textContent=err.message;}
    else if($('#private-error'))$('#private-error').textContent=err.message;else if($('#login-error'))$('#login-error').textContent=err.message;else toast(err.message);
  }
  document.addEventListener('submit',async ev=>{const form=ev.target;if(!['login-form','dialog-form','invite-form'].includes(form.id))return;ev.preventDefault();if(pending)return;pending=true;const submit=form.querySelector('button:not([type=button])');submit.disabled=true;const data=Object.fromEntries(new FormData(form));
    if(form.id==='invite-form'){try{await joinTeam(data);}catch(err){errorMsg(err);}finally{pending=false;submit.disabled=false;}return;}
    try{if(form.id==='login-form'){await api('login','POST',data);await signedIn();}else if(dialogAction){const result=await dialogAction(data,form);dialog.close();if(result?.signupEmail){login({email:result.signupEmail,message:result.message});$('#login-form [name=password]').focus();return;}if(result?.destination)destination(result.destination);else if(result?.tab)route(state.site.id,result.tab);else await loadRoute();if(result)toast(result.message||result);}}catch(err){errorMsg(err);}finally{pending=false;submit.disabled=false;}
  });
  document.addEventListener('click',async ev=>{if(ev.target.closest('.skip')){ev.preventDefault();$('#main')?.focus();return;}const b=ev.target.closest('button[data-action]');if(!b||b.disabled||pending)return;const id=b.dataset.id,act=b.dataset.action; b.disabled=true;
    try{switch(act){
      case 'close':dialog.close();break;
      case 'pet-open':openMascota();break;
      case 'weekly-report':{const report=$('#metodo-analista');if(report){report.tabIndex=-1;report.focus();report.scrollIntoView({block:'start'});}break;}
      case 'my-ai':await configurePersonalAI({api,show,userId:state.user.id});break;
      case 'ai-forget':await api('mi-ia','DELETE',{userId:state.user.id});dialog.close();await loadRoute();toast('Clave eliminada de esta sesión.');break;
      case 'setup':show('Crear administrador local',`<div class="fields">${field('Nombre','name',{max:100})}${field('Usuario o correo','email',{type:'text',auto:'username'})}${field('Contraseña','password',{type:'password',auto:'new-password',min:1})}<small>Puedes usar una clave sencilla.</small></div>`,async data=>{await api('setup','POST',data);state.setupAvailable=false;await signedIn();return 'Cuenta creada.';},'Crear cuenta');break;
      case 'signup':signup();break;
      case 'private-switch':await api('logout','POST',{});state.user=null;state.site=null;state.sites=[];privateScreen();break;
      case 'private-cancel':privateLink=null;if(state.user)route();else login();break;
      case 'owner-pair':{
        const entry=privateLink;if(entry?.kind!=='activar-admin'||!entry.code)return;
        const result=await api('owner-device','POST',{code:entry.code});if(entry!==privateLink||!result.paired)return;
        privateLink=null;login({email:'admin',message:'Este navegador quedó vinculado. Introduce la contraseña para entrar.'});$('#login-form [name=password]').focus();break;
      }
      case 'approval-check':await checkApproval();break;
      case 'demo':await api('demo','POST',{});await signedIn(true);break;
      case 'logout':await api('logout','POST',{});await showSignedOut();break;
      case 'retry':await loadRoute();break;
      case 'sites':route();break;
      case 'diagnostic':destination('diagnostico');break;
      case 'team-access':teamAccess('usuarios');break;
      case 'site-access':{const tab=location.hash.split('/')[3];teamAccess('sitio/'+encodeURIComponent(id)+'/'+(sections.some(s=>s[0]===tab)?tab:'hoy'));break;}
      case 'diagnostic-access':teamAccess('diagnostico');break;
      case 'site':route(id);break;
      case 'tab':route(state.site.id,id);break;
      case 'new-site':newSite();break;
      case 'users':destination('usuarios');break;
      case 'site-members':await siteMembers();break;
      case 'site-profile':{
        const s=state.site;
        show('Editar la ficha de '+s.name,'<div class="fields">'+field('Nombre','name',{value:s.name,max:100})+field('País','country',{value:s.country,max:80})+field('Idioma','language',{value:s.language,max:30})+field('Actividad','business',{value:s.business,max:600})+'<label>Servicios<textarea name="services" required maxlength="600">'+e(s.services)+'</textarea></label></div>',async data=>{await api(sitePath(),'PATCH',data);return 'Ficha actualizada.';},'Guardar ficha');
        break;
      }
      case 'site-remove':{
        const s=state.site;
        show('Retirar '+s.name,'<div class="fields"><p>Se eliminarán de SEOBESTIA su historial, sus tareas y las revisiones pendientes. La web publicada seguirá disponible.</p><p>Para confirmar, escribe <strong class="break">'+e(s.url)+'</strong>.</p>'+field('URL completa','confirmUrl',{auto:'off',max:2048})+'</div>',async data=>{await api(sitePath(),'DELETE',data);return {destination:'sitios',message:'Sitio retirado del seguimiento.'};},'Retirar de SEOBESTIA');
        break;
      }
      case 'import':importCsv();break;
      case 'gsc':case 'ga4':connectionSource=act;route(state.site.id,'conexiones');break;
      case 'edit-goal':editGoal();break;
      case 'ai-capture':captureAI();break;
      case 'kw-group':{
        state.filter=id;state.page=0;
        const tmp=document.createElement('template');tmp.innerHTML=keywords(state.site);
        $('.keyword-panel').replaceWith(tmp.content.querySelector('.keyword-panel'));
        app.querySelector('[data-action="kw-group"][aria-pressed="true"]')?.focus({preventScroll:true});
        break;
      }
      case 'kw-page':state.page=Number(id);$('#keyword-results').innerHTML=keywordTable(state.site);break; case 'export':exportCsv();break;
      case 'opportunity':opportunity(id);break;
      case 'issue':issue(id);break;
      case 'mark-applied':markApplied(id);break;
      case 'evidence':await evidence(id,Math.max(0,Number(b.dataset.offset)||0));break;
      case 'task':editTask(id);break;
      case 'make-op':await addTask({opportunityId:id,target:validTarget($('#op-target')?.value),expectedOutcome:$('#op-outcome')?.value.trim()});break;
      case 'make-issue':await addTask({issueId:id});break;
      case 'run':await api(sitePath('/review'),'POST',{});await loadRoute();toast('Revisión solicitada. Consulta su estado en Revisiones.');break;
    }}catch(err){errorMsg(err);}finally{b.disabled=false;}
  });
  document.addEventListener('input',ev=>{if(ev.target.id==='query'){state.q=ev.target.value;state.page=0;$('#keyword-results').innerHTML=keywordTable(state.site);}});
  document.addEventListener('change',async ev=>{if(ev.target.id==='site-select')route(ev.target.value);else if(ev.target.id==='origin'){state.filter=ev.target.value;state.page=0;$('#keyword-results').innerHTML=keywordTable(state.site);}else if(ev.target.id==='longtail'){state.longTail=ev.target.checked;state.page=0;$('#keyword-results').innerHTML=keywordTable(state.site);}else if(ev.target.id==='csv-file'){try{const file=ev.target.files?.[0];if(!file)return;if(file.size>1500000)throw new Error('Elige un archivo de hasta 1,5 MB.');const t=await file.text();if($('#csv-text'))$('#csv-text').value=t;}catch(err){errorMsg(err);}}});
  document.addEventListener('change',ev=>{
    if(ev.target.id!=='op-target')return;
    const o=state.site.opportunities.find(x=>x.id===ev.target.dataset.op);
    const target=validTarget(ev.target.value),outcome=$('#op-outcome');
    $('#op-target-help').textContent=targetPlan[target];
    if(!outcome.value.trim()||outcome.value===o?.expectedOutcome||Object.values(targetPlan).includes(outcome.value)){
      outcome.value=(target===validTarget(o?.target)&&o?.expectedOutcome)||targetPlan[target];
    }
  });
  window.addEventListener('hashchange',()=>{privateLink=takePrivateLink();focusOnNavigation=true;if(dialog.open)dialog.close();state.q='';state.filter='all';state.page=0;state.longTail=false;loadRoute();});
  try{const info=await api('session');Object.assign(state,{user:info.user,demoAvailable:info.demoAvailable,setupAvailable:info.setupAvailable,localAdminAvailable:info.localAdminAvailable,signupAvailable:info.signupAvailable});if(privateLink)privateScreen();else if(state.user)await loadRoute();else login();}catch(err){app.innerHTML=`<main id="main" tabindex="-1" class="loading"><h2>Conexión interrumpida</h2><p role="alert">${e(err.message)}</p><a class="btn" href="/">Volver a abrir</a></main>`;}
})();
