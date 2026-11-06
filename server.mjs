import {createServer} from 'node:http';
import {readdir,readFile} from 'node:fs/promises';
import {openStore} from './lib/store.mjs';
import {bootstrap,handle} from './lib/api.mjs';
import {openLocalGoogle} from './lib/google-local.mjs';
import {runNext,schedule} from './lib/reviews.mjs';

const port=Number(process.env.PORT || 4173), store=await openStore();
await bootstrap(store,{local:true});
const googleManager=await openLocalGoogle(store);
let running=null;
function wake(){
  if(!running)running=(async()=>{while(await runNext(store)){} })().catch(e=>console.error('Revisión local:',e.message)).finally(()=>running=null);
  return Promise.resolve();
}
async function tick(){await store.mutate(s=>schedule(s),{keys:['sites','jobs'],siteSummary:true});await wake();}
const assets={'/':'index.html','/index.html':'index.html','/app.css':'app.css','/app.js':'app.js','/isotipo.svg':'isotipo.svg'};
for(const name of ['keywords.css','medir.css','medir.js','inspector.js','redaccion.js','taller.css','companions.js','sprite.js','mi-ia.js','mascota.js','mascota.css']) assets['/'+name]=name;
for(const name of ['BricolageGrotesque-Bold.ttf','WorkSans-Variable.ttf','BricolageGrotesque-OFL.txt','WorkSans-OFL.txt']) {
  assets['/fonts/'+name]='fonts/'+name;
}
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',png:'image/png',ttf:'font/ttf',txt:'text/plain; charset=utf-8',cmd:'application/octet-stream'};
for(const name of ['estadistica-ui.js','estadistica.css'])assets['/'+name]=name;
for(const name of ['diagnostico.js','diagnostico.css','conexiones.js','conexiones.css','conexion-gsc.svg','conexion-ga4.svg','conexion-cuenta.svg','graficos.js','graficos.css','equipo.js','equipo.css','preparar-seobestia.cmd'])assets['/'+name]=name;
for(const name of await readdir(new URL('./public/sprites/',import.meta.url),{recursive:true})){
  const file=name.replaceAll('\\','/');
  if(/\.(png|txt)$/.test(file))assets['/sprites/'+file]='sprites/'+file;
}
const server=createServer(async(req,res)=>{
  try {
    const host=req.headers.host||'';
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){res.writeHead(403).end();return;}
    const url=new URL(req.url,'http://'+host);
    if(url.pathname.startsWith('/api/')) {
      const chunks=[];let size=0;
      for await(const c of req){size+=c.length;if(size>2000000){res.writeHead(413).end();return;}chunks.push(c);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
      const r=await handle(request,{store,local:true,ip:req.socket.remoteAddress,wake,googleManager});
      res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
    }
    const asset=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:null;
    if(!asset||!['GET','HEAD'].includes(req.method)){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[asset.split('.').at(-1)],'X-Content-Type-Options':'nosniff','Cache-Control':/^(fonts|sprites)\//.test(asset)?'public, max-age=604800':'no-cache','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
    res.end(req.method==='HEAD'?'':await readFile(new URL('./public/'+asset,import.meta.url)));
  } catch(e){console.error('Petición local:',e.message);if(!res.headersSent)res.writeHead(500);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log('SEOBESTIA disponible en http://127.0.0.1:'+port));
await tick();
const timer=setInterval(()=>tick().catch(e=>console.error('Planificador:',e.message)),60*60*1000);
process.on('SIGTERM',()=>{clearInterval(timer);server.close(async()=>{await running;await store.close();});});

