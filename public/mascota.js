import {animal} from './companions.js';

const animals = {
  hoy:['Lía','Gatita guía'], auditoria:['Mora','Búho del observatorio'],
  keywords:['Miga','Gatita exploradora'], tareas:['Lino','Conejo del taller'],
  revisiones:['Nilo','Gatito astrónomo'], ajustes:['Oliva','Tortuga del jardín']
};
const badges = [
  {at:0,label:'Semilla'}, {at:3,label:'Brote'}, {at:8,label:'En flor'}, {at:16,label:'Jardín'}
];
const points = {registrada:1,aplicada:2,cerrada:1};
const memory = new Map();
const prefix = 'seobestia.mascota.1.';
const esc = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validId = id=>typeof id==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const accountKey = id=>prefix+id+'.';
let session = null;

function get(key) {
  try {return globalThis.localStorage?.getItem(key) ?? memory.get(key);} catch {return memory.get(key);}
}
function save(key,value) {
  memory.set(key,value);
  try {globalThis.localStorage?.setItem(key,value);} catch { /* Keep working for this session. */ }
}
function preferences(id) {
  let saved={};
  try {saved=JSON.parse(get(accountKey(id)+'preferences')||'{}')||{};} catch { /* Use defaults. */ }
  return {kind:Object.hasOwn(animals,saved.kind)?saved.kind:'hoy',name:typeof saved.name==='string'?saved.name.slice(0,24):'',paused:saved.paused===true,hidden:saved.hidden===true};
}
function readScore(id) {
  const start=accountKey(id)+'event.';
  const keys=new Set(memory.keys());
  try {
    const storage=globalThis.localStorage;
    if(storage)for(let i=0;i<storage.length;i++)keys.add(storage.key(i));
  } catch { /* Storage can be disabled by the browser. */ }
  let score=0;
  for(const key of keys) if(key?.startsWith(start)) score+=points[key.split('.').at(-1)]||0;
  return score;
}

export function creditMascota({userId,siteId,taskId,milestone}={}) {
  if(![userId,siteId,taskId].every(validId)||!Object.hasOwn(points,milestone))return false;
  const key=accountKey(userId)+'event.'+siteId+'.'+taskId+'.'+milestone;
  if(get(key))return false;
  save(key,'1');
  if(session?.id===userId){
    session.score=readScore(userId);
    session.lastEvent={registrada:'Registraste una mejora. +1 huella.',aplicada:'Aplicaste una mejora. +2 huellas.',cerrada:'Cerraste una mejora. +1 huella.'}[milestone];
    updatePerch();
    if(session.dialog.open)updatePanel();
  }
  return true;
}

