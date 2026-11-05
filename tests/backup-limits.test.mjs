import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {exportBackup,restoreBackup,openStore} from '../lib/store.mjs';

test('la misma frontera del manifiesto UTF-8 se aplica antes de guardar y restaurar',async t=>{
  const time=new Date('2026-01-01T00:00:00Z');t.mock.timers.enable({apis:['Date'],now:time});
  const store=await openStore({databaseUrl:'',file:':memory:'}),target=await openStore({databaseUrl:'',file:':memory:'});
  t.after(async()=>{await store.close();await target.close();});
  await store.mutate(s=>s.sites.push({id:'origen',nota:'árbol'.repeat(4000)}));
  await target.mutate(s=>s.sites.push({id:'destino'}));
  const state=await store.read(),key='fixture-privada-de-32-caracteres-o-mas';
  const checksum=createHash('sha256').update(JSON.stringify(state)).digest('hex');
  const bytes=Buffer.byteLength(JSON.stringify({format:1,createdAt:time.toISOString(),checksum,state}));
  const ok={maxManifestBytes:bytes};
  const packed=await exportBackup(store,key,ok);
  assert.ok(packed.length*10<bytes); // Previously such an archive could exceed the reader's expansion limit.
  await assert.rejects(exportBackup(store,key,{maxManifestBytes:bytes-1}),/tamaño admitido/);
  await assert.rejects(restoreBackup(target,packed,key,{maxManifestBytes:bytes-1}),/tamaño admitido/);
  await assert.rejects(exportBackup(store,key,{maxFileBytes:packed.length-1}),/tamaño admitido/);
  await assert.rejects(restoreBackup(target,packed,key,{maxFileBytes:packed.length-1}),/tamaño admitido/);
  assert.equal((await target.read()).sites[0].id,'destino');
  await restoreBackup(target,packed,key,{maxManifestBytes:bytes,maxFileBytes:packed.length});
  assert.deepEqual((await target.read()).sites,state.sites);
});
