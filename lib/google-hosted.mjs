import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {inGoogleContext,deploymentOwnsGoogle} from './google-context.mjs';
import {normalizeServiceAccount} from './google-local.mjs';
import {problem} from './sources.mjs';

const targets=new Set(['gsc','ga4']);
const aad=target=>Buffer.from('seobestia/google/v1/'+target);
function vaultKey(){
  const value=process.env.SEO_GOOGLE_VAULT_KEY;
  if(!value||[process.env.SEO_BACKUP_KEY,process.env.SEO_WORKER_TOKEN].includes(value))return null;
  if(/^[a-f0-9]{64}$/i.test(value))return Buffer.from(value,'hex');
  if(!/^[A-Za-z0-9+/_-]{43}=?$/.test(value))return null;
  const key=Buffer.from(value,'base64url');
  return key.length===32?key:null;
}
function seal(key,target,plain){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(aad(target));
  const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
  return Buffer.concat([Buffer.from([1]),iv,cipher.getAuthTag(),ciphertext]);
}
function open(key,target,envelope){
  if(!Buffer.isBuffer(envelope)||envelope[0]!==1||envelope.length<30||envelope.length>32768)throw Error();
  const decipher=createDecipheriv('aes-256-gcm',key,envelope.subarray(1,13));
  decipher.setAAD(aad(target));
  decipher.setAuthTag(envelope.subarray(13,29));
  const plain=Buffer.concat([decipher.update(envelope.subarray(29)),decipher.final()]);
  try{
    normalizeServiceAccount(JSON.parse(plain));
    return plain.toString('base64');
  }finally{plain.fill(0);}
}

// Each invocation sees the last committed pair of credentials, including on warm instances.
// Concurrent requests keep their own snapshot until they finish. No vault values enter process.env.
export async function withHostedGoogle(store,work){
  const key=vaultKey();
  if(!key||store.backend!=='postgres')return inGoogleContext({},()=>work(null));
  const records={};
  const writable=target=>targets.has(target)&&!deploymentOwnsGoogle(target);
  try{
    for(const {target,envelope} of await store.readGoogleEnvelopes()){
      if(!writable(target))continue;
      try{records[target]={raw:open(key,target,envelope)};}
      catch{records[target]={invalid:true};}
    }
    const manager={mode:'hosted',writable,async save(target,credential){
      if(!targets.has(target))throw problem('Elige una fuente de Google válida.');
      if(!writable(target))throw problem('Esta fuente ya se configura con una variable privada del servidor.',409);
      const plain=Buffer.from(JSON.stringify(normalizeServiceAccount(credential)));
      try{
        await store.saveGoogleEnvelope(target,seal(key,target,plain));
        records[target]={raw:plain.toString('base64')};
      }finally{plain.fill(0);}
    }};
    return await inGoogleContext(records,()=>work(manager));
  }finally{key.fill(0);}
}