function tipFor(site,tab) {
  if(!site)return ['Elegir un sitio','Abre la web con la que quieres trabajar. Su plan muestra qué revisar primero.'];
  const issues=site.audit?.issues||[], tasks=site.tasks||[];
  switch(tab){
    case 'auditoria':return issues.length?['Leer la evidencia','Abre una incidencia y comprueba la URL y la prueba que la acompaña antes de crear una mejora.']:['Revisar la cobertura','Mira cuántas páginas entraron en la revisión y cuándo se comprobaron.'];
    case 'keywords':return ['Buscar una necesidad concreta','Activa el filtro de long-tail. Abre una búsqueda y comprueba qué página recibe sus impresiones antes de preparar contenido.'];
    case 'tareas':return tasks.length?['Aplicar una mejora','Abre una tarea. Cuando el cambio esté en la web, registra su URL y fecha para empezar a medirlo.']:['Preparar el primer encargo','En Keywords, elige una consulta observada y conviértela en una mejora con página y objetivo.'];
    case 'revisiones':return ['Leer un cambio en el gráfico','Selecciona una fecha en el gráfico y compárala con el registro de mejoras. Comprueba también la fuente y la cobertura del período.'];
    case 'ajustes':return ['Comprobar el origen de los datos','Revisa qué fuentes están conectadas al sitio. Search Console aporta consultas, impresiones y clics.'];
    default:return issues.length?['Empezar por un hallazgo','Hay '+issues.length+(issues.length===1?' incidencia técnica registrada.':' incidencias técnicas registradas.')+' Abre Auditar para ver la evidencia de cada página.']:['Dar el siguiente paso','Sigue la acción que propone el plan. Si ya revisaste la web, explora qué consultas podrían atraer a tu público.'];
  }
}
function level(score) {
  const current=badges.findLastIndex(item=>score>=item.at);
  return {current:badges[current],next:badges[current+1],index:current};
}
function nameOf(s){return s.prefs.name||animals[s.prefs.kind][0];}
function storePrefs(s){save(accountKey(s.id)+'preferences',JSON.stringify(s.prefs));}
function updatePerch(){
  const s=session;
  if(!s)return;
  s.perch.hidden=s.prefs.hidden;
  const {current,index}=level(s.score);
  const signature=[s.prefs.kind,nameOf(s),s.score,s.prefs.paused,s.tab,s.site?.id,s.lastEvent].join('|');
  if(s.signature===signature)return;
  s.signature=signature;
  s.perch.classList.remove('pet-walk');
  s.perch.innerHTML='<button type="button" class="pet-perch-button" aria-haspopup="dialog"><span class="pet-perch-land pet-garden-'+index+'" aria-hidden="true"><span class="pet-track">'+animal(s.prefs.kind)+'</span><span class="pet-sprout">✦</span></span><span class="pet-perch-copy"><small>Tu compañía</small><strong>'+esc(nameOf(s))+'</strong><span>'+esc(current.label)+' · '+s.score+(s.score===1?' huella':' huellas')+'</span></span></button>'+(s.lastEvent?'<p class="pet-receipt">'+esc(s.lastEvent)+'</p>':'');
}
function updatePanel() {
  const s=session;
  if(!s)return;
  const tip=tipFor(s.site,s.tab), {current,next,index}=level(s.score);
  const name=nameOf(s);
  s.dialog.querySelector('[data-pet-portrait]').innerHTML=animal(s.prefs.kind);
  s.dialog.querySelector('[data-pet-scene]').className='pet-scene pet-garden-'+index;
  s.dialog.querySelector('[data-pet-title]').textContent=name;
  s.dialog.querySelector('[data-pet-role]').textContent=animals[s.prefs.kind][1];
  s.dialog.querySelector('[data-pet-tip-title]').textContent=tip[0];
  s.dialog.querySelector('[data-pet-tip]').textContent=tip[1];
  s.dialog.querySelector('[data-pet-level]').textContent=current.label+' · '+s.score+(s.score===1?' huella':' huellas');
  const progress=s.dialog.querySelector('progress');
  progress.max=next?.at||badges.at(-1).at;
  progress.value=Math.min(s.score,progress.max);
  s.dialog.querySelector('[data-pet-next]').textContent=next?'Faltan '+(next.at-s.score)+(next.at-s.score===1?' huella':' huellas')+' para '+next.label+'.':'Tu jardín está en flor. Las siguientes huellas se siguen contando.';
  const pause=s.dialog.querySelector('[data-pet-pause]');
  pause.textContent=s.prefs.paused?'Reanudar paseos':'Pausar paseos';
  pause.setAttribute('aria-pressed',String(s.prefs.paused));
  s.dialog.querySelector('[data-pet-stroll]').disabled=s.prefs.paused||s.prefs.hidden||s.motion.matches;
  s.dialog.querySelector('[data-pet-hide]').textContent=s.prefs.hidden?'Mostrar compañía en el taller':'Ocultar compañía del taller';
  s.dialog.querySelector('[data-pet-event]').textContent=s.lastEvent||'';
}
function dialogMarkup() {
  const options=Object.entries(animals).map(([kind,[name,role]])=>'<option value="'+kind+'">'+name+' · '+role+'</option>').join('');
  return `<div class="pet-dialog-body"><div class="pet-dialog-head"><p class="eyebrow">Tu compañía del taller</p><button type="button" class="pet-close" data-pet-close aria-label="Cerrar compañía">×</button></div>
    <div data-pet-scene><span class="pet-big-portrait" data-pet-portrait></span><div><small data-pet-role></small><h2 id="pet-title" data-pet-title></h2></div></div>
    <div class="pet-note"><small>Una pista para este paso</small><h3 data-pet-tip-title></h3><p data-pet-tip></p></div>
    <section class="pet-growth" aria-label="Progreso de tu compañía"><strong data-pet-level></strong><progress aria-label="Huellas en el taller"></progress><p data-pet-next></p><small>Registrar una mejora suma una huella, aplicarla suma dos y cerrarla suma una.</small></section>
    <p data-pet-event role="status" class="pet-event"></p>
    <details class="pet-settings"><summary>Personalizar compañía</summary><form class="pet-form"><label>Animal<select name="kind">${options}</select></label><label>Apodo opcional<input name="name" maxlength="24" autocomplete="off" placeholder="Usar su nombre original"></label><button class="btn primary compact" type="submit">Guardar compañía</button></form></details>
    <div class="pet-controls"><button type="button" data-pet-stroll>Dar un paseo</button><button type="button" data-pet-pause></button><button type="button" data-pet-hide></button></div></div>`;
}
function openSettings() {
  const s=session;
  if(!s)return;
  const form=s.dialog.querySelector('.pet-form');
  form.elements.kind.value=s.prefs.kind;
  form.elements.name.value=s.prefs.name;
}
export function openMascota() {
  const s=session;
  if(!s||s.dialog.open||document.querySelector('dialog[open]'))return;
  s.opener=document.activeElement;
  s.walker?.remove();
  updatePanel();
  openSettings();
  s.dialog.showModal();
  s.dialog.querySelector('[data-pet-close]').focus();
}
function canWalk(s) {
  return !s.prefs.paused&&!s.prefs.hidden&&!document.hidden&&!s.motion.matches&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,select,textarea,[contenteditable=true]');
}
function walkAcross(s){
  if(!canWalk(s)||s.walker?.isConnected)return;
  const walker=document.createElement('div');
  walker.className='pet-walker';walker.setAttribute('aria-hidden','true');
  walker.innerHTML=animal(s.prefs.kind);
  s.walker=walker;document.body.append(walker);
  walker.addEventListener('animationend',()=>walker.remove(),{once:true});
}
function scheduleWalk(s,delay) {
  clearTimeout(s.timer);
  if(s.prefs.paused||s.prefs.hidden||s.motion.matches||document.hidden)return;
  s.timer=setTimeout(()=>{
    if(session!==s)return;
    if(canWalk(s)){
      if(!s.lastWalk||Date.now()-s.lastWalk>180000){walkAcross(s);s.lastWalk=Date.now();}
      else s.perch.classList.add('pet-walk');
    }
    scheduleWalk(s,45000+Math.random()*25000);
  },delay);
}
function dispose(){
  const s=session;
  if(!s)return;
  clearTimeout(s.timer);
  s.life.abort();
  if(s.dialog.open)s.dialog.close();
  s.dialog.remove();
  s.walker?.remove();
  s.perch.remove();
  session=null;
}
function createSession(id) {
  const s={id,prefs:preferences(id),score:readScore(id),life:new AbortController(),motion:matchMedia('(prefers-reduced-motion: reduce)'),dialog:document.createElement('dialog'),perch:document.createElement('aside')};
  const opt={signal:s.life.signal};
  s.perch.className='pet-perch';
  s.perch.setAttribute('aria-label','Tu compañía del taller');
  s.dialog.className='pet-dialog';
  s.dialog.setAttribute('aria-labelledby','pet-title');
  s.dialog.innerHTML=dialogMarkup();
  document.body.append(s.dialog);
  s.perch.addEventListener('click',openMascota,opt);
  s.perch.addEventListener('animationend',()=>s.perch.classList.remove('pet-walk'),opt);
  s.dialog.addEventListener('close',()=>{
    s.dialog.querySelector('details').open=false;
    const target=s.opener?.isConnected?s.opener:document.querySelector('[data-action="pet-open"]');
    if(!document.querySelector('dialog[open]'))target?.focus({preventScroll:true});
  },opt);
  s.dialog.addEventListener('click',ev=>{
    if(ev.target.closest('[data-pet-close]'))s.dialog.close();
    else if(ev.target.closest('[data-pet-stroll]')){s.dialog.close();walkAcross(s);s.lastWalk=Date.now();}
    else if(ev.target.closest('[data-pet-pause]')){
      s.prefs.paused=!s.prefs.paused;
      storePrefs(s);updatePerch();updatePanel();scheduleWalk(s,12000);
    } else if(ev.target.closest('[data-pet-hide]')){
      s.prefs.hidden=!s.prefs.hidden;
      storePrefs(s);updatePerch();updatePanel();scheduleWalk(s,12000);
      if(s.prefs.hidden){s.opener=document.querySelector('[data-action="pet-open"]');s.dialog.close();}
    }
  },opt);
  s.dialog.querySelector('form').addEventListener('submit',ev=>{
    ev.preventDefault();
    const form=ev.currentTarget;
    if(!Object.hasOwn(animals,form.elements.kind.value))return;
    s.prefs.kind=form.elements.kind.value;
    s.prefs.name=form.elements.name.value.trim().slice(0,24);
    storePrefs(s);updatePerch();updatePanel();openSettings();
    s.dialog.querySelector('[data-pet-event]').textContent='Compañía guardada.';
  },opt);
  window.addEventListener('storage',ev=>{
    if(ev.key!==null&&!ev.key.startsWith(accountKey(id)))return;
    if(ev.key!==null)memory.delete(ev.key);
    else for(const key of memory.keys())if(key.startsWith(accountKey(id)))memory.delete(key);
    s.prefs=preferences(id);s.score=readScore(id);updatePerch();
    if(s.prefs.hidden||s.prefs.paused)s.walker?.remove();
    if(s.dialog.open)updatePanel();
    scheduleWalk(s,17000);
  },opt);
  const activity=()=>{s.walker?.remove();s.perch.classList.remove('pet-walk');if(s.dialog.open)updatePanel();scheduleWalk(s,15000);};
  document.addEventListener('visibilitychange',activity,opt);
  s.motion.addEventListener('change',activity,opt);
  scheduleWalk(s,14000);
  return s;
}

export function syncMascota({user,site,tab}={}) {
  if(!validId(user?.id)){dispose();return;}
  if(session?.id!==user.id){dispose();session=createSession(user.id);}
  const s=session;
  s.site=site;s.tab=site?tab:'directorio';
  const host=document.querySelector('.sidebar')||document.querySelector('main.frame');
  if(host&&s.perch.parentElement!==host)host.append(s.perch);
  if(!host)s.perch.remove();
  updatePerch();
  if(s.dialog.open)updatePanel();
}
