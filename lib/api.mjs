import {randomUUID,randomBytes} from 'node:crypto';
import {ownerTokenFromCookie,pairOwnerDevice} from './auth.mjs';
import {teamInvitation} from './team-invite.mjs';
import {readGscArchive} from './gsc-archive.mjs';
import {historicalAnalytics,identifyStream,liveAnalytics,metricsInput} from './analytics.mjs';
import {metricsFor} from './dashboard.mjs';
import {auditReport} from './audit-report.mjs';
import {editorialFor} from './editorial.mjs';
import {analysisFor} from './analyst.mjs';
import {generatePersonalIdeas} from './ideas-ia.mjs';
import {findDraft,personalKey,requestEditorialDrafts} from './personal.mjs';
import {upgradeDemoWorkshop} from './demo-taller.mjs';
import {validDay} from './sources.mjs';
import {authenticate,login,logout,createUser,ensureLocalAdmin,manageUser,canAccessSite,tokenFromCookie,sessionCookie,clearSessionCookie,signupAvailable,requestSignup,createInitialAdminFromHash} from './auth.mjs';
import {prepStatus} from './google-local.mjs';
import {discoverGoogle,linkDiscovered} from './google-status.mjs';
import {diagnose} from './diagnostico.mjs';
import {newSite,makeDemo,detail,mergeCsv,evidenceRows,siteOpportunities,addTask,editTask,field,measure,taskView,versionPage} from './site.mjs';
import {manualReview} from './reviews.mjs';
import {panelSettings} from './ai-panel.mjs';
import {parseCsv,hasGsc,verifyProperty,propertyOf,problem} from './sources.mjs';

