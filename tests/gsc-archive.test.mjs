import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planArchive,saveGscArchive,readGscArchive,commitSearchRows} from '../lib/gsc-archive.mjs';
import {openStore} from '../lib/store.mjs';
import {createUser,login} from '../lib/auth.mjs';
import {handle} from '../lib/api.mjs';

const row=(date,page,source='Search Console')=>({date,page,query:'consulta',clicks:1,impressions:5,country:'CHL',device:'MOBILE',source});
const today='2026-11-04', base='https://ejemplo.cl';
function fixture(){
  const a=base+'/protegida', b=base+'/otra';
  return {id:'cliente',tasks:[{page:a,appliedAt:'2026-04-15'}],rows:[
    row('2026-04-01',a),row('2026-01-01',b,'CSV'),row('2026-10-10',b),row('2026-01-02',b),row('2026-01-03',b)]};
}
const gsc={totals:[{date:'2026-11-01',clicks:2}],rows:[row('2026-11-01',base)]};

test('solo los lotes verificados de GSC salen de la ventana, el administrador recupera exactamente las filas',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'seobestia-archivo-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const store={backend:'sqlite'},env={SEO_BACKUP_DIR:dir,SEO_BACKUP_KEY:'Una-clave-de-prueba-separada-de-la-copia'};
  const site=fixture(),before=structuredClone(site.rows);
  const groups=planArchive(site,gsc,today,5);
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].map(r=>r.date),['2026-01-02','2026-01-03']);
  assert.equal(commitSearchRows(site,gsc,[],today,5),false);
  assert.deepEqual(site.rows,before);
  const meta=await saveGscArchive(store,site.id,groups[0],env);
  assert.equal(commitSearchRows(site,gsc,[{meta,rows:groups[0]}],today,5),true);
  assert.ok(site.rows.some(r=>r.source==='CSV'));
  assert.ok(site.rows.some(r=>r.date==='2026-04-01'));
  assert.ok(site.rows.some(r=>r.date==='2026-10-10'));
  assert.ok(site.rows.some(r=>r.date==='2026-11-01'));
  assert.equal(site.gscArchives.length,1);
  const archive=await readGscArchive(store,site,meta.id,env);
  assert.deepEqual(archive.rows,groups[0]);assert.equal(archive.siteId,site.id);
  const bytes=await readFile(join(dir,'gsc',meta.id+'.gsc'));
  assert.equal(bytes.includes(Buffer.from(base)),false);
  bytes[bytes.length-1]^=1;await writeFile(join(dir,'gsc',meta.id+'.gsc'),bytes);
  await assert.rejects(readGscArchive(store,site,meta.id,env));
  await assert.rejects(readGscArchive(store,{id:'otro'},meta.id,env),e=>e.status===404);
});

test('nueva tarea creada durante la exportación protege filas; CSV y registros recientes impiden rotación destructiva',()=>{
  const site=fixture(), before=structuredClone(site.rows);
  const [rows]=planArchive(site,gsc,today,5);
  site.tasks.push({page:base+'/otra',appliedAt:'2026-01-15'});
  assert.equal(commitSearchRows(site,gsc,[{rows,meta:{id:'recibo-verificado'}}],today,5),false);
  assert.deepEqual(site.rows,before);
  assert.deepEqual(planArchive(site,gsc,today,5),[]);
});

test('descarga del detalle conservado requiere administración y se limita al sitio y la fuente',async t=>{
  const store=await openStore({databaseUrl:null,file:':memory:'});t.after(()=>store.close());
  const pass='Una frase de acceso solo para la prueba';
  const admin=await createUser(store,{email:'admin@example.cl',name:'Primera',password:pass,role:'admin'});
  const member=await createUser(store,{email:'socio@example.cl',name:'Socio',password:pass});
  const site=fixture();site.ownerId=admin.id;site.memberIds=[member.id];site.url=base;site.gscUntil='2026-10-10';
  await store.mutate(s=>s.sites.push(site));
  async function get(user,path){
    const {token}=await login(store,{email:user.email,password:pass});
    return handle(new Request('https://piloto.example/api/sites/'+path,{headers:{cookie:'seobestia_session='+token}}),{store});
  }
  assert.equal((await get(member,'cliente/gsc-detail')).status,403);
  assert.equal((await get(admin,'desconocido/gsc-detail')).status,404);
  const res=await get(admin,'cliente/gsc-detail');
  assert.equal(res.status,200);assert.match(res.headers.get('content-disposition'),/attachment/);
  const saved=await res.json();assert.equal(saved.total,4);assert.ok(saved.rows.every(r=>r.source==='Search Console'));
});
