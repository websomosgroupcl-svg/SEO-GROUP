import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../lib/store.mjs';
import {createUser,login,sessionCookie} from '../lib/auth.mjs';
import {handle} from '../lib/api.mjs';
import {generateKeyPairSync} from 'node:crypto';
import {inGoogleContext} from '../lib/google-context.mjs';

const email='cuenta@servicio.iam.gserviceaccount.com',password='Solo para esta prueba de sitios';
const cred={type:'service_account',client_email:email,private_key:generateKeyPairSync('rsa',{modulusLength:1024}).privateKey.export({type:'pkcs8',format:'pem'}).toString()};
async function fixture(t){
  const store=await openStore({databaseUrl:null,file:':memory:'});t.after(()=>store.close());
  for(const key of ['GOOGLE_SERVICE_ACCOUNT_JSON_BASE64','GA4_SERVICE_ACCOUNT_JSON_BASE64']){
    const old=process.env[key];delete process.env[key];t.after(()=>{if(old===undefined)delete process.env[key];else process.env[key]=old;});
  }
  const actors={};for(const name of ['admin','owner','assigned','other','pending']){
    const mail=name+'@empresa.example';actors[name]=await createUser(store,{email:mail,password,name,role:name==='admin'?'admin':'member'});
    const s=await login(store,{email:mail,password});actors[name].cookie=sessionCookie(s.token).split(';')[0];
  }
  await store.mutate(st=>{
    st.users.find(u=>u.id===actors.pending.id).pendingApproval=true;
    for(const [id,url] of [['raiz','https://taller.example/'],['carpeta','https://taller.example/cliente/']]){
      st.sites.push({id,url,name:id,ownerId:actors.owner.id,memberIds:[actors.assigned.id,actors.pending.id],demo:false,rows:[],tasks:[],pages:[],reviews:[],alerts:[],totals:[]});
    }
  });
  const calls=[];let onVerify=async()=>{};
  const googleTransport={token:async()=>'token-falso',request:async(url,options)=>{
    calls.push({url,body:options?.body?JSON.parse(options.body):null});
    if(url.endsWith('/webmasters/v3/sites'))return Response.json({siteEntry:[{siteUrl:'https://taller.example/',permissionLevel:'siteOwner'},{siteUrl:'https://sinficha.example/',permissionLevel:'siteOwner'}]});
    if(url.includes('accountSummaries'))return Response.json({accountSummaries:[{propertySummaries:[{property:'properties/145',displayName:'Taller'}]}]});
    if(url.includes('tagmanager'))return Response.json(url.endsWith('/accounts')?{account:[{path:'accounts/1'}]}:{container:[{publicId:'GTM-AAAA1',name:'Taller'}]});
    if(url.includes('webmasters')){await onVerify();return Response.json({siteUrl:decodeURIComponent(url.split('/sites/')[1]),permissionLevel:'siteRestrictedUser'});}
    if(url.includes('/dataStreams'))return Response.json({dataStreams:[{name:'properties/145/dataStreams/567',type:'WEB_DATA_STREAM',webStreamData:{defaultUri:url.includes('144/')?'https://otro.example/':'https://taller.example/'}}]});
    assert(url.endsWith(':runReport'));return Response.json({rows:[]});
  }};
  async function req(name,path,method='GET',body){
    const request=new Request('https://app.example/api/'+path,{method,headers:{'Content-Type':'application/json',cookie:actors[name].cookie},...(body?{body:JSON.stringify(body)}:{})});
    const raw=Buffer.from(JSON.stringify(cred)).toString('base64');
    const res=await inGoogleContext({gsc:{raw}},()=>handle(request,{store,googleTransport}));return {status:res.status,data:await res.json()};
  }
  return {req,store,actors,calls,hook:fn=>{onVerify=fn;}};
}

test('preparación de Google por sitio y permisos de vinculación con asignación explícita',async t=>{
  const {req,calls,store,actors}=await fixture(t);
  for(const source of ['gsc','ga4']){
    const p='sites/raiz/'+source;
    const r=await req('assigned',p);assert.deepEqual(r,{status:200,data:{configured:true,email}});
    for(const [who,code] of [['owner',403],['pending',403],['other',404]]){
      assert.equal((await req(who,p)).status,code);assert.equal((await req(who,p,'POST',{})).status,code);
    }
  }
  assert.equal((await req('assigned','conexiones/credencial','POST',{target:'gsc',credential:cred})).status,403);
  assert.equal((await req('assigned','conexiones/preparacion')).status,403);assert.equal(calls.length,0);
  await req('admin','sites/raiz/members','PATCH',{memberIds:[actors.assigned.id,actors.owner.id]});
  assert.equal((await req('owner','sites/raiz/gsc')).status,200);
  assert.equal((await req('admin','sites/raiz/members','PATCH',{memberIds:[actors.pending.id]})).status,400);
  assert.equal((await store.read()).sites[0].memberIds.length,2);
});

