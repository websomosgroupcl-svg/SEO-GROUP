import assert from 'node:assert/strict';
import test from 'node:test';
import {openStore} from '../lib/store.mjs';
import {createUser,hashAdminPassword} from '../lib/auth.mjs';
import {bootstrap,handle} from '../lib/api.mjs';

const adminData={email:'directora@example.org',name:'Directora',password:'Frase personal segura para producción'};
const applicant={email:'ana@example.org',name:'Ana',password:'Una frase personal segura para Ana'};
async function workspace(t, withAdmin=true){
  const store=await openStore({databaseUrl:null,file:':memory:'});t.after(()=>store.close());
  if(withAdmin)await createUser(store,{...adminData,role:'admin',onlyFirstAdmin:true});
  let crawls=0;
  async function api(path,method='GET',data,cookie='',ip='127.0.0.1',local=false) {
    const res=await handle(new Request('https://piloto.example/api/'+path,{
      method,headers:{'content-type':'application/json',cookie,origin:'https://piloto.example'},
      ...(data?{body:JSON.stringify(data)}:{})
    }),{store,ip,local,diagnostic:()=>{crawls++;return{};}});
    return {code:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  return {store,api,crawls:()=>crawls};
}

test('el alta casi simultánea no enumera correos ni permite adquirir roles, sitios o herramientas',async t=>{
  const {store,api,crawls}=await workspace(t);
  assert.equal((await api('session')).body.signupAvailable,true);
  assert.equal((await api('signup','POST',{...applicant,role:'admin',siteIds:['privado']})).code,400);
  const registrations=await Promise.all([api('signup','POST',applicant),api('signup','POST',applicant),api('signup','POST',{...applicant,email:adminData.email})]);
  for(const r of registrations){assert.equal(r.code,202);assert.equal(r.cookie,undefined);assert.deepEqual(r.body,registrations[0].body);}
  const state=await store.read();
  assert.equal(state.users.length,2);
  const ana=state.users.find(u=>u.email===applicant.email);
  assert.equal(ana.role,'member');assert.equal(ana.pendingApproval,true);
  const login=await api('login','POST',applicant);
  assert.equal(login.code,200);assert.equal(login.body.user.pendingApproval,true);
  const routes=[['sites','GET'],['sites','POST'],['diagnostico','POST'],['mi-ia','POST'],['users','GET'],['sistema','GET'],['sites/ajeno/review','POST'],['sites/ajeno/editorial-ia','POST'],['demo','POST']];
  for(const [path,method] of routes) assert.equal((await api(path,method,method==='POST'?{}:null,login.cookie)).code,403,path);
  assert.equal(crawls(),0);
  assert.equal((await api('session','GET',null,login.cookie)).body.user.pendingApproval,true);
  assert.equal((await api('logout','POST',{},login.cookie)).code,200);
  assert.equal((await api('session','GET',null,login.cookie)).body.user,null);
  assert.equal((await api('login','POST',{email:adminData.email,password:applicant.password})).code,401);
});

test('el administrador revisa solicitudes, aprueba y asigna sitios atómicamente, luego puede desactivar',async t=>{
  const {api,store}=await workspace(t);
  assert.equal((await api('login','POST',{email:'admin',password:'admin'})).code,401);
  const root=await api('login','POST',{email:'admin',password:adminData.password});assert.equal(root.body.user.email,adminData.email);
  const other=await createUser(store,{name:'Segundo admin',email:'otro@example.org',password:'Clave para segundo admin',role:'admin'});
  await store.mutate(s=>{
    s.sites.push({id:'visible',name:'A',ownerId:other.id,memberIds:[],country:'CL'},{id:'ajeno',name:'B',ownerId:other.id,memberIds:[],country:'CL'});
  });
  assert.equal((await api('signup','POST',applicant)).code,202);
  const pending=await api('login','POST',applicant);
  const users=(await api('users','GET',null,root.cookie)).body.users;
  assert.equal(users.length,3);assert.ok(users.some(u=>u.id===other.id));
  const listed=users.find(u=>u.email===applicant.email);assert.equal(listed.pendingApproval,true);assert.ok(!('passwordHash' in listed));
  assert.equal((await api('sites','GET',null,root.cookie)).body.sites.length,2);
  const edit={name:'Ana',role:'member',disabled:false,siteIds:['visible']};
  assert.equal((await api('users/'+listed.id,'PATCH',edit,root.cookie)).code,400);
  assert.equal((await api('users/'+listed.id,'PATCH',{...edit,pendingApproval:false,siteIds:['ausente']},root.cookie)).code,400);
  assert.equal((await api('session','GET',null,pending.cookie)).body.user.pendingApproval,true);
  assert.equal((await api('users/'+listed.id,'PATCH',{...edit,pendingApproval:false},root.cookie)).code,200);
  assert.equal((await api('session','GET',null,pending.cookie)).body.user.pendingApproval,false);
  assert.deepEqual((await api('sites','GET',null,pending.cookie)).body.sites.map(s=>s.id),['visible']);
  assert.equal((await api('sites/ajeno','GET',null,pending.cookie)).code,404);
  assert.equal((await api('users/'+listed.id,'PATCH',{...edit,disabled:true},root.cookie)).code,200);
  assert.equal((await api('session','GET',null,pending.cookie)).body.user,null);
});

test('la cuota de altas y la preparación inicial se aplican en servidor',async t=>{
  const {api,store}=await workspace(t,false);
  assert.equal((await api('session')).body.signupAvailable,false);
  assert.equal((await api('signup','POST',applicant)).code,503);
  await createUser(store,{...adminData,role:'admin',onlyFirstAdmin:true});
  assert.equal((await api('signup','POST',{...applicant,email:'demo@local.example'})).code,400);
  for(let i=0;i<5;i++)assert.equal((await api('signup','POST',{...applicant,email:'ana'+i+'@example.org'})).code,202);
  assert.equal((await api('signup','POST',{...applicant,email:'ultima@example.org'})).code,429);
});

test('bootstrap con hash estricto local, admin seguro por alias, no se admite el hash por formularios',async t=>{
  const {api,store}=await workspace(t,false);
  const vars=['SEO_ADMIN_EMAIL','SEO_ADMIN_PASSWORD_HASH','SEO_ADMIN_PASSWORD'];
  const previous=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of vars)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];});
  process.env.SEO_ADMIN_EMAIL=adminData.email;
  delete process.env.SEO_ADMIN_PASSWORD;
  process.env.SEO_ADMIN_PASSWORD_HASH='formato-invalido';
  await assert.rejects(bootstrap(store),/formato/);
  const encoded=await hashAdminPassword(adminData.password);
  assert.match(encoded,/^[a-f0-9]{32}\.[a-f0-9]{128}$/);
  process.env.SEO_ADMIN_PASSWORD_HASH=encoded;
  await Promise.all([bootstrap(store),bootstrap(store)]);
  assert.equal((await store.read({keys:['users']})).users.length,1);
  const login=await api('login','POST',{email:'admin',password:adminData.password});
  assert.equal(login.code,200);
  assert.equal((await api('login','POST',{email:'admin',password:encoded})).code,401);
  assert.equal((await api('signup','POST',{...applicant,passwordHash:encoded})).code,400);
  assert.equal((await api('users','POST',{...applicant,passwordHash:encoded},login.cookie)).code,400);
});
