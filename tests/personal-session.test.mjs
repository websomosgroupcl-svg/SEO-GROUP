import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../lib/store.mjs';
import {handle} from '../lib/api.mjs';
import {makeDemo} from '../lib/site.mjs';

test('la clave y los borradores pertenecen a la sesión, el equipo comparte solo un encargo aceptado',async t=>{
  const store=await openStore({file:':memory:',databaseUrl:''});t.after(()=>store.close());
  const key='seobestia-ficticia-para-pruebas';let calls=0;
  async function request(path,method='GET',data,cookie=''){
    const req=new Request('http://localhost/api/'+path,{method,headers:{cookie,'content-type':'application/json'},body:data&&JSON.stringify(data)});
    const res=await handle(req,{store,local:true,generateIdeas:async({ideas,apiKey,provider})=>{
      calls++;assert.equal(apiKey,key);
      return ideas.map(i=>({id:i.id,title:'Título de prueba',angle:'Medir el espacio disponible',provider,model:'ficticio',outline:['Tomar medidas','Comprobar el ajuste']}));
    }});
    return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const admin=await request('setup','POST',{email:'admin@example.net',name:'Admin',password:'credencial-demo-123'});
  const a=admin.cookie,uid=admin.body.user.id;
  const demo=makeDemo({id:uid});await store.mutate(st=>st.sites.push(demo));
  const base='sites/'+demo.id;
  const other=await request('users','POST',{email:'editor@example.net',name:'Editor',password:'una-contrasena-ficticia',siteIds:[demo.id]},a);
  assert.equal(other.status,201);
  const login=await request('login','POST',{email:'editor@example.net',password:'una-contrasena-ficticia'});
  const b=login.cookie,member=login.body.user.id;
  assert.equal((await request('mi-ia')).status,401);
  assert.equal((await request('mi-ia','PUT',{provider:'openai',apiKey:key,userId:member},a)).status,409);
  assert.deepEqual((await request('mi-ia','PUT',{provider:'openai',apiKey:key,userId:uid},a)).body,{provider:'openai',configured:true});
  assert.ok(!JSON.stringify(await store.read()).includes(key));
  assert.equal((await request('mi-ia','GET',null,b)).body.configured,false);
  assert.equal((await request(base+'/editorial-ia','POST',{provider:'openai',limit:1,userId:member},b)).status,409);
  const response=await request(base+'/editorial-ia','POST',{provider:'openai',limit:2,userId:uid},a);
  assert.equal(response.status,200);assert.equal(calls,1);
  assert.ok(!JSON.stringify(response.body).includes(key));
  const {draft,id}=response.body.ideas[0],payload={editorialId:id,draftId:draft.draftId};
  assert.equal((await request(base+'/tasks','POST',payload,b)).status,409);
  const result=(await request(base+'/tasks','POST',payload,a)).body;
  assert.equal(result.petMilestone,'registrada');assert.match(result.brief,/Medir el espacio/);
  assert.equal(result.title,draft.title);assert.ok(result.editorial.evidence[0].impressions>0);
  const again=(await request(base+'/tasks','POST',payload,a)).body;
  assert.equal(again.id,result.id);assert.equal(again.petMilestone,null);
  const shared=(await request(base,'GET',null,b)).body;
  assert.ok(!JSON.stringify(shared).includes(key));assert.ok(shared.tasks.some(v=>v.id===result.id));
  assert.equal((await request('mi-ia','DELETE',{userId:uid},a)).body.configured,false);
  assert.equal((await request(base+'/editorial-ia','POST',{provider:'openai',limit:1,userId:uid},a)).status,409);
  await request('logout','POST',{},a);assert.equal((await request('mi-ia','GET',null,a)).status,401);
  assert.equal(calls,1);
});