const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function scope(st,user,id) {
  const s=st.sites.find(x=>x.id===id && canAccessSite(user,x));
  if(!s) throw problem('Sitio no disponible.',404);return s;
}
function admin(u) {if(u?.role!=='admin') throw problem('Se requieren permisos de administrador.',403);}
function requireConnectionAccess(site,user){
  if(site.demo)throw problem('Las conexiones de Google se verifican desde una web real.');
  if(!user||user.disabled||user.pendingApproval||!(user.role==='admin'||site.memberIds?.includes(user.id)))throw problem('Un administrador debe asignarte esta web para que puedas vincular sus propiedades de Google.',403);
}
function scopedGscProperty(site,requested,actor){
  const prop=propertyOf(site.url,requested);
  if(actor.role==='admin')return prop;
  const base=new URL(site.url);
  const allowed=prop.startsWith('sc-domain:')?base.pathname==='/'&&prop==='sc-domain:'+base.hostname:
    new URL(prop).pathname.replace(/\/$/,'')===base.pathname.replace(/\/$/,'');
  if(!allowed)throw problem('Usa una propiedad que coincida con este sitio. Para una carpeta, indica su prefijo de URL exacto.');
  return prop;
}
async function payload(req) {
  if(!req.headers.get('content-type')?.startsWith('application/json')) throw problem('Se requiere JSON.',415);
  if(Number(req.headers.get('content-length'))>2000000) throw problem('Archivo demasiado grande.',413);
  const buf=await req.arrayBuffer();
  if(buf.byteLength>2000000) throw problem('Archivo demasiado grande.',413);
  try {const b=JSON.parse(new TextDecoder().decode(buf)||'{}'); if(b&&typeof b==='object'&&!Array.isArray(b))return b;}catch {}
  throw problem('Datos JSON inválidos.');
}
const hints=s=>({id:s.id,name:s.name,url:s.url,country:s.country,demo:s.demo,score:s.audit?.score??s.score??null,lastReviewAt:s.lastReviewAt||null,gsc:Boolean(s.gscProperty),ga4:Boolean(s.ga4PropertyId)});
const publicUser=({id,email,name,role})=>({id,email,name,role});
export async function bootstrap(store,{local=false}={}) {
  if(local)await ensureLocalAdmin(store);
  if(!process.env.SEO_ADMIN_EMAIL || !(process.env.SEO_ADMIN_PASSWORD_HASH||process.env.SEO_ADMIN_PASSWORD)) return;
  if((await store.read({keys:['users']})).users.some(u=>u.role==='admin'&&!u.localOnly)) return;
  const input={name:process.env.SEO_ADMIN_NAME||'Administrador',email:process.env.SEO_ADMIN_EMAIL};
  try {
    if(process.env.SEO_ADMIN_PASSWORD_HASH)await createInitialAdminFromHash(store,{...input,passwordHash:process.env.SEO_ADMIN_PASSWORD_HASH});
    else await createUser(store,{...input,password:process.env.SEO_ADMIN_PASSWORD,role:'admin',onlyFirstAdmin:true,ignoreLocalOnly:true});
  }
  catch(e){if(e.status!==409)throw e;}
}
const activeDiagnostics=new Set();
export async function handle(req,{store,local=false,ip='',wake=async()=>{},generateIdeas=generatePersonalIdeas,googleManager=null,diagnostic=diagnose,googleTransport}={}) {
 try {
  const parsed=new URL(req.url), path=parsed.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean), method=req.method;
  const [base,id,action,item]=path;
  const change=!['GET','HEAD'].includes(method);
  if(change && ((req.headers.get('origin') && req.headers.get('origin')!==parsed.origin)||req.headers.get('sec-fetch-site')==='cross-site')) throw problem('Origen no autorizado.',403);
  const token=tokenFromCookie(req.headers.get('cookie')||'');
  const user=await authenticate(store,token,{local});
  const data=change?await payload(req):{};
  if(base==='owner-device'&&!id&&method==='POST'){
    if(local || parsed.protocol!=='https:' || req.headers.get('origin')!==parsed.origin)throw problem('La activación se realiza en el sitio seguro del equipo.',403);
    if(user)throw problem('Cierra tu sesión antes de activar el navegador del dueño.',409);
    const cookie=await pairOwnerDevice(store,data.code,ip);
    return json({paired:true},200,{'Set-Cookie':cookie});
  }
  if(base==='session'&&method==='GET'&&!id) return json({user,signupAvailable:!user && await signupAvailable(store,local),demoAvailable:local,localAdminAvailable:local&&store.backend==='sqlite',setupAvailable:local && !(await store.read({keys:['users']})).users.some(u=>u.role==='admin')});
  if(user?.pendingApproval && !(base==='logout' && method==='POST' && !id)) throw problem('Tu cuenta está pendiente de aprobación por el administrador del equipo.',403);
  if(base==='signup' && method==='POST' && !id) {
    if(user) throw problem('Cierra tu sesión antes de registrar una cuenta.',409);
    const signup=await requestSignup(store,data,{local,ip});return json(signup,signup.approved?201:202);
  }
  if(base==='setup'&&method==='POST'&&local) {
    if(user) throw problem('Cierra la sesión actual para crear el primer administrador.',409);
    const added=await createUser(store,{email:data.email,name:data.name,password:data.password,role:'admin',onlyFirstAdmin:true});
    const session=await login(store,{email:data.email,password:data.password,ip});
    return json({user:added},201,{'Set-Cookie':sessionCookie(session.token,{secure:false,expiresAt:session.expiresAt})});
  }
  if(base==='demo'&&method==='POST'&&local) {
    if(user) {const prior=(await store.read()).sites.find(s=>s.demo&&s.ownerId===user.id);if(prior)return json({user,id:prior.id});}
    const password=randomBytes(30).toString('base64url');
    const email='demo-'+randomUUID()+'@local.example';
    await store.mutate(s=>{
      const stale=s.users.filter(u=>u.email.startsWith('demo-')&&u.email.endsWith('@local.example')&&Date.parse(u.createdAt)<Date.now()-7*86400000).map(u=>u.id);
      const sites=s.sites.filter(x=>x.demo&&stale.includes(x.ownerId)).map(x=>x.id);
      s.users=s.users.filter(u=>!stale.includes(u.id));s.sites=s.sites.filter(x=>!sites.includes(x.id));
      s.sessions=s.sessions.filter(x=>!stale.includes(x.userId));s.jobs=s.jobs.filter(x=>!sites.includes(x.siteId));
      if(s.sites.filter(x=>x.demo).length>=100)throw problem('Se alcanzó el máximo de sesiones de demostración locales.',429);
    });
    const demoUser=await createUser(store,{email,password,name:'Equipo de muestra'});
    const sample=makeDemo(demoUser);await store.mutate(s=>s.sites.push(sample));
    const session=await login(store,{email,password,ip});
    return json({user:demoUser,id:sample.id},200,{'Set-Cookie':sessionCookie(session.token,{secure:false,expiresAt:session.expiresAt})});
  }
  if(base==='login'&&method==='POST') {
    const s=await login(store,{email:data.email,password:data.password,ip,local,ownerDeviceToken:ownerTokenFromCookie(req.headers.get('cookie')||'')});if(token)await logout(store,token);return json({user:s.user},200,{'Set-Cookie':sessionCookie(s.token,{secure:!local,expiresAt:s.expiresAt})});
  }
  if(base==='logout'&&method==='POST') {await logout(store,token);return json({ok:true},200,{'Set-Cookie':clearSessionCookie({secure:!local})});}
  if(!user) throw problem('Inicia sesión.',401);
  if(base==='team-invite'&&!id){admin(user);return json(await teamInvitation(store,user,method,local));}
  if(base==='diagnostico'&&!id&&method==='POST'){
    if(activeDiagnostics.has(user.id)||activeDiagnostics.size>=6)throw problem('Hay un diagnóstico en curso. Espera a que termine y vuelve a intentarlo.',429);
    activeDiagnostics.add(user.id);
    try{return json(await diagnostic(data,{demo:user.email.endsWith('@local.example')}));}
    finally{activeDiagnostics.delete(user.id);}
  }
  if(base==='conexiones'){
    admin(user);
    const manager=local||googleManager?.mode==='hosted'?googleManager:null;
    const preparation=()=>({...prepStatus(manager),storage:local?'local':'hosted'});
    if(id==='preparacion'&&method==='GET')return json(preparation());
    if(id==='credencial'&&method==='POST'){
      if(!manager)throw problem('Esta instalación usa las variables privadas del servidor.',409);
      await manager.save(data.target,data.credential);
      return json(preparation());
    }
    if(id==='descubrir'&&method==='POST'){
      const {gsc,ga4}=prepStatus(null);
      if(!gsc.configured&&!ga4.configured)throw problem('Prepara la cuenta de servicio en Conexiones de Google.',409);
      const found=await discoverGoogle(googleTransport);
      const rows=await linkDiscovered((await store.read({keys:['sites']})).sites.filter(s=>!s.demo),found,googleTransport);
      await store.mutate(state=>{
        for(const {id:siteId,change} of rows){
          const current=state.sites.find(s=>s.id===siteId);if(!current)continue;
          const {gscProperty,...analytics}=change;
          if(gscProperty&&!current.gscProperty)current.gscProperty=gscProperty;
          if(analytics.ga4PropertyId&&!current.ga4PropertyId)Object.assign(current,analytics);
        }
      },{keys:['sites']});
      const usedGsc=new Set(rows.map(r=>r.gsc)),usedGa4=new Set(rows.flatMap(r=>[r.ga4,...r.ambiguous]));
      return json({
        linkedNow:rows.reduce((n,r)=>n+Boolean(r.change.gscProperty)+Boolean(r.change.ga4PropertyId),0),
        sites:rows.map(({change,...row})=>row),
        unused:{gsc:(found.gsc||[]).filter(p=>!usedGsc.has(p)),ga4:(found.ga4||[]).filter(p=>p.streams.length&&!usedGa4.has(p.id)).map(p=>({id:p.id,name:p.name}))},
        gtm:found.gtm||[],errors:found.errors
      });
    }
    throw problem('Ruta de conexión desconocida.',404);
  }
  if(base==='sistema'&&method==='GET'&&!id){
    admin(user);
    const st=await store.read({keys:['jobs','sites'],siteSummary:true});
    return json({node:process.versions.node,storage:store.backend,local,sites:st.sites.filter(s=>!s.demo).length,pending:st.jobs.filter(j=>['pending','running'].includes(j.status)).length,google:prepStatus(local||googleManager?.mode==='hosted'?googleManager:null)});
  }
  if(base==='mi-ia'&&!id)return json(await personalKey(store,user,token,method,data));
  if(base==='users') {
    admin(user);
    if('passwordHash' in data)throw problem('Introduce una contraseña para la cuenta.');
    if(method==='GET'&&!id){
      const st=await store.read({keys:['users','sites'],siteSummary:true});
      return json({users:st.users.filter(u=>!u.email.endsWith('@local.example')&&(!u.localOnly||local)).map(u=>({...publicUser(u),localOnly:Boolean(u.localOnly),disabled:Boolean(u.disabled),pendingApproval:Boolean(u.pendingApproval),siteIds:st.sites.filter(s=>!s.demo&&s.memberIds?.includes(u.id)).map(s=>s.id)}))});
    }
    if(method==='PATCH'&&id)return json(await manageUser(store,user,id,data));
    if(method==='POST'&&!id) {
      const ids=data.siteIds??[];
      if(!Array.isArray(ids)||ids.length>100||ids.some(x=>typeof x!=='string')) throw problem('Selección de sitios inválida.');
      const added=await createUser(store,{email:data.email,name:data.name,password:data.password,role:data.role||'member',siteIds:ids});
      return json(added,201);
    }
  }
  if(base!=='sites') throw problem('Ruta desconocida.',404);
  if(!id && method==='GET') {const st=await store.read({keys:['sites'],siteSummary:true});return json({sites:st.sites.filter(s=>canAccessSite(user,s)&&(!s.demo||s.ownerId===user.id||s.memberIds?.includes(user.id))).map(hints)});}
  if(!id && method==='POST') {
    const site=newSite(data,user);
    if(user.email.endsWith('@local.example'))throw problem('Para analizar una web real, inicia sesión con una cuenta de tu equipo.',403);
    if(data.gscProperty){admin(user);site.gscProperty=await verifyProperty({...site,gscProperty:data.gscProperty});}
    await store.mutate(st=>{
      if(store.backend!=='sqlite'&&st.sites.filter(s=>!s.demo).length>=3) throw problem('El alojamiento gratuito del piloto admite hasta tres sitios en seguimiento. Puedes usar Diagnóstico sin agregar.',409);
      if(st.sites.some(s=>s.url===site.url&&!s.demo)) throw problem('El sitio ya está registrado.',409);
      st.sites.push(site); manualReview(st,site);
    });
    await wake().catch(()=>{});return json({id:site.id},201);
  }
  const connection=action==='gsc'||action==='ga4';
  const selection=action==='live'||(connection&&method==='GET')?{keys:['sites'],siteId:id,siteSummary:true}:{keys:['sites','jobs'],siteId:id};
  const st=await store.read(selection);let site=scope(st,user,id);
  if(connection){
    if(item||!['GET','POST'].includes(method))throw problem('Ruta de conexión desconocida.',404);
    requireConnectionAccess(site,user);
    if(method==='GET'){
      const {configured,email}=prepStatus(null)[action];return json({configured,email});
    }
  }
  const saveConnection=change=>store.mutate(state=>{
    const actor=state.users.find(u=>u.id===user.id);
    const current=state.sites.find(s=>s.id===id);if(!current)throw problem('Sitio no disponible.',404);
    requireConnectionAccess(current,actor);
    const fields=action==='gsc'?['gscProperty']:['ga4PropertyId','ga4StreamId','ga4LiveReviewRequired'];
    if(current.url!==site.url||actor.role!==user.role||fields.some(k=>current[k]!==site[k]))throw problem('La conexión o los permisos cambiaron. Recarga antes de volver a verificar.',409);
    return change(current);
  },{keys:['sites','users'],siteId:id});
  if(local&&action!=='live'&&site.demo&&site.url==='https://maderasur.example/'&&!Object.hasOwn(site,'demoWorkshopVersion')){
    site=await store.mutate(state=>{const current=scope(state,user,id);upgradeDemoWorkshop(current);return current;},selection);
  }
  if(action==='audit'&&method==='GET') return json(auditReport(site,Object.fromEntries(parsed.searchParams)));
  if(action==='gsc-archives' && method==='GET' && item && path.length===4){
    admin(user);
    const archive=await readGscArchive(store,site,item);
    return json(archive,200,{'Content-Disposition':'attachment; filename="consultas-'+item+'.json"'});
  }
  if(action==='gsc-detail' && method==='GET' && !item){
    admin(user);
    const offset=Number(parsed.searchParams.get('offset')||0);
    if(!Number.isSafeInteger(offset)||offset<0)throw problem('Desplazamiento inválido.');
    const rows=site.rows.filter(r=>r.source==='Search Console');
    return json({site:site.url,until:site.gscUntil||null,offset,total:rows.length,rows:rows.slice(offset,offset+200)},200,{'Content-Disposition':'attachment; filename="consultas-conservadas-'+offset+'.json"'});
  }
  if(action==='editorial'&&method==='GET') return json(editorialFor(site,evidenceRows(site),Number(parsed.searchParams.get('limit')??5)));
  if(action==='editorial-ia'&&method==='POST'){
    if(data.userId!==user.id)throw problem('La cuenta ha cambiado. Recarga antes de generar ideas.',409);
    const limit=data.limit;
    if(!Number.isInteger(limit)||limit<1||limit>5)throw problem('Elige entre una y cinco ideas por solicitud.');
    const report=editorialFor(site,evidenceRows(site),limit);
    const drafts=await requestEditorialDrafts({store,user,token,site,ideas:report.ideas,provider:data.provider,generate:generateIdeas});
    return json({...report,ideas:report.ideas.map(idea=>({...idea,draft:drafts.find(d=>d.id===idea.id)}))});
  }
  if(action==='analysis'&&method==='GET') return json(analysisFor(site));
  if(action==='metrics'&&method==='GET') {
    const requested=Number(parsed.searchParams.get('days')||28);
    if(!Number.isInteger(requested)||requested<7||requested>90)throw problem('Elige un período entre 7 y 90 días.');
    return json(metricsFor(metricsInput(site),requested));
  }
  if(action==='live'&&method==='GET') return json(await liveAnalytics(site));
  if(action==='goal'&&method==='PATCH') {
    const goal=field(data.businessGoal,'objetivo comercial',240,false);
    await store.mutate(state=>{scope(state,user,id).businessGoal=goal;},selection);
    return json({businessGoal:goal});
  }
  if(action==='ga4'&&method==='POST') {
    const delegated=user.role!=='admin';
    if(delegated&&data.confirmLiveScope)throw problem('La confirmación del flujo en vivo corresponde al administrador.',403);
    let binding;
    try{binding=await identifyStream(site,data.propertyId,{...googleTransport,strictOrigin:delegated});}
    catch(err){
      if(!delegated)throw err;
      throw problem('No se pudo verificar un único flujo con la URL raíz de esta web. Revisa el ID de la propiedad, su URL predeterminada y el permiso de lectura.');
    }
    const first=await historicalAnalytics({...site,...binding},googleTransport);
    const same=site.ga4PropertyId===binding.ga4PropertyId&&site.ga4StreamId===binding.ga4StreamId;
    const review=delegated?(!same||Boolean(site.ga4LiveReviewRequired)):Boolean(site.ga4LiveReviewRequired)&&data.confirmLiveScope!==true;
    await saveConnection(current=>{Object.assign(current,binding,first,{ga4LiveReviewRequired:review});});
    return json({propertyId:binding.ga4PropertyId,updatedAt:first.ga4UpdatedAt,liveReviewRequired:review});
  }
  if(action==='ai-panel'&&method==='PATCH') {
    const settings=panelSettings(data);
    await store.mutate(state=>{Object.assign(scope(state,user,id),settings);},selection);
    return json(settings);
  }
  if(action==='ai-observations'&&method==='POST') {
    const observation={id:randomUUID(),engine:field(data.engine,'motor',60),date:field(data.date,'fecha',10),prompt:field(data.prompt,'pregunta',1200),citedUrl:'',mentioned:data.mentioned,author:user.name,recordedAt:new Date().toISOString()};
    if(typeof observation.mentioned!=='boolean'||!validDay(observation.date)||observation.date>new Date().toISOString().slice(0,10))throw problem('Comprueba fecha y mención de marca.');
    if(data.citedUrl) {
      let u; try{u=new URL(field(data.citedUrl,'URL citada',2000));}catch{throw problem('Introduce una URL citada válida.');}
      const baseUrl=new URL(site.url),basePath=baseUrl.pathname.replace(/\/$/,'');
      if(u.origin!==baseUrl.origin||u.username||u.password||!(u.pathname===basePath||u.pathname.startsWith(basePath+'/')))throw problem('La URL citada debe pertenecer a este sitio. Registra una muestra sin cita si enlaza a terceros.');
      observation.citedUrl=u.href;
    }
    observation.cited=Boolean(observation.citedUrl);
    observation.url=observation.citedUrl;
    await store.mutate(state=>{
      const s=scope(state,user,id);
      s.aiObservations??=[];
      if(s.aiObservations.filter(o=>!o.series).length>=1000)throw problem('Límite de 1.000 observaciones del piloto.',409);
      s.aiObservations.push(observation);
      for(const task of s.tasks.filter(t=>t.appliedAt&&['ia','ambos'].includes(t.target)))measure(s,task);
    },selection);
    return json(observation,201);
  }
  if(!action&&method==='GET') return json(detail(site,st.jobs));
  if(!action&&method==='PATCH'){
    admin(user);
    const profile={name:field(data.name,'nombre',100),country:field(data.country,'país',80),language:field(data.language,'idioma',30),business:field(data.business,'actividad',600),services:field(data.services,'servicios',600)};
    await store.mutate(state=>Object.assign(scope(state,user,id),profile,{analysisInputsAt:new Date().toISOString()}),selection);
    return json(profile);
  }
  if(!action&&method==='DELETE'){
    admin(user);
    await store.mutate(state=>{
      const current=scope(state,user,id);
      if(data.confirmUrl!==current.url)throw problem('Escribe la URL completa que aparece en la ficha para retirar el sitio.');
      if(state.jobs.some(j=>j.siteId===id&&j.status==='running'))throw problem('Hay una revisión en curso. Espera a que termine antes de retirar el sitio.',409);
      state.jobs=state.jobs.filter(j=>j.siteId!==id);
      state.sites=state.sites.filter(s=>s.id!==id);
    },selection);return json({removed:true});
  }
  if(action==='members'&&method==='PATCH') {
    admin(user);
    if(!Array.isArray(data.memberIds)||data.memberIds.length>100) throw problem('Selección de miembros inválida.');
    await store.mutate(s=>{
      const ids=[...new Set(data.memberIds)];
      if(ids.some(uid=>!s.users.some(u=>u.id===uid&&u.role==='member'&&!u.disabled&&!u.pendingApproval&&!u.email.endsWith('@local.example')))) throw problem('Selecciona miembros activos y aprobados del equipo.');
      scope(s,user,id).memberIds=ids;
    },{keys:['sites','users'],siteId:id});
    return json({ok:true});
  }
  if(action==='evidence'&&method==='GET') {
    const op=siteOpportunities(site).find(o=>o.id===parsed.searchParams.get('opportunityId'));
    if(!op) throw problem('Oportunidad desconocida.',404);
    const words=new Set([op.keyword,...op.variants].map(k=>k.trim().toLowerCase()));
    const rows=evidenceRows(site).filter(r=>words.has(r.query.trim().toLowerCase())&&r.country===op.country&&r.device===op.device&&op.source===r.source&&(!op.observed||Boolean(r.date)===Boolean(op.startDate))&&(!op.startDate||(r.date>=op.startDate&&r.date<=op.endDate))).sort((a,b)=>b.date.localeCompare(a.date));
    const offset=Math.max(0,Number.parseInt(parsed.searchParams.get('offset'),10)||0);
    return json({rows:rows.slice(offset,offset+40),total:rows.length});
  }
  if(action==='tasks' && item && path[4]==='versions' && path.length===5 && method==='GET') {
    return json(versionPage(site,item,Number(parsed.searchParams.get('offset')||0)));
  }
  if(action==='import'&&method==='POST') {
    const rows=parseCsv(data.csv,site);await store.mutate(s=>{mergeCsv(scope(s,user,id),rows);},selection);return json({count:rows.length});
  }
  if(action==='tasks' && ['PATCH','POST'].includes(method)) {
    const result=await store.mutate(s=>{
      const current=scope(s,user,id);
      if(method==='PATCH'&&item){
        const before=current.tasks.find(t=>t.id===item)?.status;
        const task=editTask(current,item,data,user);
        const milestone=task.status==='cerrada'&&before!=='cerrada'?'cerrada':
          ['aplicada','en_seguimiento'].includes(task.status)&&!['aplicada','en_seguimiento','cerrada'].includes(before)?'aplicada':null;
        return {...taskView(task),petMilestone:milestone};
      }
      if(method==='POST'&&!item){
        const before=current.tasks.length;
        const draft=data.draftId?findDraft(s,user,token,id,data):null;
        const task=addTask(current,data,user,draft);
        return {...taskView(task),petMilestone:before===current.tasks.length?null:'registrada'};
      }
      throw problem('Ruta de tarea inválida.');
    },data.draftId?{keys:['sites','sessions'],siteId:id}:selection);return json(result);
  }
  if(action==='gsc'&&method==='POST') {
    const requested=scopedGscProperty(site,data.gscProperty,user);
    if(!hasGsc())throw problem('Prepara la cuenta de servicio en Conexiones de Google.',409);
    let prop;
    try{prop=await verifyProperty({...site,gscProperty:requested},googleTransport);}
    catch(err){if(user.role==='admin')throw err;throw problem('No se pudo verificar la propiedad de esta web. Revisa el identificador y el permiso de lectura en Search Console.');}
    await saveConnection(current=>{current.gscProperty=prop;});return json({gscProperty:prop});
  }
  if(action==='review'&&method==='POST') {
    const job=await store.mutate(s=>manualReview(s,scope(s,user,id)),selection);
    let awakened=true;
    try {await wake();}catch{awakened=false;}
    return json({status:job.status,awakened},202);
  }
  throw problem('Ruta desconocida.',404);
 }catch(e){
   const code=Number(e.status)||500;
   if(code>=500) console.error('Error de API',e.name,e.code||code);
   return json({error:code===500?'No se pudo completar la operación.':e.message},code);
 }
}

