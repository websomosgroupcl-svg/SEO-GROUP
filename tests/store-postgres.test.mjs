import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openStore, exportBackup, restoreBackup } from '../lib/store.mjs';
import { createUser, login, authenticate } from '../lib/auth.mjs';

// This test runs only on a dedicated loopback cluster. It creates and drops its own schema.
const target = process.env.SEO_TEST_POSTGRES;
test('PostgreSQL: escrituras concurrentes, lecturas acotadas, rollback y restauración', { skip: !target }, async () => {
  const url = new URL(target);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  const { Client } = await import('pg');
  const admin = new Client({ connectionString: target });
  await admin.connect();
  const ns = 'fixture_' + randomBytes(8).toString('hex');
  let a,b;
  try {
    await admin.query('CREATE SCHEMA ' + ns);
    url.searchParams.set('options', '-c search_path=' + ns);
    [a,b] = await Promise.all([openStore({ databaseUrl:url.href }), openStore({ databaseUrl:url.href })]);
    const attempts = await Promise.allSettled([a,b].map((s,i) => createUser(s,{
      email:'admin'+i+'@example.org',role:'admin',password:'Clave-en-prueba-108',onlyFirstAdmin:true
    })));
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
    const user = attempts.find(x=>x.status==='fulfilled').value;
    const { token } = await login(a,{email:user.email,password:'Clave-en-prueba-108'});
    assert.equal((await authenticate(b,token)).id,user.id);
    const scoped = {keys:['sites','jobs'],siteSummary:true};
    await a.mutate(s => {
      for (let i=0;i<3;i++) s.sites.push({id:'s'+i,name:'Prueba '+i,ownerId:user.id,memberIds:[],country:'CL',audit:{score:85},crawlCursor:{queue:['https://example.org/p']},rows:
        Array.from({length:1200},(_,n)=>({query:'consulta de ejemplo '+n,page:'https://example.org/test/'+(n%40),clicks:n%8,impressions:20+n}))});
    });
    await Promise.all(Array.from({length:24},(_,i) => (i%2?a:b).mutate(s=>{s.jobs.push({id:i});},{keys:['jobs']})));
    const count = await b.mutate(s => {s.sites[0].missedSince='2026-11-01'; return s.jobs.length;},scoped);
    assert.equal(count,24);
    const selected = (await a.read({keys:['sites'],siteId:'s0'})).sites;
    assert.equal(selected.length,1); assert.equal(selected[0].rows.length,1200); assert.equal(selected[0].missedSince,'2026-11-01');
    assert.deepEqual(selected[0].crawlCursor.queue,['https://example.org/p']);
    const summary = await a.read(scoped);
    assert.equal(summary.sites[0].score,85); assert.equal(summary.sites[0].hasCrawlCursor,true); assert.ok(!('rows' in summary.sites[0]));
    await assert.rejects(a.mutate(s=>{ s.sites=[]; throw Error('rollback'); }));
    const full = await b.read(); assert.equal(full.sites.length,3);
    const key='Una-clave-de-prueba-para-verificar-32';
    const snapshot = await exportBackup(a,key);
    await b.mutate(s=>{s.sites=[];});
    await restoreBackup(a,snapshot,key);
    assert.equal((await b.read()).sites[2].rows.length,1200);
    assert.equal(await authenticate(b,token),null);
    const bytes = x=>Buffer.byteLength(JSON.stringify(x));
    console.log(JSON.stringify({postgres: (await admin.query('SHOW server_version')).rows[0].server_version,
      fullJson:bytes(full), authJson:bytes(await a.read({keys:['users','sessions']})), summaryJson:bytes(summary),singleSiteJson:bytes(selected), encryptedBackup:snapshot.length }));
  } finally {
    if (a) await a.close(); if (b) await b.close();
    await admin.query('DROP SCHEMA IF EXISTS ' + ns + ' CASCADE');
    await admin.end();
  }
});
