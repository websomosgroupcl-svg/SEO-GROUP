import {createHash,createCipheriv,createDecipheriv,randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {gzip,gunzip} from 'node:zlib';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {privateStorageConfig} from './backup.mjs';
import {shiftDay,validDay,problem} from './sources.mjs';

const zip=promisify(gzip), unzip=promisify(gunzip), derive=promisify(scrypt);
const cap=50000, batchBytes=512*1024, magic=Buffer.from('GSCARC01');
const hash=data=>createHash('sha256').update(data).digest('hex');

export function mergeSearchRows(site,gsc){
  const replacing=new Set(gsc.totals.map(r=>r.date));
  return site.rows.filter(r=>r.source!=='Search Console'||!replacing.has(r.date)).concat(gsc.rows);
}

// Keep all evidence from the working window and existing tasks, even if a site stays over capacity.
function removable(site,today){
  const cutoff=shiftDay(today,-90), windows=new Map();
  for(const task of site.tasks||[]){
    for(const page of new Set([task.page,task.editorial?.page].filter(Boolean))){
      const intervals=windows.get(page)||[];
      if(validDay(task.appliedAt))intervals.push([shiftDay(task.appliedAt,-28),shiftDay(task.appliedAt,28)]);
      else intervals.push(['','9999']);
      for(const e of task.editorial?.evidence||[])if(e.page===page&&validDay(e.startDate)&&validDay(e.endDate))intervals.push([e.startDate,e.endDate]);
      windows.set(page,intervals);
    }
  }
  return r=>r.source==='Search Console' && validDay(r.date) && r.date<cutoff && r.final!==false && r.isFinal!==false && !r.preliminary &&
    !(windows.get(r.page)||[]).some(([a,b])=>r.date>=a&&r.date<=b);
}

export function planArchive(site,gsc,today,limit=cap){
  const rows=mergeSearchRows(site,gsc);
  if(rows.length<=limit)return [];
  const eligible=rows.filter(removable(site,today)).sort((a,b)=>a.date.localeCompare(b.date));
  if(eligible.length<rows.length-limit)return [];
  const selected=eligible.slice(0,Math.min(eligible.length,rows.length-limit+Math.min(1000,Math.ceil(limit*.02))));
  const batches=[]; let batch=[],size=0;
  for(const row of selected){
    const bytes=Buffer.byteLength(JSON.stringify(row))+1;
    if(bytes>batchBytes-1024)continue;
    if(size+bytes>batchBytes-1024){batches.push(batch);batch=[];size=0;}
    batch.push(row);size+=bytes;
  }
  if(batch.length)batches.push(batch);
  return batches;
}

async function privateBlob(c,object,bytes){
  if(c.local){
    const dir=join(c.root,'gsc');
    if(bytes){await mkdir(dir,{recursive:true,mode:0o700});await writeFile(join(dir,object),bytes,{mode:0o600,flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});}
    return readFile(join(dir,object));
  }
  const params={Bucket:c.bucket,Key:'seobestia-gsc/'+object};
  if(bytes)await c.client.send(new c.s3.PutObjectCommand({...params,Body:bytes,ContentType:'application/octet-stream'}));
  const result=await c.client.send(new c.s3.GetObjectCommand(params));
  if(result.ContentLength>batchBytes+8192){result.Body.destroy();throw Error('Archivo demasiado grande.');}
  return Buffer.from(await result.Body.transformToByteArray());
}

async function unpack(c,blob,id,siteId){
  if(!blob.subarray(0,8).equals(magic)||blob.length<52)throw Error('Formato de archivo inválido.');
  const key=await derive(c.key,blob.subarray(8,24),32);
  const dec=createDecipheriv('aes-256-gcm',key,blob.subarray(24,36));
  dec.setAAD(Buffer.from(id));dec.setAuthTag(blob.subarray(36,52));
  const raw=await unzip(Buffer.concat([dec.update(blob.subarray(52)),dec.final()]),{maxOutputLength:batchBytes});
  if(hash(raw)!==id)throw Error('Archivo incompleto.');
  const archive=JSON.parse(raw.toString());
  if(archive.siteId!==siteId||!Array.isArray(archive.rows)||archive.format!==1)throw Error('Archivo ajeno o inválido.');
  return archive;
}

export async function saveGscArchive(store,siteId,rows,env=process.env){
  const raw=Buffer.from(JSON.stringify({format:1,siteId,rows}));
  if(!rows.length||raw.length>batchBytes)throw Error('Lote fuera del límite del archivo.');
  const id=hash(raw),c=await privateStorageConfig(store,env);
  try{
    if(typeof c.key!=='string'||c.key.length<32)throw Error('Falta la clave del archivo.');
    const salt=randomBytes(16),iv=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',await derive(c.key,salt,32),iv);
    cipher.setAAD(Buffer.from(id));
    const ciphertext=Buffer.concat([cipher.update(await zip(raw)),cipher.final()]);
    const blob=Buffer.concat([magic,salt,iv,cipher.getAuthTag(),ciphertext]);
    // Verify the object by downloading, decrypting and recomputing the content hash before removing any rows.
    await unpack(c,await privateBlob(c,id+'.gsc',blob),id,siteId);
    return {id,count:rows.length,from:rows[0].date,until:rows.at(-1).date,bytes:blob.length};
  }finally{c.client?.destroy();}
}

export async function readGscArchive(store,site,id,env=process.env){
  if(!/^[0-9a-f]{64}$/.test(id)||!site.gscArchives?.some(a=>a.id===id))throw problem('Archivo desconocido.',404);
  const c=await privateStorageConfig(store,env);
  try{return await unpack(c,await privateBlob(c,id+'.gsc'),id,site.id);}
  finally{c.client?.destroy();}
}

// Re-evaluate task protections inside the transaction. New imports or task assignments
// made during the upload cannot cause data loss. Duplicates consume one receipt each.
export function commitSearchRows(site,gsc,verified,today,limit=cap){
  const candidates=mergeSearchRows(site,gsc), eligible=removable(site,today);
  const counts=new Map(),refs=new Map((site.gscArchives||[]).map(a=>[a.id,a]));
  for(const {meta,rows} of verified){
    refs.set(meta.id,meta);
    for(const row of rows){const key=JSON.stringify(row);counts.set(key,(counts.get(key)||0)+1);}
  }
  if(verified.length)site.gscArchives=[...refs.values()];
  const next=candidates.filter(row=>{
    if(!counts.size||!eligible(row))return true;
    const key=JSON.stringify(row), count=counts.get(key)||0;
    if(count===1)counts.delete(key);else if(count)counts.set(key,count-1);
    return !count;
  });
  if(next.length>limit)return false;
  site.rows=next;return true;
}
