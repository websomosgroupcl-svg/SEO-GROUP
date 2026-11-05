import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore,exportBackup,restoreBackup} from '../lib/store.mjs';
import {handle} from '../lib/api.mjs';
import {createUser,login,sessionCookie} from '../lib/auth.mjs';

const password='Solo para las pruebas del equipo';
async function fixture(t){
  const store=await openStore({databaseUrl:null,file:':memory:'});t.after(()=>store.close());
  const actors={};
  for(const [name,role] of [['jefa','admin'],['redactor','member']]){
    const email=name+'@equipo.example';const user=await createUser(store,{name,email,password,role}),session=await login(store,{email,password});actors[name]={...user,cookie:sessionCookie(session.token).split(';')[0]};
  }
  let n=0;
  async function api(path,method='GET',data,cookie=''){
    const req=new Request('https://equipo.example/api/'+path,{method,headers:{'Content-Type':'application/json',cookie,origin:'https://equipo.example'},...(method!=='GET'?{body:JSON.stringify(data||{})}:{})});
    const res=await handle(req,{store,ip:'127.0.0.'+(++n)});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};
  }
  const manage=(method='GET',actor=actors.jefa)=>api('team-invite',method,null,actor.cookie);
  const signup=(inviteCode,email,secret=password)=>api('signup','POST',{inviteCode,name:'Integrante',email,password:secret});
  return {store,actors,api,manage,signup};
}
test('el enlace solo lo gestiona el administrador y solo se entrega en la generación',async t=>{
  const {store,actors,api,manage,signup}=await fixture(t);
  for(const method of ['GET','POST','DELETE'])assert.equal((await manage(method,actors.redactor)).status,403);
  assert.deepEqual((await manage()).body,{active:false,expiresAt:null});
  const {code,expiresAt}= (await manage('POST')).body;
  assert.match(code,/^[A-Za-z0-9_-]{43}$/);assert(Date.parse(expiresAt)>Date.now());
  assert.deepEqual((await manage()).body,{active:true,expiresAt});assert(!JSON.stringify(await store.read()).includes(code));
  assert.equal((await api('users','GET',null,sessionCookie(code).split(';')[0])).status,401);
  for(const email of ['primera@equipo.example','segunda@equipo.example']){
    const r=await signup(code,email);assert.equal(r.status,201);assert.equal(r.cookie,null);
    const session=await api('login','POST',{email,password});assert.equal(session.body.user.role,'member');assert.equal(session.body.user.pendingApproval,false);
    const cookie=session.cookie.split(';')[0];assert.equal((await api('users','GET',null,cookie)).status,403);assert.deepEqual((await api('sites','GET',null,cookie)).body.sites,[]);
  }
});
test('rotación, expiración, revocación y restauración mantienen inválidas las capacidades antiguas',async t=>{
  const {store,manage,signup}=await fixture(t);
  const a=(await manage('POST')).body.code,b=(await manage('POST')).body.code;
  assert.notEqual(a,b);assert.equal((await signup(a,'viejo@equipo.example')).status,403);
  await store.mutate(s=>{s.sessions.find(x=>x.kind==='team-invite').expiresAt='2000-01-01T00:00:00.000Z';});
  assert.equal((await signup(b,'caducado@equipo.example')).status,403);assert.equal((await manage()).body.active,false);
  const c=(await manage('POST')).body.code,key='clave-de-respaldo-local-para-prueba-1234',snapshot=await exportBackup(store,key);
  assert.equal((await manage('DELETE')).body.active,false);assert.equal((await signup(c,'revocado@equipo.example')).status,403);
  await restoreBackup(store,snapshot,key);
  assert.equal((await signup(c,'restaurado@equipo.example')).status,403);
});
test('una invitación no sustituye la contraseña ni reactiva una cuenta desactivada o administradora',async t=>{
  const {store,actors,api,manage,signup}=await fixture(t);const code=(await manage('POST')).body.code;
  const pending={name:'Pendiente',email:'pendiente@equipo.example',password};
  assert.equal((await api('signup','POST',pending)).status,202);
  assert.equal((await signup(code,pending.email,'frase incorrecta de ejemplo')).status,403);
  assert((await store.read()).users.find(u=>u.email===pending.email).pendingApproval);
  assert.equal((await signup(code,pending.email)).status,201);assert.equal((await store.read()).users.find(u=>u.email===pending.email).pendingApproval,false);
  assert.equal((await signup(code,actors.jefa.email)).status,403);
  await store.mutate(s=>{s.users.find(u=>u.id===actors.redactor.id).disabled=true;});
  assert.equal((await signup(code,actors.redactor.email)).status,403);
  assert.equal((await api('signup','POST',{...pending,email:'nuevo@equipo.example',inviteCode:code,role:'admin'})).status,400);
});
