import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore, enqueueJob, claimJob, checkpointJob, finishJob, failJob, exportBackup, restoreBackup } from '../lib/store.mjs';
import { createUser, login, authenticate, logout, canAccessSite, tokenFromCookie, sessionCookie } from '../lib/auth.mjs';
import { saveDailyBackup, loadDailyBackup, expiredBackups } from '../lib/backup.mjs';

const options = { databaseUrl: '', file: ':memory:' };

test('dos conexiones ven el mismo estado, una mutación fallida se revierte y otra apertura conserva los datos', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'seobestia-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const loc = { databaseUrl: '', file: join(dir, 'state.sqlite') };
  const a = await openStore(loc), b = await openStore(loc);
  try {
    await Promise.all(Array.from({ length: 20 }, (_, n) => (n % 2 ? a : b).mutate(s => s.sites.push({ id: n }))));
    await assert.rejects(a.mutate(s => { s.sites = []; throw Error('interrupción'); }), /interrupción/);
    assert.equal((await b.read()).sites.length, 20);
    await assert.rejects(a.mutate(async s => { s.sites = []; }), /síncrona/);
  } finally { await a.close(); await b.close(); }
  const reopened = await openStore(loc);
  try { assert.equal((await reopened.read()).sites.length, 20); } finally { await reopened.close(); }
});

test('la sesión es individual, revocable y tiene permisos por sitio', async t => {
  const store = await openStore(options); t.after(() => store.close());
  const person = await createUser(store, { email: ' EQUIPO@example.org ', password: 'Frase-segura-123', name: 'Ana' });
  assert.equal(person.email, 'equipo@example.org');
  const data = await login(store, { email: person.email, password: 'Frase-segura-123' });
  assert.deepEqual(await authenticate(store, tokenFromCookie(sessionCookie(data.token))), person);
  const raw = await store.read();
  assert.ok(!JSON.stringify(raw).includes(data.token));
  assert.ok(!JSON.stringify(raw).includes('Frase-segura-123'));
  assert.equal(canAccessSite(person, { ownerId: 'otro', memberIds: [] }), false);
  assert.equal(canAccessSite(person, { ownerId: 'otro', memberIds: [person.id] }), true);
  assert.equal(canAccessSite(person, { ownerId: person.id }), true);
  await logout(store, data.token);
  assert.equal(await authenticate(store, data.token), null);
});

test('el límite de acceso bloquea intentos también para un correo inexistente', async t => {
  const store = await openStore(options); t.after(() => store.close());
  for (let i = 0; i < 8; i++)
    await assert.rejects(login(store, { email: 'sinacceso@example.org', password: 'incorrecta' }), e => e.status === 401);
  await assert.rejects(login(store, { email: 'sinacceso@example.org', password: 'incorrecta' }), e => e.status === 429);
});

test('trabajos repetidos, interrupción, exclusión y escritura protegida por token', async t => {
  const store = await openStore(options); t.after(() => store.close());
  const now = Date.now(), spec = { siteId: 'uno', day: '2026-11-03', now };
  const [first, second] = await Promise.all([store.mutate(s => enqueueJob(s, spec)), store.mutate(s => enqueueJob(s, spec))]);
  assert.equal(first.id, second.id);
  const job = await store.mutate(s => claimJob(s, { now, leaseMs: 1000 }));
  await store.mutate(s => checkpointJob(s, job.id, job.leaseToken, { now, leaseMs: 1000, cursor: 4 }));
  assert.equal(await store.mutate(s => claimJob(s, { now: now + 900 })), null);
  const recovered = await store.mutate(s => claimJob(s, { now: now + 1001 }));
  assert.equal(recovered.cursor, 4);
  await assert.rejects(store.mutate(s => { s.sites.push({ id: 'obsoleto' }); finishJob(s, job.id, job.leaseToken, { now: now + 1100 }); }), e => e.status === 409);
  await store.mutate(s => failJob(s, recovered.id, recovered.leaseToken, { now: now + 1200, error: 'Cuota', retryAt: now + 4000 }));
  assert.equal(await store.mutate(s => claimJob(s, { now: now + 2000 })), null);
  const last = await store.mutate(s => claimJob(s, { now: now + 4001 }));
  await store.mutate(s => finishJob(s, last.id, last.leaseToken, { now: now + 4002, result: { revisadas: 2 } }));
  const state = await store.read();
  assert.deepEqual(state.sites, []);
  assert.equal(state.jobs.length, 1);
  assert.equal(state.jobs[0].status, 'done');
});

test('copia cifrada, rotación y restauración en base separada sin recuperar sesiones', async t => {
  const a = await openStore(options), b = await openStore(options);
  const dir = await mkdtemp(join(tmpdir(), 'seobestia-backup-'));
  t.after(async () => { await a.close(); await b.close(); await rm(dir, { recursive: true, force: true }); });
  const env = { SEO_BACKUP_DIR: dir, SEO_BACKUP_KEY: 'SoloParaFixtures-Frase-Privada-123456789' };
  await a.mutate(s => { s.sites.push({ id: 'ejemplo', name: 'Cliente confidencial' }); s.sessions.push({ userId: 'x' }); });
  assert.ok((await saveDailyBackup(a, '2026-11-03', env)).created);
  assert.ok(!(await saveDailyBackup(a, '2026-11-03', env)).created);
  const bytes = await readFile(join(dir, '2026-11-03.sbk'));
  assert.ok(!bytes.includes(Buffer.from('Cliente confidencial')));
  await loadDailyBackup(b, '2026-11-03', env);
  assert.equal((await b.read()).sites[0].name, 'Cliente confidencial');
  assert.deepEqual((await b.read()).sessions, []);
  const bad = await exportBackup(a, env.SEO_BACKUP_KEY);
  bad[bad.length - 1] ^= 1;
  await assert.rejects(restoreBackup(b, bad, env.SEO_BACKUP_KEY));
  assert.equal((await b.read()).sites[0].id, 'ejemplo');
  const names = Array.from({ length: 65 }, (_, i) => new Date(Date.UTC(2026, 6, i+1)).toISOString().slice(0,10) + '.sbk');
  assert.equal(expiredBackups(names).length, names.length - 11);
});
