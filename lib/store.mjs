import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash, scrypt } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import {schemaSQL} from './postgres-schema.mjs';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';

const compress = promisify(gzip);
const expand = promisify(gunzip);
const derive = promisify(scrypt);
const collections = ['users', 'sessions', 'sites', 'jobs', 'loginAttempts'];
const initial = () => ({ version: 1, users: [], sessions: [], sites: [], jobs: [], loginAttempts: [] });

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function validState(state) {
  if (!state || state.version !== 1 || collections.some(k => !Array.isArray(state[k]))) {
    throw new Error('El formato de los datos es incompatible.');
  }
  return state;
}

function apply(state, fn, scoped = false) {
  const result = fn(state);
  if (result && typeof result.then === 'function') {
    result.catch(() => {});
    throw new TypeError('Las transacciones deben completarse de forma síncrona.');
  }
  if (!scoped) validState(state);
  return result;
}

const summaryKeys = ['id','name','url','demo','lastReviewAt','lastCompleteAt','missedSince','ownerId','memberIds','country','language','createdAt','gscProperty','ga4PropertyId','ga4StreamId','ga4LiveReviewRequired'];
function siteSummary(site) {
  return { ...Object.fromEntries(summaryKeys.filter(k => Object.hasOwn(site,k)).map(k => [k,site[k]])),
    score: site.audit?.score ?? site.score ?? null, hasCrawlCursor: Boolean(site.crawlCursor?.queue?.length) };
}
function scopeState(state, opts = {}) {
  const part = opts.keys ? Object.fromEntries(opts.keys.map(k => [k,state[k]])) : { ...state };
  if (part.sites && opts.siteId) part.sites = part.sites.filter(site => site.id === opts.siteId);
  if (part.sites && opts.siteSummary) part.sites = part.sites.map(siteSummary);
  return part;
}
function records(part) {
  const map = new Map();
  for (const [kind, data] of Object.entries(part)) {
    const items = kind === 'sites' ? data.map(site => [String(site.id), site]) : [['',data]];
    for (const [item, value] of items) map.set(JSON.stringify([kind,item]), JSON.stringify(value));
  }
  return map;
}
function reconstruct(rows, opts) {
  const state = !opts?.keys || opts.keys.includes('sites') ? { sites: [] } : {};
  for (const { kind, body } of rows) {
    if (kind === 'sites') state.sites.push(body);
    else state[kind] = body;
  }
  return state;
}

