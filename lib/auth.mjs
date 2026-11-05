import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { httpError } from './store.mjs';
import {validTeamInvite} from './team-invite.mjs';

const derive = promisify(scrypt);
const cookieName = 'seobestia_session';
const ownerCookieName = '__Host-seobestia_owner';
const ownerDeviceMs = 180 * 24 * 60 * 60 * 1000;
const sessionMs = 7 * 24 * 60 * 60 * 1000;
const windowMs = 15 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const normalizeEmail = email => String(email || '').trim().toLowerCase();
const validIdentifier = value => value.length <= 254 && value !== 'admin' && (/^[a-z0-9][a-z0-9._-]*$/.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
const publicUser = ({ id, email, name, role, pendingApproval }) => ({ id, email, name, role, pendingApproval: Boolean(pendingApproval) });
const fakeHash = '0'.repeat(32) + '.' + '0'.repeat(64);

function cloudOwner(users) {
  const eligible=u=>!u.localOnly && u.role==='admin' && !u.disabled && !u.pendingApproval;
  return users.find(u=>eligible(u)&&u.initialAdmin) ||
    users.find(u=>eligible(u)&&u.email===normalizeEmail(process.env.SEO_ADMIN_EMAIL));
}
const ownerHash = token=> /^[A-Za-z0-9_-]{43}$/.test(token||'') ? digest('owner-device-v1:'+token) : '';
function validOwnerBinding(user,binding,now=Date.now()) {
  return Boolean(user && !!binding && user.ownerDeviceHash && Date.parse(user.ownerDeviceExpiresAt)>now &&
    /^[a-f0-9]{64}$/.test(user.ownerDeviceHash) && timingSafeEqual(Buffer.from(user.ownerDeviceHash,'hex'),Buffer.from(binding,'hex')));
}
export function ownerTokenFromCookie(header='') {
  const entries=String(header).split(';').map(s=>s.trim()).filter(s=>s.startsWith(ownerCookieName+'='));
  return entries.length===1?entries[0].slice(ownerCookieName.length+1):'';
}
export async function pairOwnerDevice(store,code,ip=''){
  const expected=process.env.SEO_OWNER_PAIR_HASH||'', expiry=process.env.SEO_OWNER_PAIR_EXPIRES_AT||'';
  const expires=Date.parse(expiry);
  const available=()=>/^[a-f0-9]{64}$/.test(expected) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(expiry) && expires>Date.now();
  const denied=()=>httpError(403,'El enlace de activación ya no es válido.');
  if(!available())throw denied();
  const valid=typeof code==='string' && /^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{43})$/.test(code) && timingSafeEqual(Buffer.from(digest(code),'hex'),Buffer.from(expected,'hex'));
  const address=digest('owner-pair-ip:'+String(ip||'unknown').slice(0,128));
  const token=randomBytes(32).toString('base64url'), now=Date.now();
  const status=await store.mutate(state=>{
    const owner=cloudOwner(state.users);
    state.loginAttempts=state.loginAttempts.filter(a=>a.at>now-windowMs);
    const recent=state.loginAttempts.filter(a=>a.kind==='owner-pair');
    if(recent.length>=60||recent.filter(a=>a.address===address).length>=10)return 429;
    if(!available() || !valid || !owner || owner.ownerPairConsumed?.includes(expected)) {
      state.loginAttempts.push({id:randomUUID(),at:now,address,kind:'owner-pair'});return 403;
    }
    owner.ownerPairConsumed=[...(owner.ownerPairConsumed||[]),expected];
    owner.ownerDeviceHash=ownerHash(token);
    owner.ownerDeviceExpiresAt=new Date(now+ownerDeviceMs).toISOString();
    state.sessions=state.sessions.filter(s=>s.userId!==owner.id||!s.ownerDeviceBinding);
    return 200;
  },{keys:['users','loginAttempts','sessions']});
  if(status===429)throw httpError(429,'Demasiados intentos. Vuelve en 15 minutos.');
  if(status!==200)throw denied();
  return ownerCookieName+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.floor(ownerDeviceMs/1000);
}

