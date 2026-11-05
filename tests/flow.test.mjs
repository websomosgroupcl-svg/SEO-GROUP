import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../lib/store.mjs';
import {handle} from '../lib/api.mjs';

test('recorrido del equipo: alta, evidencia CSV, brief, conflicto, cambio aplicado, aislamiento',async()=>{
 const store=await openStore({file:':memory:',databaseUrl:null});
 let cookie='';
 async function request(path,method='GET',data,session=cookie,headers={}) {
   const response=await handle(new Request('http://localhost:4173/api/'+path,{method,headers:{cookie:session,'content-type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)}),{store,local:true});
   return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 try{
   const credentials={email:'admin@example.org',name:'Equipo',password:'password-for-tests-only'};
   const admin=await request('setup','POST',credentials);assert.equal(admin.status,201);cookie=admin.cookie;
   assert.equal((await request('setup','POST',{...credentials,email:'otro@example.org'},'')).status,409);
   const created=await request('sites','POST',{name:'Taller',url:'https://taller.example/',authorized:true,business:'Carpintería',services:'mesas, armarios',country:'Chile'});
   assert.equal(created.status,201);
   const path='sites/'+created.body.id;
   const csv='Fecha;Consulta;Página;País;Clics;Impresiones;Posición\n2026-01-01;mesa plegable para cocina;https://taller.example/mesas;Chile;2;80;11,5';
   for(let i=0;i<2;i++)assert.equal((await request(path+'/import','POST',{csv})).status,200);
   const current=(await request(path)).body;assert.equal(current.rowsCount,1);
   const op=current.opportunities.find(o=>o.observed);
   assert.equal(op.impressions,80);assert.equal(op.volume,null);
   assert.equal((await request(path+'/evidence?opportunityId='+op.id)).body.rows[0].query,op.keyword);
   const t=(await request(path+'/tasks','POST',{opportunityId:op.id})).body;
   let ed=await request(path+'/tasks/'+t.id,'PATCH',{brief:'Aportar medidas verificadas y fotos del taller.',status:'aplicada',page:op.page,appliedAt:'2026-01-02',expectedUpdatedAt:t.updatedAt});
   assert.equal(ed.status,200);assert.equal(ed.body.versionCount,2);assert.equal(ed.body.versions,undefined);assert.ok(ed.body.result.message);
   const historyPath=path+'/tasks/'+t.id+'/versions';
   const history=await request(historyPath);
   assert.equal(history.status,200);assert.equal(history.body.total,2);
   assert.equal(history.body.versions[0].brief,ed.body.brief);assert.equal(history.body.versions[1].brief,t.brief);
   assert.equal((await request(path+'/tasks/'+t.id,'PATCH',{brief:'texto obsoleto',expectedUpdatedAt:t.updatedAt})).status,409);
   const member={email:'member@example.org',name:'Miembro',password:'member-password-for-test',siteIds:[]};
   assert.equal((await request('users','POST',member)).status,201);
   const login=await request('login','POST',member,'');
   assert.equal((await request(path,'GET',undefined,login.cookie)).status,404);
   assert.equal((await request(historyPath,'GET',undefined,login.cookie)).status,404);
   assert.equal((await request(path+'/import','POST',{csv},cookie,{origin:'https://otro.example'})).status,403);
   assert.equal((await request('logout','POST',{})).status,200);
   assert.equal((await request('sites')).status,401);
 }finally{await store.close();}
});
test('demo aislada y desactivada en modo alojado',async()=>{
 const store=await openStore({file:':memory:',databaseUrl:null});
 const req=()=>new Request('http://localhost/api/demo',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 try{
   assert.equal((await handle(req(),{store,local:false})).status,401);
   const a=await handle(req(),{store,local:true});assert.equal(a.status,200);
   const b=await handle(req(),{store,local:true});const other=await b.json();
   const site=await handle(new Request('http://localhost/api/sites/'+other.id,{headers:{cookie:a.headers.get('set-cookie')}}),{store,local:true});
   assert.equal(site.status,404);
 }finally{await store.close();}
});