// Only a short, synchronous state transition may run under the database lock.
// Crawling, password hashing and uploads happen outside this transaction.
export async function openStore({
  databaseUrl = process.env.DATABASE_URL,
  file = process.env.SEO_DB_PATH || '.local/seobestia.sqlite',
} = {}) {
  if (databaseUrl) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
    async function transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }
    async function writeRecords(client, before, state, opts) {
      const after = records(state);
      for (const key of before.keys()) {
        if (after.has(key)) continue;
        const [kind, item] = JSON.parse(key);
        if (kind === 'sites' && opts?.siteSummary) throw new Error('Se requiere la ficha completa para eliminar un sitio.');
        await client.query('DELETE FROM seobestia_parts WHERE kind=$1 AND item=$2', [kind,item]);
      }
      for (const [key, value] of after) {
        if (before.get(key) === value) continue;
        const [kind, item] = JSON.parse(key);
        if (kind === 'sites' && opts?.siteSummary) {
          const patch = JSON.parse(value);
          if (!before.has(key) || Object.keys(patch).some(k => ![...summaryKeys,'score','hasCrawlCursor'].includes(k))) throw Error('Modificación inválida del resumen.');
          const fields = Object.fromEntries(summaryKeys.filter(k=>Object.hasOwn(patch,k)).map(k=>[k,patch[k]]));
          await client.query('UPDATE seobestia_parts SET body=(body-$4::text[]) || $5::jsonb, summary=$3::jsonb WHERE kind=$1 AND item=$2', [kind,item,value,summaryKeys,JSON.stringify(fields)]);
        } else {
          const summary = kind === 'sites' ? JSON.stringify(siteSummary(JSON.parse(value))) : null;
          await client.query('INSERT INTO seobestia_parts(kind,item,body,summary) VALUES($1,$2,$3,$4) ON CONFLICT (kind,item) DO UPDATE SET body=EXCLUDED.body,summary=EXCLUDED.summary', [kind,item,value,summary]);
        }
      }
    }
    async function load(client, opts = {}) {
      const rows = (await client.query(`SELECT kind, CASE WHEN $3 AND kind='sites' THEN summary ELSE body END AS body
        FROM seobestia_parts WHERE ($1::text[] IS NULL OR kind=ANY($1::text[]))
        AND ($2::text IS NULL OR kind<>'sites' OR item=$2) ORDER BY sequence`, [opts.keys || null, opts.siteId || null, !!opts.siteSummary])).rows;
      return reconstruct(rows,opts);
    }
    try {
      await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(173859722)');
        await client.query(schemaSQL);
        const installed = await client.query("SELECT 1 FROM seobestia_parts WHERE kind='version' AND item=''");
        if (!installed.rowCount) {
          const old = await client.query("SELECT to_regclass('seobestia_state') AS original");
          const existing = old.rows[0].original && (await client.query('SELECT body FROM seobestia_state WHERE singleton=1')).rows[0]?.body;
          await writeRecords(client, new Map(), validState(existing || initial()));
        }
      });
    } catch (error) {
      await pool.end();
      throw error;
    }
    return {
      readGoogleEnvelopes:async()=>(await pool.query('SELECT target,envelope FROM seobestia_google_vault')).rows,
      async saveGoogleEnvelope(target,envelope){
        await pool.query('INSERT INTO seobestia_google_vault(target,envelope) VALUES ($1,$2) ON CONFLICT(target) DO UPDATE SET envelope=excluded.envelope',[target,envelope]);
      },
      read: (opts) => load(pool,opts),
      mutate(fn, opts) {
        return transaction(async client => {
          await client.query('SELECT pg_advisory_xact_lock(173859722)');
          const part = await load(client, opts);
          const before = records(part);
          const result = apply(part, fn, !!opts);
          await writeRecords(client, before, part, opts);
          return result;
        });
      },
      close: () => pool.end(),
      backend: 'postgres',
    };
  }
  if (process.env.NETLIFY === 'true' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error('Configura DATABASE_URL para guardar datos en el despliegue.');
  }
  const { DatabaseSync } = await import('node:sqlite');
  if (file !== ':memory:') {
    file = resolve(file);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL');
  db.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO state(id,body) VALUES (1,?)').run(JSON.stringify(initial()));
  const select = db.prepare('SELECT body FROM state WHERE id=1');
  const update = db.prepare('UPDATE state SET body=? WHERE id=1');
  return {
    async read(opts) { return scopeState(validState(JSON.parse(select.get().body)), opts); },
    async mutate(fn, opts) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const whole = validState(JSON.parse(select.get().body));
        const part = opts ? scopeState(whole, opts) : whole;
        const result = apply(part, fn, !!opts);
        if (opts) {
          for (const [key,value] of Object.entries(part)) {
            if (key !== 'sites' || (!opts.siteId && !opts.siteSummary)) whole[key] = value;
            else {
              const selected = new Map(value.map(s => [s.id,s]));
              whole.sites = whole.sites.flatMap(s => {
                if (opts.siteId && s.id !== opts.siteId) return [s];
                const replacement = selected.get(s.id);
                if (!replacement && opts.siteSummary) throw new Error('Se requiere la ficha completa para eliminar un sitio.');
                const fields = replacement && Object.fromEntries(summaryKeys.filter(k=>Object.hasOwn(replacement,k)).map(k=>[k,replacement[k]]));
                return replacement ? [opts.siteSummary ? { ...s,...fields } : replacement] : [];
              });
            }
          }
        }
        update.run(JSON.stringify(validState(whole)));
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async close() { db.close(); },
    backend: 'sqlite',
  };
}

const iso = time => new Date(time).toISOString();
const millis = time => new Date(time).getTime();

