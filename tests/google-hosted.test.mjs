import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {withHostedGoogle} from '../lib/google-hosted.mjs';
import {prepStatus} from '../lib/google-local.mjs';
import {googleAccount} from '../lib/google-context.mjs';
import {openStore,exportBackup,restoreBackup} from '../lib/store.mjs';
import {handle} from '../lib/api.mjs';
import {createUser,login,sessionCookie} from '../lib/auth.mjs';

const key=()=>randomBytes(32).toString('base64url');
function env(t){
  for(const name of ['SEO_GOOGLE_VAULT_KEY','GOOGLE_SERVICE_ACCOUNT_JSON_BASE64','GA4_SERVICE_ACCOUNT_JSON_BASE64','SEO_BACKUP_KEY','SEO_WORKER_TOKEN']){
    const before=process.env[name];
    delete process.env[name];
    t.after(()=>{if(before===undefined)delete process.env[name];else process.env[name]=before;});
  }
  process.env.SEO_GOOGLE_VAULT_KEY=key();
}
const credential=name=>({type:'service_account',client_email:name+'@prueba.iam.gserviceaccount.com',
  private_key:generateKeyPairSync('rsa',{modulusLength:1024}).privateKey.export({type:'pkcs8',format:'pem'}).toString()});
function vault(){
  const rows=new Map();
  return {backend:'postgres',rows,async readGoogleEnvelopes(){return [...rows].map(([target,envelope])=>({target,envelope}));},
    async saveGoogleEnvelope(target,bytes){rows.set(target,Buffer.from(bytes));}};
}
test('la cuenta del alojamiento queda cifrada, rota entre ejecuciones y conserva la prioridad de las variables',async t=>{
  env(t);
  const db=vault(),first=credential('primera'),next=credential('segunda');
  await withHostedGoogle(db,manager=>manager.save('gsc',first));
  const original=db.rows.get('gsc');
  assert(!original.includes(Buffer.from(first.client_email)));
  assert(!original.includes(Buffer.from('PRIVATE KEY')));
  assert(!original.includes(Buffer.from(first.private_key.split('\n')[1])));
  assert.equal(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,undefined);
  await withHostedGoogle(db,async manager=>{
    assert.equal(prepStatus(manager).ga4.email,first.client_email);
    await withHostedGoogle(db,other=>other.save('gsc',next));
    assert.equal(prepStatus(manager).gsc.email,first.client_email);
  });
  await withHostedGoogle(db,async manager=>{
    assert.equal(prepStatus(manager).gsc.email,next.client_email);
    await manager.save('ga4',first);
    assert.equal(prepStatus(manager).ga4.email,first.client_email);
    const previous=db.rows.get('ga4');
    await manager.save('ga4',first);
    assert(!previous.equals(db.rows.get('ga4')));
  });
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=Buffer.from(JSON.stringify(first)).toString('base64');
  await withHostedGoogle(db,async manager=>{
    assert.equal(prepStatus(manager).gsc.email,first.client_email);
    assert.equal(manager.writable('gsc'),false);
    await assert.rejects(manager.save('gsc',next),e=>e.status===409);
    assert.equal(manager.writable('ga4'),true);
  });
});
test('sobre modificado, intercambiado o clave de cifrado equivocada no abren datos; se admite sustitución explícita',async t=>{
  env(t);const db=vault(),cred=credential('cuenta');
  await withHostedGoogle(db,m=>m.save('gsc',cred));
  db.rows.set('ga4',Buffer.from(db.rows.get('gsc')));
  db.rows.get('gsc')[34]^=1;
  await withHostedGoogle(db,async m=>{
    assert.equal(prepStatus(m).gsc.invalid,true);assert.equal(prepStatus(m).ga4.invalid,true);
    assert.equal(googleAccount('ga4').raw,undefined);
    await m.save('gsc',cred);assert.equal(prepStatus(m).gsc.configured,true);
  });
  process.env.SEO_GOOGLE_VAULT_KEY=key();
  await withHostedGoogle(db,m=>assert.equal(prepStatus(m).gsc.invalid,true));
  for(const value of ['demasiado-corta',undefined]){
    if(value)process.env.SEO_GOOGLE_VAULT_KEY=value;else delete process.env.SEO_GOOGLE_VAULT_KEY;
    await withHostedGoogle(db,m=>assert.equal(m,null));
  }
  process.env.SEO_BACKUP_KEY=process.env.SEO_GOOGLE_VAULT_KEY=key();
  await withHostedGoogle(db,m=>assert.equal(m,null));
});
test('los permisos remotos protegen cada ruta, el administrador lee sólo estado y correo',async t=>{
  env(t);const db=vault(),store=await openStore({databaseUrl:'',file:':memory:'});t.after(()=>store.close());
  const token=async role=>{
    const email=role+'@prueba.example',password='Prueba-temporal-2048';
    await createUser(store,{email,password,role});return (await login(store,{email,password})).token;
  };
  const admin=await token('admin'),member=await token('member');
  const call=(cookie,path,cred)=>withHostedGoogle(db,async manager=>{
    const res=await handle(new Request('https://seo.example/api/conexiones/'+path,{method:cred?'POST':'GET',
      headers:{cookie:sessionCookie(cookie).split(';')[0],'content-type':'application/json'},body:cred?JSON.stringify({target:'gsc',credential:cred}):undefined}),{store,googleManager:manager});
    return {status:res.status,data:await res.json()};
  });
  const cred=credential('autorizada');
  assert.equal((await call(member,'credencial',cred)).status,403);
  assert.equal((await call(member,'preparacion')).status,403);
  assert.equal((await call('','credencial',cred)).status,401);assert.equal(db.rows.size,0);
  const result=await call(admin,'credencial',cred);
  assert.equal(result.status,200);
  assert.deepEqual(result.data.gsc,{configured:true,email:cred.client_email,canUpload:true,invalid:false});
  assert.equal(result.data.storage,'hosted');assert(!JSON.stringify(result.data).includes('PRIVATE'));
  assert.deepEqual((await call(admin,'preparacion')).data,result.data);
});
// Opt-in and strictly loopback. A temporary schema verifies the actual additive migration and the backup boundary.
test('PostgreSQL conserva credenciales cifradas separadas del respaldo', {skip:!process.env.SEO_TEST_POSTGRES},async t=>{
  env(t);const url=new URL(process.env.SEO_TEST_POSTGRES);
  assert(['localhost','[::1]','127.0.0.1'].includes(url.hostname));
  const {Client}=await import('pg');const sql=new Client({connectionString:url.href});await sql.connect();
  const schema='vault_'+randomBytes(10).toString('hex');
  await sql.query('CREATE SCHEMA '+schema);url.searchParams.set('options','-c search_path='+schema);
  let db;
  try{
    db=await openStore({databaseUrl:url.href});const cred=credential('rotativa');
    await withHostedGoogle(db,m=>m.save('gsc',cred));
    assert(!JSON.stringify(await db.read()).includes(cred.client_email));
    const backupKey=key(),backup=await exportBackup(db,backupKey);
    await sql.query('DELETE FROM '+schema+'.seobestia_google_vault');
    await restoreBackup(db,backup,backupKey);
    assert.equal((await db.readGoogleEnvelopes()).length,0);
    await withHostedGoogle(db,m=>m.save('ga4',cred));await db.close();db=await openStore({databaseUrl:url.href});
    await withHostedGoogle(db,m=>assert.equal(prepStatus(m).ga4.email,cred.client_email));
  }finally{await db?.close();await sql.query('DROP SCHEMA '+schema+' CASCADE');await sql.end();}
});