test('GSC delegado solo acepta la propiedad raíz o el prefijo exacto asignado y revalida la asignación al guardar',async t=>{
  const {req,store,calls,hook}=await fixture(t);
  for(const [id,prop] of [['raiz','sc-domain:example'],['raiz','sc-domain:ajeno.example'],['carpeta','sc-domain:taller.example'],['carpeta','https://taller.example/'],['carpeta','https://taller.example/otro/']]){
    assert.equal((await req('assigned','sites/'+id+'/gsc','POST',{gscProperty:prop})).status,400);
  }
  assert.equal(calls.length,0);
  const verify=(id,prop)=>req('assigned','sites/'+id+'/gsc','POST',{gscProperty:prop});
  assert.equal((await verify('raiz','sc-domain:taller.example')).status,200);
  assert.equal((await verify('carpeta','https://taller.example/cliente/')).status,200);
  hook(()=>store.mutate(st=>{st.sites[0].memberIds=[];}));
  assert.equal((await verify('raiz','https://taller.example/')).status,403);
  assert.equal((await store.read()).sites[0].gscProperty,'sc-domain:taller.example');
});

test('GA4 del miembro protege otros dominios y carpetas, filtra historial y reserva datos en vivo hasta confirmación admin',async t=>{
  const {req,store,calls}=await fixture(t);
  const bind=(who,id,site='raiz',flags={})=>req(who,'sites/'+site+'/ga4','POST',{propertyId:id,...flags});
  assert.equal((await bind('assigned','145','carpeta')).status,400);assert.equal(calls.length,0);
  assert.equal((await bind('assigned','145','raiz',{confirmLiveScope:true})).status,403);assert.equal(calls.length,0);
  assert.equal((await bind('assigned','144')).status,400);assert.equal(calls.filter(c=>c.url.endsWith(':runReport')).length,0);
  const accepted=await bind('assigned','145');assert.equal(accepted.status,200);assert.equal(accepted.data.liveReviewRequired,true);
  const reports=calls.filter(c=>c.url.endsWith(':runReport'));assert.equal(reports.length,3);
  for(const {body} of reports)assert.deepEqual(body.dimensionFilter.andGroup.expressions.slice(0,2).map(e=>[e.filter.fieldName,e.filter.stringFilter.value]),[['streamId','567'],['hostName','taller.example']]);
  const live=await req('assigned','sites/raiz/live');assert.equal(live.data.status,'unavailable');assert.equal(live.data.activeUsers,null);
  assert.equal((await bind('admin','145')).data.liveReviewRequired,true);
  assert.equal((await bind('admin','145','raiz',{confirmLiveScope:true})).data.liveReviewRequired,false);
  assert.equal((await bind('assigned','145')).data.liveReviewRequired,false);assert.equal((await store.read()).sites[0].ga4LiveReviewRequired,false);
});

test('el administrador revisa los accesos y cada web se vincula sola sin reemplazar lo ya vinculado',async t=>{
  const {req,store}=await fixture(t);
  assert.equal((await req('assigned','conexiones/descubrir','POST',{})).status,403);
  await store.mutate(st=>{st.sites.find(s=>s.id==='carpeta').gscProperty='https://taller.example/cliente/';});
  const r=await req('admin','conexiones/descubrir','POST',{});
  assert.equal(r.status,200);assert.equal(r.data.linkedNow,2);
  assert.deepEqual(r.data.sites.map(s=>[s.id,s.gsc,s.ga4]),[['raiz','https://taller.example/','145'],['carpeta','https://taller.example/cliente/',null]]);
  assert.deepEqual(r.data.unused,{gsc:['https://sinficha.example/'],ga4:[]});
  assert.deepEqual(r.data.gtm,[{id:'GTM-AAAA1',name:'Taller'}]);
  const saved=(await store.read()).sites;
  assert.equal(saved[0].gscProperty,'https://taller.example/');
  assert.deepEqual([saved[0].ga4PropertyId,saved[0].ga4StreamId],['145','567']);
  assert(saved[0].ga4UpdatedAt,'trae el histórico al vincular');
  assert.equal(saved[1].gscProperty,'https://taller.example/cliente/');
  assert.equal((await req('admin','conexiones/descubrir','POST',{})).data.linkedNow,0);
});
