import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../lib/store.mjs';
import {bootstrap,handle} from '../lib/api.mjs';

test('administración local gestiona cuatro sitios, sus fichas y su retirada con confirmación',async t=>{
  const store=await openStore({databaseUrl:null,file:':memory:'});t.after(()=>store.close());
  await bootstrap(store,{local:true});let cookie='';
  async function request(path,method='GET',data){
    const req=new Request('http://localhost/api/'+path,{method,headers:{cookie,'content-type':'application/json'},body:data&&JSON.stringify(data)});
    const response=await handle(req,{store,local:true});
    return {body:await response.json(),status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  cookie=(await request('login','POST',{email:'admin',password:'admin'})).cookie;
  const profile={name:'Taller',country:'Chile',language:'es',business:'Muebles',services:'Mesas'};
  const registered=[];
  for(let i=0;i<4;i++){
    const c=await request('sites','POST',{...profile,url:'https://taller'+i+'.example/',authorized:true});
    assert.equal(c.status,201);registered.push(c.body.id);
  }
  const path='sites/'+registered[0];
  assert.equal((await request(path,'PATCH',{...profile,name:'Taller actualizado'})).status,200);
  assert.equal((await request(path)).body.name,'Taller actualizado');
  assert.equal((await request(path,'DELETE',{confirmUrl:'otro'})).status,400);
  assert.equal((await request(path,'DELETE',{confirmUrl:'https://taller0.example/'})).status,200);
  assert.equal((await request(path)).status,404);
  assert.equal((await request('sites')).body.sites.length,3);
  assert.ok((await store.read()).jobs.every(j=>j.siteId!==registered[0]));
});
