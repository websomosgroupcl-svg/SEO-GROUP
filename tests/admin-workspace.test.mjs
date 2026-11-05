import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../lib/store.mjs';
import {bootstrap,handle} from '../lib/api.mjs';
import {normalizeServiceAccount,openLocalGoogle,prepStatus} from '../lib/google-local.mjs';

const gscEnv='GOOGLE_SERVICE_ACCOUNT_JSON_BASE64',gaEnv='GA4_SERVICE_ACCOUNT_JSON_BASE64';
const account={email:'admin',password:'admin'};
const member={name:'Persona de prueba',email:'persona@example.org',password:'frase-larga-temporal-123'};
function environment(t,entries){
  for(const [key,value] of Object.entries(entries)){
    const previous=process.env[key];
    if(value===null)delete process.env[key];else process.env[key]=value;
    t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  }
}
function credential(){
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  return {type:'service_account',client_email:'prueba@taller-pruebas.iam.gserviceaccount.com',private_key:privateKey.export({format:'pem',type:'pkcs8'}).toString()};
}
async function workspace(t){
  environment(t,{SEO_ADMIN_EMAIL:null,SEO_ADMIN_PASSWORD:null});
  const store=await openStore({file:':memory:',databaseUrl:null});
  t.after(()=>store.close());
  const request=async(path,{method='GET',data,cookie='',local=true,googleManager=null}={})=>{
    const req=new Request('http://localhost:4173/api/'+path,{method,headers:{'content-type':'application/json',cookie},body:data===undefined?undefined:JSON.stringify(data)});
    const res=await handle(req,{store,local,googleManager});
    return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]||''};
  };
  await bootstrap(store,{local:true});
  const admin=await request('login',{method:'POST',data:account});
  assert.equal(admin.status,200);
  return {store,request,admin};
}

test('admin/admin funciona sólo en local y su cookie tampoco abre la administración alojada',async t=>{
  const {store,request,admin}=await workspace(t);
  await bootstrap(store,{local:true});
  assert.equal((await store.read()).users.filter(u=>u.email==='admin').length,1);
  assert.equal((await request('session',{cookie:admin.cookie})).data.user.role,'admin');
  assert.equal((await request('sistema',{cookie:admin.cookie})).data.storage,'sqlite');
  assert.equal((await request('login',{method:'POST',data:account,local:false})).status,401);
  assert.equal((await request('session',{cookie:admin.cookie,local:false})).data.user,null);
  assert.equal((await request('users',{cookie:admin.cookie,local:false})).status,401);
  assert.equal((await request('sistema',{cookie:admin.cookie,local:false})).status,401);
  const hosted=await openStore({file:':memory:',databaseUrl:null});
  t.after(()=>hosted.close());await bootstrap(hosted);
  assert.equal((await hosted.read()).users.length,0);
});

test('alta y asignación son atómicas, los permisos persisten y desactivar revoca la sesión',async t=>{
  const {store,request,admin}=await workspace(t);
  const asAdmin=(path,method='GET',data)=>request(path,{method,data,cookie:admin.cookie});
  async function newSite(name){
    const r=await asAdmin('sites','POST',{name,url:'https://'+name+'.example/',country:'Chile',business:'Taller',services:'muebles a medida',authorized:true});
    assert.equal(r.status,201);return r.data.id;
  }
  const first=await newSite('primero'),second=await newSite('segundo');
  const assignments=(await store.read()).sites.find(s=>s.id===first).memberIds;
  assert.equal((await asAdmin('users','POST',{...member,siteIds:[first,'no-existe']})).status,400);
  let state=await store.read();
  assert.equal(state.users.some(u=>u.email===member.email),false);assert.deepEqual(state.sites.find(s=>s.id===first).memberIds,assignments);
  const created=await asAdmin('users','POST',{...member,siteIds:[first]});assert.equal(created.status,201);
  const id=created.data.id,path='users/'+id;
  const memberLogin=await request('login',{method:'POST',data:member});assert.equal(memberLogin.status,200);
  const asMember=(path,method='GET',data)=>request(path,{method,data,cookie:memberLogin.cookie});
  assert.equal((await asMember('sites/'+first)).status,200);assert.equal((await asMember('sites/'+second)).status,404);
  for(const route of ['users','sistema','conexiones/preparacion'])assert.equal((await asMember(route)).status,403);
  assert.equal((await asMember('conexiones/credencial','POST',{target:'gsc',credential:{}})).status,403);
  assert.equal((await asMember(path,'PATCH',{role:'admin'})).status,403);
  const edit={name:'Persona actualizada',role:'member',disabled:false,siteIds:[second]};
  assert.equal((await asAdmin(path,'PATCH',{...edit,siteIds:[second,'ausente']})).status,400);
  assert.deepEqual((await asMember('sites')).data.sites.map(s=>s.id),[first]);
  assert.equal((await asAdmin(path,'PATCH',edit)).status,200);
  assert.deepEqual((await asAdmin('users')).data.users.find(u=>u.id===id).siteIds,[second]);
  assert.deepEqual((await asMember('sites')).data.sites.map(s=>s.id),[second]);
  state=await store.read();
  assert.equal(state.sites.find(s=>s.id===first).memberIds.includes(id),false);
  assert.equal(state.sites.find(s=>s.id===second).memberIds.includes(id),true);
  assert.equal((await asAdmin(path,'PATCH',{...edit,disabled:true})).status,200);
  assert.equal((await asMember('session')).data.user,null);
  assert.equal((await asMember('sites')).status,401);
  assert.equal((await request('login',{method:'POST',data:member})).status,401);
  assert.equal((await asAdmin(path,'PATCH',edit)).status,200);
  assert.equal((await asMember('sites')).status,401);
  assert.equal((await request('login',{method:'POST',data:member})).status,200);
});

