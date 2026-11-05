import {spawn} from 'node:child_process';
import {createHash,createPrivateKey,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {problem} from './sources.mjs';
import {googleAccount} from './google-context.mjs';

const variables={gsc:'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64',ga4:'GA4_SERVICE_ACCOUNT_JSON_BASE64'};
const identifier=/^[\w.+-]+@[\w.-]+\.gserviceaccount\.com$/;
export function normalizeServiceAccount(value){
  if(!value||value.type!=='service_account'||!identifier.test(String(value.client_email))||
     typeof value.private_key!=='string'||value.private_key.length>16000)throw problem('El archivo debe ser una clave JSON de cuenta de servicio de Google.');
  try{if(createPrivateKey(value.private_key).asymmetricKeyType!=='rsa')throw Error();}
  catch{throw problem('El archivo no contiene una clave RSA válida. Descarga una clave JSON desde Google Cloud.');}
  return {type:'service_account',client_email:value.client_email,private_key:value.private_key};
}
function identity(raw){
  try{return normalizeServiceAccount(JSON.parse(Buffer.from(raw,'base64').toString('utf8'))).client_email;}
  catch{return null;}
}
export function prepStatus(manager){
  function source(target){
    const {raw,invalid}=googleAccount(target);
    const email=raw?identity(raw):null;
    return {configured:Boolean(email),email,canUpload:Boolean(manager?.writable(target)),invalid:Boolean(invalid||raw&&!email)};
  }
  return {gsc:source('gsc'),ga4:source('ga4'),canUpload:Boolean(manager)};
}
function dpapi(operation,input){
  const method=operation==='seal'?'Protect':'Unprotect';
  const script="$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[System.Security.Cryptography.ProtectedData]::"+method+"($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))";
  return new Promise((ok,fail)=>{
    const child=spawn(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','ignore'],signal:AbortSignal.timeout(15000)});
    const chunks=[];
    child.stdout.on('data',c=>chunks.push(c));
    child.stdin.on('error',()=>{});
    child.on('error',()=>fail(problem('Windows no pudo acceder al almacén protegido de esta cuenta.',503)));
    child.on('close',code=>code===0?ok(Buffer.from(Buffer.concat(chunks).toString().trim(),'base64')):fail(problem('Windows no pudo proteger o abrir la credencial.',503)));
    child.stdin.end(input.toString('base64'));
  });
}
export async function openLocalGoogle(store){
  if(process.platform!=='win32'||store.backend!=='sqlite'||!process.env.LOCALAPPDATA)return null;
  const original={...Object.fromEntries(Object.entries(variables).map(([k,v])=>[k,Boolean(process.env[v])]))};
  const scope=createHash('sha256').update(resolve(process.env.SEO_DB_PATH||'.local/seobestia.sqlite')).digest('hex').slice(0,24);
  const dir=join(process.env.LOCALAPPDATA,'SEOBESTIA','conexiones',scope);
  const file=t=>join(dir,t+'.dpapi');
  for(const target of Object.keys(variables)){
    if(original[target])continue;
    try{
      const sealed=await readFile(file(target));
      const decoded=await dpapi('open',sealed);
      normalizeServiceAccount(JSON.parse(decoded));
      process.env[variables[target]]=decoded.toString('base64');
    }catch(e){if(e.code!=='ENOENT')console.error('No se pudo abrir la credencial local de '+target+'.');}
  }
  let pending=false;
  return {writable:target=>Object.hasOwn(variables,target)&&!original[target],async save(target,raw){
    if(!this.writable(target))throw problem('Esta fuente se configura desde el entorno del servidor.',409);
    if(pending)throw problem('Otra credencial se está guardando. Vuelve a intentarlo.',409);
    const bytes=Buffer.from(JSON.stringify(normalizeServiceAccount(raw)));
    const temp=file(target)+'.'+randomUUID()+'.tmp';
    pending=true;
    try{
      const sealed=await dpapi('seal',bytes);
      await mkdir(dir,{recursive:true,mode:0o700});
      await writeFile(temp,sealed,{mode:0o600,flag:'wx'});
      await rename(temp,file(target));
      process.env[variables[target]]=bytes.toString('base64');
    }finally{pending=false;bytes.fill(0);await unlink(temp).catch(()=>{});}
  }};
}

