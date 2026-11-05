import {timingSafeEqual} from 'node:crypto';
import {openStore} from './store.mjs';
import {bootstrap} from './api.mjs';
import {withHostedGoogle} from './google-hosted.mjs';
let active;
export function database(){
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL es obligatorio en Netlify.');
  if(!active)active=openStore().then(async store=>{await bootstrap(store);return store;}).catch(e=>{active=null;throw e;});
  return active;
}
export function workerAllowed(req){
  const token=process.env.SEO_WORKER_TOKEN||'';
  const actual=Buffer.from(req.headers.get('authorization')||'');
  const expected=Buffer.from('Bearer '+token);
  return token.length>=32 && actual.length===expected.length && timingSafeEqual(actual,expected);
}
export async function withGoogleDatabase(work){
  const store=await database();
  return withHostedGoogle(store,googleManager=>work(store,googleManager));
}
export async function wakeWorker(){
  const base=process.env.URL;
  if(!base||!process.env.SEO_WORKER_TOKEN||process.env.SEO_WORKER_TOKEN.length<32)throw Error('Falta configuración de worker.');
  const res=await fetch(new URL('/.netlify/functions/review-background',base),{method:'POST',redirect:'error',headers:{authorization:'Bearer '+process.env.SEO_WORKER_TOKEN},signal:AbortSignal.timeout(8000)});
  if(res.status!==202)throw Error('El ejecutor no recibió el trabajo.');
}

