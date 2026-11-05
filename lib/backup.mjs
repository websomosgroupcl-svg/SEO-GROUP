import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile, unlink, rename, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { BACKUP_FILE_BYTES, exportBackup, restoreBackup } from './store.mjs';

const prefix = 'seobestia-backups/';
const namePattern = /^\d{4}-\d{2}-\d{2}\.sbk$/;
function backupName(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error('Fecha del respaldo inválida.');
  return day + '.sbk';
}

// Keep the most recent seven days represented, then one snapshot per older ISO week.
export function expiredBackups(names) {
  const sorted = [...new Set(names.filter(n => namePattern.test(n)))].sort().reverse();
  const weeks = new Set();
  return sorted.slice(7).filter(name => {
    const d = new Date(name.slice(0, 10) + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    const week = d.toISOString().slice(0, 10);
    if (weeks.has(week) || weeks.size >= 4) return true;
    weeks.add(week);
    return false;
  });
}

async function atomicCreate(path, bytes) {
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
  try { await rename(temp, path); return true; } catch (err) {
    await unlink(temp).catch(() => {});
    throw err;
  }
}

export async function privateStorageConfig(store, env) {
  const local = store.backend === 'sqlite';
  const root = resolve(env.SEO_BACKUP_DIR || '.local/backups');
  let key = env.SEO_BACKUP_KEY;
  if (!local && !key) throw new Error('Configura SEO_BACKUP_KEY para activar copias cifradas.');
  if (local) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (!key) {
      const keyPath = resolve(env.SEO_BACKUP_KEY_FILE || join(dirname(root), '.backup-key'));
      await mkdir(dirname(keyPath), { recursive: true, mode: 0o700 });
      try { key = await readFile(keyPath, 'utf8'); } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        await writeFile(keyPath, randomBytes(32).toString('base64url'), { flag: 'wx', mode: 0o600 }).catch(e => {
          if (e.code !== 'EEXIST') throw e;
        });
        key = await readFile(keyPath, 'utf8');
      }
    }
    return { root, key, local };
  }
  const endpoint = env.SEO_S3_ENDPOINT, bucket = env.SEO_S3_BUCKET;
  if (!endpoint || new URL(endpoint).protocol !== 'https:' || !bucket || !env.SEO_S3_ACCESS_KEY_ID || !env.SEO_S3_SECRET_ACCESS_KEY) {
    throw new Error('Configura el bucket privado de copias y sus credenciales SEO_S3_*.');
  }
  const s3 = await import('@aws-sdk/client-s3');
  const client = new s3.S3Client({ endpoint, region: env.SEO_S3_REGION || 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: env.SEO_S3_ACCESS_KEY_ID, secretAccessKey: env.SEO_S3_SECRET_ACCESS_KEY } });
  return { local, key, client, bucket, s3 };
}

async function list(c) {
  if (c.local) return (await readdir(c.root)).filter(n => namePattern.test(n)).sort().reverse();
  const files = [];
  let ContinuationToken;
  do {
    const result = await c.client.send(new c.s3.ListObjectsV2Command({ Bucket: c.bucket, Prefix: prefix, ContinuationToken }));
    for (const o of result.Contents || []) {
      const name = o.Key.slice(prefix.length);
      if (namePattern.test(name)) files.push(name);
    }
    ContinuationToken = result.NextContinuationToken;
  } while (ContinuationToken);
  return files.sort().reverse();
}

export async function saveDailyBackup(store, day, env = process.env) {
  const name = backupName(day), c = await privateStorageConfig(store, env);
  try {
    const names = await list(c);
    let size, created = false;
    if (!names.includes(name)) {
      const bytes = await exportBackup(store, c.key);
      if (c.local) created = await atomicCreate(join(c.root, name), bytes);
      else {
        // Single scheduled writer. Concurrent attempts for the same day may both upload
        // complete snapshots. S3 publishes objects atomically; never delete a current day.
        await c.client.send(new c.s3.PutObjectCommand({ Bucket: c.bucket, Key: prefix + name, Body: bytes, ContentType: 'application/octet-stream' }));
        created = true;
      }
      size = bytes.length;
    }
    // Do not rotate if the projected new object was lost or cannot be read back.
    if (c.local) size = (await stat(join(c.root, name))).size;
    else {
      const object = await c.client.send(new c.s3.HeadObjectCommand({ Bucket: c.bucket, Key: prefix + name }));
      if (!object.ContentLength || (size && size !== object.ContentLength)) throw new Error('No se pudo verificar el tamaño de la copia.');
      size = object.ContentLength;
    }
    if(!Number.isSafeInteger(size)||size<53||size>BACKUP_FILE_BYTES)throw new Error('El tamaño del respaldo no permite restaurarlo. Se conservan las copias anteriores.');
    for (const expired of expiredBackups([...names, name])) {
      if (c.local) await unlink(join(c.root, expired)).catch(e => { if (e.code !== 'ENOENT') throw e; });
      else await c.client.send(new c.s3.DeleteObjectCommand({ Bucket: c.bucket, Key: prefix + expired }));
    }
    return { name, created, bytes: size, destination: c.local ? 'disco local' : 'bucket privado' };
  } finally { c.client?.destroy(); }
}

export async function loadDailyBackup(store, day, env = process.env) {
  const name = backupName(day), c = await privateStorageConfig(store, env);
  try {
    let stream;
    if (c.local) stream=createReadStream(join(c.root,name));
    else {
      const object = await c.client.send(new c.s3.GetObjectCommand({ Bucket: c.bucket, Key: prefix + name }));
      if (object.ContentLength > BACKUP_FILE_BYTES) { object.Body.destroy(); throw new Error('El respaldo excede el límite del piloto.'); }
      stream=object.Body;
    }
    const chunks=[];let size=0;
    for await(const part of stream){
      size+=part.length;
      if(size>BACKUP_FILE_BYTES)throw new Error('El respaldo excede el límite del piloto.');
      chunks.push(part);
    }
    return await restoreBackup(store, Buffer.concat(chunks,size), c.key);
  } finally { c.client?.destroy(); }
}