test('preparación sólo expone identidad y estado, rechaza una clave inválida y respeta el entorno alojado',async t=>{
  environment(t,{[gscEnv]:null,[gaEnv]:null});
  const {request,admin}=await workspace(t), cred=credential();
  const manager={writable:target=>target==='gsc',async save(target,raw){
    assert.equal(target,'gsc');
    const validated=normalizeServiceAccount(raw);
    process.env[gscEnv]=Buffer.from(JSON.stringify(validated)).toString('base64');
  }};
  const getPrep=()=>request('conexiones/preparacion',{cookie:admin.cookie,googleManager:manager});
  const save=(raw)=>request('conexiones/credencial',{method:'POST',cookie:admin.cookie,googleManager:manager,data:{target:'gsc',credential:raw}});
  const before=await getPrep();assert.equal(before.status,200);assert.equal(before.data.gsc.configured,false);assert.equal(before.data.gsc.canUpload,true);
  assert.equal((await save({...cred,private_key:'contenido inválido'})).status,400);
  assert.equal((await getPrep()).data.gsc.configured,false);
  const result=await save(cred);assert.equal(result.status,200);
  assert.deepEqual(result.data.gsc,{configured:true,email:cred.client_email,canUpload:true,invalid:false});
  assert.deepEqual(result.data.ga4,{configured:true,email:cred.client_email,canUpload:false,invalid:false});
  assert.equal(JSON.stringify(result.data).includes('PRIVATE KEY'),false);
  process.env[gaEnv]='dato-sin-formato';
  assert.deepEqual(prepStatus(null).ga4,{configured:false,email:null,canUpload:false,invalid:true});
  const remote={...member,name:'Admin normal',role:'admin'};
  assert.equal((await request('users',{method:'POST',cookie:admin.cookie,data:remote})).status,201);
  const login=await request('login',{method:'POST',local:false,data:remote});assert.equal(login.status,200);
  const hosted=await request('conexiones/preparacion',{cookie:login.cookie,local:false,googleManager:manager});
  assert.equal(hosted.data.canUpload,false);
  assert.equal((await request('conexiones/credencial',{method:'POST',cookie:login.cookie,local:false,googleManager:manager,data:{target:'gsc',credential:{}}})).status,409);
});

test('Windows recupera la credencial DPAPI en un proceso nuevo bajo la misma cuenta',{skip:process.platform!=='win32'},async t=>{
  const root=await mkdtemp(join(tmpdir(),'seobestia-google-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  environment(t,{[gscEnv]:null,[gaEnv]:null,SEO_DB_PATH:join(root,'fixture.sqlite'),LOCALAPPDATA:root});
  const cred=credential(),storage={backend:'sqlite'};
  const manager=await openLocalGoogle(storage);
  await manager.save('gsc',cred);
  const folders=await readdir(join(root,'SEOBESTIA','conexiones'));
  assert.equal(folders.length,1);
  const folder=join(root,'SEOBESTIA','conexiones',folders[0]);
  assert.deepEqual(await readdir(folder),['gsc.dpapi']);
  const sealed=await readFile(join(folder,'gsc.dpapi'));
  assert.ok(sealed.length>0);
  assert.equal(sealed.includes('PRIVATE KEY'),false);
  assert.equal(sealed.includes(cred.client_email),false);
  const env={...process.env};delete env[gscEnv];delete env[gaEnv];
  const target=new URL('../lib/google-local.mjs',import.meta.url).href;
  const script='import {openLocalGoogle,prepStatus} from '+JSON.stringify(target)+'; const local=await openLocalGoogle({backend:"sqlite"}); const status=prepStatus(local); process.stdout.write(JSON.stringify({ready:status.gsc.configured,email:status.gsc.email}));';
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{env,windowsHide:true,timeout:30000});
  assert.deepEqual(JSON.parse(stdout),{ready:true,email:cred.client_email});
});