async function passwordMatches(password, encoded) {
  if (!/^[a-f0-9]{32}\.(?:[a-f0-9]{64}|[a-f0-9]{128})$/.test(encoded)) return false;
  const [salt, hash] = encoded.split('.');
  const expected = Buffer.from(hash, 'hex');
  const actual = await derive(password, Buffer.from(salt, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function hashPassword(password) {
  const salt=randomBytes(16),hash=await derive(password,salt,64);
  return salt.toString('hex')+'.'+hash.toString('hex');
}
export async function hashAdminPassword(password) {
  if (typeof password!=='string'||password.length < 1||password.length>512) throw httpError(400,'Usa una contraseña de 1 a 512 caracteres.');
  return hashPassword(password);
}

const hasAdministrator = (state, local) => state.users.some(u =>
  u.role === 'admin' && !u.disabled && !u.pendingApproval && (!u.localOnly || local));

export async function signupAvailable(store, local = false) {
  return hasAdministrator(await store.read({ keys: ['users'] }), local);
}

export async function requestSignup(store, input, { local=false, ip='' }={}) {
  if (Object.keys(input).some(k=>!['name','email','password','inviteCode'].includes(k))) throw httpError(400,'Revisa los campos del formulario.');
  const invited=Object.hasOwn(input,'inviteCode');
  const invalid=()=>httpError(403,'No se pudo completar la invitación. Comprueba el enlace y, si ya tienes una cuenta, tu contraseña.');
  const keys=invited?['users','loginAttempts','sessions']:['users','loginAttempts'];
  const email = normalizeEmail(input.email);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 100 || /[\p{Cc}\p{Cf}]/u.test(name)) throw httpError(400,'Escribe un nombre de hasta 100 caracteres.');
  if (!email || !validIdentifier(email) || email.endsWith('@local.example')) {
    throw httpError(400,'Ingresa un usuario o correo válido.');
  }
  if (typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 512) {
    throw httpError(400,'Usa una contraseña de 1 a 512 caracteres.');
  }
  const address = digest('signup-ip:' + String(ip || 'unknown').slice(0,128));
  const account = digest('signup-email:' + email);
  const now = Date.now();
  // Reserve an attempt before scrypt. SQL serializes reservations across function instances.
  const reservation=await store.mutate(st => {
    if (!hasAdministrator(st,local)) throw httpError(503,'El administrador debe completar la preparación del equipo.');
    st.loginAttempts = st.loginAttempts.filter(a=>a.at > now - windowMs);
    const requests = st.loginAttempts.filter(a=>a.kind === 'signup');
    if (requests.length >= 40 || requests.filter(a=>a.address===address).length >= 5 ||
        requests.filter(a=>a.account===account).length >= 3 || !invited&&st.users.filter(u=>u.pendingApproval && !u.disabled).length >= 100) {
      throw httpError(429,'Se alcanzó el límite de solicitudes de acceso. Vuelve más tarde o contacta al administrador.');
    }
    st.loginAttempts.push({id:randomUUID(),kind:'signup',address,account,at:now});
    if(!invited)return null;
    if(!validTeamInvite(st,input.inviteCode,local))return {valid:false};
    const existing=st.users.find(u=>u.email===email);
    return {valid:true,id:existing?.id,hash:existing?.passwordHash};
  }, {keys});
  if(invited){
    if(!reservation.valid)throw invalid();
    const hash=reservation.hash||await hashPassword(input.password);
    if(reservation.id&&!await passwordMatches(input.password,hash))throw invalid();
    return store.mutate(st=>{
      if(!validTeamInvite(st,input.inviteCode,local))throw invalid();
      const existing=st.users.find(u=>u.email===email);
      if(existing?.id!==reservation.id||existing&&(existing.role!=='member'||existing.disabled||existing.localOnly||existing.passwordHash!==reservation.hash))throw invalid();
      if(existing)existing.pendingApproval=false;
      else st.users.push({id:randomUUID(),name,email,role:'member',pendingApproval:false,passwordHash:hash,createdAt:new Date(now).toISOString()});
      return {approved:true,pendingApproval:false};
    },{keys:['users','sessions']});
  }
  // Do equivalent hash work for existing addresses and always return the same receipt.
  const passwordHash = await hashPassword(input.password);
  await store.mutate(st => {
    if (st.users.some(u=>u.email===email)) return;
    if (st.users.filter(u=>u.pendingApproval && !u.disabled).length >= 100) throw httpError(429,'Hay demasiadas solicitudes pendientes. Contacta al administrador.');
    st.users.push({id:randomUUID(),name,email,role:'member',pendingApproval:true,passwordHash,createdAt:new Date(now).toISOString()});
  }, {keys:['users']});
  return {message:'Solicitud recibida. Puedes iniciar sesión con tu correo y contraseña para consultar tu acceso.'};
}
export async function ensureLocalAdmin(store) {
  if(store.backend!=='sqlite')return;
  if((await store.read({keys:['users']})).users.some(u=>u.email==='admin'))return;
  const passwordHash=await hashPassword('admin');
  await store.mutate(st=>{
    if(!st.users.some(u=>u.email==='admin'))st.users.push({id:randomUUID(),email:'admin',name:'Administrador local',role:'admin',localOnly:true,passwordHash,createdAt:new Date().toISOString()});
  },{keys:['users']});
}
function checkSites(st,ids){
  if(!Array.isArray(ids)||ids.length>100||ids.some(id=>!st.sites.some(s=>s.id===id)))throw httpError(400,'Revisa los sitios asignados.');
}
export function createUser(store, input) {
  return insertAccount(store, input);
}
export function createInitialAdminFromHash(store, {email,name,passwordHash}) {
  if(typeof passwordHash!=='string'||!/^[a-f0-9]{32}\.[a-f0-9]{128}$/.test(passwordHash))throw httpError(503,'El hash de la contraseña del administrador inicial no tiene el formato esperado.');
  return insertAccount(store,{email,name,role:'admin',onlyFirstAdmin:true,ignoreLocalOnly:true},passwordHash);
}
async function insertAccount(store, { email, name, password, role = 'member', onlyFirstAdmin = false, ignoreLocalOnly=false, siteIds=[] }, initialHash) {
  email = normalizeEmail(email);
  if (!validIdentifier(email)) throw httpError(400, 'Ingresa un usuario o correo válido.');
  if (!initialHash && (typeof password !== 'string' || password.length < 1 || password.length > 512)) throw httpError(400, 'Usa una contraseña de 1 a 512 caracteres.');
  if (!['admin', 'member'].includes(role)) throw httpError(400, 'Rol no válido.');
  const passwordHash=initialHash || await hashPassword(password);
  return store.mutate(state => {
    if (onlyFirstAdmin && (role !== 'admin' || state.users.some(u => u.role === 'admin'&&(!ignoreLocalOnly||!u.localOnly)))) {
      throw httpError(409, 'La administración inicial ya está configurada o el rol solicitado es inválido.');
    }
    if (state.users.some(u => u.email === email)) throw httpError(409, 'Ese correo ya tiene acceso.');
    const user = { id: randomUUID(), name: String(name || email).trim().slice(0, 100), email, role,
      passwordHash, createdAt: new Date().toISOString(), ...(onlyFirstAdmin?{initialAdmin:true}:{}) };
    if(siteIds.length){checkSites(state,siteIds);for(const site of state.sites.filter(s=>siteIds.includes(s.id)))site.memberIds.push(user.id);}
    state.users.push(user);
    return publicUser(user);
  }, siteIds.length?{keys:['users','sites'],siteSummary:true}:{keys:['users']});
}

export async function manageUser(store,actor,id,data){
  if(actor.role!=='admin')throw httpError(403,'Se requieren permisos de administrador.');
  const {name,role,disabled,password,siteIds,pendingApproval}=data;
  if(typeof name!=='string'||!name.trim()||name.length>100||!['admin','member'].includes(role)||typeof disabled!=='boolean')throw httpError(400,'Revisa nombre, rol y estado.');
  if(password!=null&&(typeof password!=='string'||password.length < 1||password.length>512))throw httpError(400,'Usa una contraseña de 1 a 512 caracteres.');
  const passwordHash=password?await hashPassword(password):null;
  return store.mutate(st=>{
    if (!st.users.some(u=>u.id===actor.id && u.role==='admin' && !u.disabled && !u.pendingApproval)) throw httpError(403,'Se requieren permisos de administrador.');
    const target=st.users.find(u=>u.id===id&&!u.email.endsWith('@local.example'));
    if(!target)throw httpError(404,'Usuario desconocido.');
    if(target.localOnly||target.id===actor.id&&(disabled||role!=='admin'))throw httpError(409,'Esta cuenta debe conservar su acceso administrador.');
    checkSites(st,siteIds);
    if (pendingApproval!==undefined && (typeof pendingApproval!=='boolean' || (pendingApproval && !target.pendingApproval))) throw httpError(400,'Para suspender una cuenta aprobada, usa la opción desactivar.');
    if (target.pendingApproval && pendingApproval!==false && (role!=='member'||siteIds.length)) throw httpError(400,'Aprueba primero el acceso de la cuenta.');
    for(const site of st.sites){
      if(site.memberIds.includes(id)||siteIds.includes(site.id))site.memberIds=[...site.memberIds.filter(uid=>uid!==id),...(siteIds.includes(site.id)?[id]:[])];
    }
    if(passwordHash||disabled||role!==target.role)st.sessions=st.sessions.filter(s=>s.userId!==id);
    if(passwordHash||disabled||role!==target.role){delete target.ownerDeviceHash;delete target.ownerDeviceExpiresAt;}
    Object.assign(target,{name:name.trim(),role,disabled},passwordHash?{passwordHash}:{});
    if (target.pendingApproval && pendingApproval===false) Object.assign(target,{pendingApproval:false,approvedBy:actor.id,approvedAt:new Date().toISOString()});
    return publicUser(target);
  },{keys:['users','sessions','sites'],siteSummary:true});
}

export async function login(store, { email, password, ip = '', local=false, ownerDeviceToken='' }) {
  email = normalizeEmail(email);
  if (typeof password !== 'string' || !password || password.length > 512 || !email || email.length > 254) throw httpError(401, 'Correo o contraseña incorrectos.');
  const address = ip ? digest(String(ip).slice(0, 128)) : null;
  const now = Date.now();
  const attemptId = randomUUID();
  const user = await store.mutate(state => {
    if (!local && email==='admin') {
      const initialAdmin = cloudOwner(state.users);
      if (initialAdmin) email=initialAdmin.email;
    }
    const account=digest(email);
    state.loginAttempts = state.loginAttempts.filter(a => a.at > now - windowMs);
    if (state.loginAttempts.filter(a => a.account === account).length >= 8 ||
        (address && state.loginAttempts.filter(a => a.address === address).length >= 30) ||
        state.loginAttempts.length >= 500) {
      throw httpError(429, 'Demasiados intentos. Vuelve en 15 minutos.');
    }
    state.loginAttempts.push({ id: attemptId, at: now, account, address });
    return state.users.find(u => u.email === email && !u.disabled && (!u.localOnly||local));
  }, { keys: ['users','loginAttempts'] });
  const strongMatches=await passwordMatches(password,user?.passwordHash||fakeHash);
  const deviceLogin=!local && password==='admin' && !strongMatches;
  const binding=deviceLogin?ownerHash(ownerDeviceToken):'';

  const matches=deviceLogin?validOwnerBinding(user,binding):strongMatches;
  if (!matches || !user) throw httpError(401, 'Correo o contraseña incorrectos.');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now + sessionMs).toISOString();
  return store.mutate(state => {
    const current = state.users.find(u => u.id === user.id && !u.disabled && u.passwordHash === user.passwordHash);
    if (!current) throw httpError(401, 'Vuelve a iniciar sesión.');
    if(deviceLogin && (cloudOwner(state.users)?.id!==user.id || !validOwnerBinding(current,binding)))throw httpError(401,'Correo o contraseña incorrectos.');
    state.loginAttempts = state.loginAttempts.filter(a => a.id !== attemptId);
    state.sessions = state.sessions.filter(s => Date.parse(s.expiresAt) > now);
    state.sessions.push({ userId: current.id, tokenHash: digest(token), expiresAt, ...(deviceLogin?{ownerDeviceBinding:binding}:{}) });
    return { user: publicUser(current), token, expiresAt };
  }, { keys: ['users','sessions','loginAttempts'] });
}

export async function authenticate(store, token, {local=false}={}) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const state = await store.read({ keys: ['users','sessions'] });
  const session = state.sessions.find(s => s.tokenHash === digest(token) && Date.parse(s.expiresAt) > Date.now());
  const user = session && state.users.find(u => u.id === session.userId && !u.disabled && (!u.localOnly||local));
  return user && (!session.ownerDeviceBinding || validOwnerBinding(user,session.ownerDeviceBinding)) ? publicUser(user) : null;
}

export async function logout(store, token) {
  if (!token) return;
  const hash = digest(token);
  await store.mutate(state => { state.sessions = state.sessions.filter(s => s.tokenHash !== hash); }, { keys: ['sessions'] });
}

export function canAccessSite(user, site) {
  return Boolean(user?.id && !user.pendingApproval && site && (user.role === 'admin' || site.ownerId === user.id || site.memberIds?.includes(user.id)));
}

export function tokenFromCookie(header = '') {
  const cookies = String(header || '').split(';').map(v => v.trim());
  return cookies.find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
}

export function sessionCookie(token, { secure = true, expiresAt } = {}) {
  return cookieName + '=' + token + '; Path=/; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '') +
    (expiresAt ? '; Expires=' + new Date(expiresAt).toUTCString() : '');
}

export function clearSessionCookie({ secure = true } = {}) {
  return sessionCookie('', { secure }) + '; Max-Age=0';
}
