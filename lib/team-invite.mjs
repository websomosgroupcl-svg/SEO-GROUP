import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {httpError} from './store.mjs';

const duration=7*24*60*60*1000,kind='team-invite',access={keys:['users','sessions']};
const digest=code=>createHash('sha256').update('seobestia/team-invite/v1/'+code).digest();
const eligible=(u,local)=>u?.role==='admin'&&!u.disabled&&!u.pendingApproval&&(!u.localOnly||local);
function current(state,local){
  const now=Date.now();
  return state.sessions.find(s=>s.kind===kind&&Date.parse(s.expiresAt)>now&&state.users.some(u=>u.id===s.userId&&eligible(u,local)));
}
export function validTeamInvite(state,code,local){
  if(typeof code!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(code))return false;
  const invite=current(state,local);
  return Boolean(invite&&/^[a-f0-9]{64}$/.test(invite.codeHash)&&timingSafeEqual(digest(code),Buffer.from(invite.codeHash,'hex')));
}
export async function teamInvitation(store,actor,method,local){
  if(!['GET','POST','DELETE'].includes(method))throw httpError(405,'Método de invitación no disponible.');
  function check(state){if(!eligible(state.users.find(u=>u.id===actor.id),local))throw httpError(403,'Se requiere una cuenta administradora.');}
  if(method==='GET'){
    const state=await store.read(access);check(state);const invite=current(state,local);
    return {active:Boolean(invite),expiresAt:invite?.expiresAt||null};
  }
  return store.mutate(state=>{
    check(state);
    // Capabilities are kept with expiring sessions, excluded from backups. They have no session tokenHash.
    state.sessions=state.sessions.filter(s=>s.kind!==kind);
    if(method==='DELETE')return {active:false,expiresAt:null};
    const code=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+duration).toISOString();
    state.sessions.push({kind,userId:actor.id,codeHash:digest(code).toString('hex'),expiresAt});
    return {active:true,code,expiresAt};
  },access);
}
