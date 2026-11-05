import {createHash,createCipheriv,createDecipheriv,hkdfSync,randomBytes,randomUUID} from 'node:crypto';
import {problem} from './sources.mjs';

const providers=new Set(['openai','anthropic','gemini']);
const selected={keys:['sessions']};

function sessionOf(state,user,token){
  const hash=createHash('sha256').update(token).digest('hex');
  const session=state.sessions.find(s=>s.userId===user.id&&s.tokenHash===hash&&Date.parse(s.expiresAt)>Date.now());
  if(!session)throw problem('Vuelve a iniciar sesión.',401);
  return session;
}

// A database dump contains only the token hash. The separate, random HttpOnly
// session token is required to derive the key and is never stored in the DB.
const wrappingKey=(token,userId)=>hkdfSync('sha256',token,userId,'seobestia/editorial-session/v1',32);
function seal(key,provider,token,userId){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',wrappingKey(token,userId),iv);
  cipher.setAAD(Buffer.from(provider));
  const ciphertext=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
  return {provider,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
}
function unseal(value,token,userId){
  try{
    const cipher=createDecipheriv('aes-256-gcm',wrappingKey(token,userId),Buffer.from(value.iv,'base64'));
    cipher.setAAD(Buffer.from(value.provider));
    cipher.setAuthTag(Buffer.from(value.tag,'base64'));
    return Buffer.concat([cipher.update(Buffer.from(value.ciphertext,'base64')),cipher.final()]).toString('utf8');
  }catch{throw problem('Vuelve a introducir tu clave en Mi IA.',409);}
}
export async function personalKey(store,user,token,method,data){
  const status=s=>({provider:s.ideaCredential?.provider||null,configured:Boolean(s.ideaCredential)});
  if(method==='GET')return status(sessionOf(await store.read(selected),user,token));
  if(!['PUT','DELETE'].includes(method))throw problem('Método no disponible.',405);
  if(data.userId!==user.id)throw problem('La cuenta ha cambiado. Recarga antes de configurar tu IA.',409);
  return store.mutate(state=>{
    const session=sessionOf(state,user,token);
    if(method==='DELETE'){delete session.ideaCredential;}
    else{
      const {apiKey,provider}=data;
      if(!providers.has(provider)||typeof apiKey!=='string'||!/^[\x21-\x7e]{12,512}$/.test(apiKey))throw problem('Elige un proveedor e introduce una clave API válida.');
      session.ideaCredential=seal(apiKey,provider,token,user.id);
    }
    return status(session);
  },selected);
}

export async function requestEditorialDrafts({store,user,token,site,ideas,provider,generate}){
  if(!ideas.length)throw problem('Primero hacen falta búsquedas con evidencia para generar ideas.',409);
  const operation=randomUUID();
  const credential=await store.mutate(state=>{
    const session=sessionOf(state,user,token),now=Date.now();
    if(!session.ideaCredential||session.ideaCredential.provider!==provider)throw problem('Configura o revisa el proveedor en Mi IA antes de generar ideas.',409);
    const attempts=(session.ideaAttempts||[]).filter(when=>when>now-600000);
    if(session.ideaJob?.until>now||attempts.length>=6)throw problem('Ya hay una generación en curso o se alcanzó el límite de seis solicitudes en diez minutos.',429);
    session.ideaAttempts=[...attempts,now];session.ideaJob={id:operation,until:now+120000};
    return session.ideaCredential;
  },selected);
  try{
    const drafts=await generate({ideas,provider,apiKey:unseal(credential,token,user.id)});
    return await store.mutate(state=>{
      const session=sessionOf(state,user,token),now=Date.now();
      if(session.ideaJob?.id!==operation||session.ideaCredential?.tag!==credential.tag)throw problem('Tu conexión de IA cambió durante la generación. Vuelve a intentarlo.',409);
      const records=drafts.map(d=>({...d,draftId:randomUUID(),siteId:site.id,expires:now+3600000}));
      session.ideaDrafts=[...(session.ideaDrafts||[]).filter(d=>d.expires>now),...records].slice(-30);
      delete session.ideaJob;
      return records.map(({siteId,expires,...draft})=>draft);
    },selected);
  }catch(error){
    await store.mutate(state=>{
      const session=state.sessions.find(s=>s.userId===user.id&&s.ideaJob?.id===operation);
      if(session)delete session.ideaJob;
    },selected);
    throw error;
  }
}
export function findDraft(state,user,token,siteId,input){
  if(!input.draftId)return null;
  const draft=(sessionOf(state,user,token).ideaDrafts||[]).find(d=>d.draftId===input.draftId&&d.siteId===siteId&&d.id===input.editorialId&&d.expires>Date.now());
  if(!draft)throw problem('Ese borrador personal ya no está disponible. Vuelve a generar la propuesta.',409);
  return draft;
}