export function enqueueJob(state, { siteId, day, type = 'daily', payload = {}, now = Date.now() }) {
  if (!siteId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError('Sitio o día inválido.');
  const found = state.jobs.find(j => j.siteId === siteId && j.day === day && j.type === type);
  if (found) return found;
  const job = { id: randomUUID(), siteId, day, type, payload, status: 'pending', attempts: 0,
    createdAt: iso(now), nextRunAt: iso(now), leaseToken: null, leaseUntil: null, cursor: null };
  state.jobs.push(job);
  return job;
}

export function claimJob(state, { now = Date.now(), leaseMs = 120000, siteId, maxAttempts = 3 } = {}) {
  const t = millis(now);
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new TypeError('Duración inválida.');
  const available = state.jobs.filter(j => (!siteId || j.siteId === siteId) && (
    (j.status === 'pending' && millis(j.nextRunAt) <= t) ||
    (j.status === 'running' && millis(j.leaseUntil) <= t)
  )).sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
  for (const job of available) {
    if (job.attempts >= maxAttempts) {
      Object.assign(job, { status: 'failed', error: 'Se agotaron los intentos de revisión.', finishedAt: iso(t), leaseToken: null, leaseUntil: null });
      continue;
    }
    // Two batches for different dates of the same site must not overwrite each other's observations.
    if (state.jobs.some(other => other !== job && other.siteId === job.siteId && other.status === 'running' && millis(other.leaseUntil) > t)) continue;
    Object.assign(job, { status: 'running', attempts: job.attempts + 1, startedAt: iso(t), leaseUntil: iso(t + leaseMs), leaseToken: randomUUID() });
    return job;
  }
  return null;
}

function ownedJob(state, id, leaseToken, now) {
  const job = state.jobs.find(j => j.id === id);
  if (!job || job.status !== 'running' || !leaseToken || job.leaseToken !== leaseToken || millis(job.leaseUntil) <= millis(now)) {
    throw httpError(409, 'Otro proceso controla esta revisión o su plazo expiró.');
  }
  return job;
}

export function checkpointJob(state, id, leaseToken, { cursor, now = Date.now(), leaseMs = 120000 }) {
  const job = ownedJob(state, id, leaseToken, now);
  Object.assign(job, { cursor, leaseUntil: iso(millis(now) + leaseMs) });
  return job;
}

export function finishJob(state, id, leaseToken, { result, now = Date.now() } = {}) {
  const job = ownedJob(state, id, leaseToken, now);
  Object.assign(job, { status: 'done', result, error: null, finishedAt: iso(now), leaseToken: null, leaseUntil: null });
  return job;
}

export function failJob(state, id, leaseToken, { error, retryAt, now = Date.now() } = {}) {
  const job = ownedJob(state, id, leaseToken, now);
  Object.assign(job, { status: retryAt ? 'pending' : 'failed', error: String(error || 'No se completó la revisión.').slice(0, 300),
    nextRunAt: retryAt ? iso(retryAt) : null, finishedAt: retryAt ? null : iso(now), leaseToken: null, leaseUntil: null });
  return job;
}

const magic = Buffer.from('SEOBKP01');
const headerBytes = 52; // magic + salt + nonce + authentication tag
export const BACKUP_FILE_BYTES = 128 * 1024 * 1024;
const manifestBytes = 256 * 1024 * 1024;
// Lower limits let a host reserve memory. They can never increase the format ceilings.
function backupLimits({maxFileBytes=BACKUP_FILE_BYTES,maxManifestBytes=manifestBytes}={}) {
  if (!Number.isSafeInteger(maxFileBytes)||maxFileBytes<=headerBytes||!Number.isSafeInteger(maxManifestBytes)||maxManifestBytes<1)
    throw new RangeError('Límites del respaldo inválidos.');
  return {file:Math.min(BACKUP_FILE_BYTES,maxFileBytes),plain:Math.min(manifestBytes,maxManifestBytes)};
}
const tooLarge=()=>new RangeError('El respaldo excede el tamaño admitido. Se conservó el estado anterior.');
function checkKey(key) {
  if (typeof key !== 'string' || key.length < 32) throw new Error('El respaldo requiere una clave de al menos 32 caracteres.');
}

export async function exportBackup(store, key, options) {
  checkKey(key);
  const limits=backupLimits(options);
  const state = await store.read();
  // Live sessions and obsolete lock tokens must never be reactivated after a restore.
  state.sessions = [];
  state.loginAttempts = [];
  for (const job of state.jobs) {
    if (job.status === 'running') Object.assign(job, { status: 'pending', attempts: 0, nextRunAt: iso(Date.now()), leaseToken: null, leaseUntil: null });
  }
  const json = JSON.stringify(state);
  const envelope=JSON.stringify({format:1,createdAt:new Date().toISOString(),checksum:createHash('sha256').update(json).digest('hex')});
  const prefix=envelope.slice(0,-1)+',"state":';
  if(Buffer.byteLength(prefix)+Buffer.byteLength(json)+1>limits.plain)throw tooLarge();
  let data;
  try {data=await compress(prefix+json+'}',{maxOutputLength:limits.file-headerBytes});}
  catch(e){if(e.code==='ERR_BUFFER_TOO_LARGE')throw tooLarge();throw e;}
  const salt = randomBytes(16), nonce = randomBytes(12);
  const secret = await derive(key, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', secret, nonce);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([magic, salt, nonce, cipher.getAuthTag(), encrypted]);
}

export async function restoreBackup(store, buffer, key, options) {
  checkKey(key);
  const limits=backupLimits(options);
  if(Buffer.isBuffer(buffer)&&buffer.length>limits.file)throw tooLarge();
  if (!Buffer.isBuffer(buffer) || buffer.length < 53 || !magic.equals(buffer.subarray(0, 8))) throw new Error('Formato de respaldo no válido.');
  const secret = await derive(key, buffer.subarray(8, 24), 32);
  const decipher = createDecipheriv('aes-256-gcm', secret, buffer.subarray(24, 36));
  decipher.setAAD(magic);
  decipher.setAuthTag(buffer.subarray(36, 52));
  const compressed = Buffer.concat([decipher.update(buffer.subarray(52)), decipher.final()]);
  let decoded;
  try {decoded=await expand(compressed,{maxOutputLength:limits.plain});}
  catch(e){if(e.code==='ERR_BUFFER_TOO_LARGE')throw tooLarge();throw e;}
  const manifest=JSON.parse(decoded.toString('utf8'));
  if (manifest.format !== 1 || manifest.checksum !== createHash('sha256').update(JSON.stringify(manifest.state)).digest('hex')) {
    throw new Error('La comprobación de integridad del respaldo falló.');
  }
  const recovered = validState(manifest.state);
  return store.mutate(state => {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, recovered, { sessions: [], loginAttempts: [] });
    return { users: state.users.length, sites: state.sites.length, jobs: state.jobs.length };
  });
}
