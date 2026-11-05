import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePersonalIdeas,PersonalIdeasError} from '../lib/ideas-ia.mjs';

const apiKey='credencial-ficticia-de-prueba';
const site={ url:'https://ejemplo-privado.cl', businessGoal:'NO ENVIAR SITIO', users:['cuenta privada'] };
const ideas=['id-observado-privado','otro-id-privado'].map((id,i)=>({
  id,keyword:i?'escritorio angosto':'mesa https://secreto.cl/catalogo 1200',objective:'Contactos en ventas@secreto.cl',
  action:'Mejorar guía',evidence:[{impressions:9024891}],page:site.url,longTail:[{keyword:'mesa de madera',source:'privado'}],
}));
const responseItems=[
  {id:'B',title:'Un escritorio para una habitación estrecha',angle:'Ayudar a decidir cómo medir el espacio.',outline:['Medir el ancho','Comparar la profundidad']},
  {id:'A',title:'Cómo elegir una mesa',angle:'Ayudar a decidir según el uso.',outline:['Elegir una superficie','Comprobar las medidas']},
];
const wrap=(provider,raw)=>{
  const text=typeof raw==='string'?raw:JSON.stringify(raw);
  if(provider==='openai')return {status:'completed',output:[{role:'assistant',type:'message',content:[{type:'output_text',text}]}]};
  if(provider==='anthropic')return {stop_reason:'end_turn',content:[{type:'text',text}]};
  return {candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'ignorar'},{text}]}}]};
};
const call=(provider,request,custom={})=>generatePersonalIdeas({site,ideas,provider,apiKey,request,...custom});

for (const [provider,host,auth] of [
  ['openai','api.openai.com','Authorization'], ['anthropic','api.anthropic.com','x-api-key'],
  ['gemini','generativelanguage.googleapis.com','x-goog-api-key'],
]) test('envío mínimo y asociación por identificador para '+provider,async()=>{
  let calls=0;
  const data=await call(provider,async(url,options)=>{
    calls++;
    assert.equal(new URL(url).hostname,host); assert.equal(new URL(url).search,'');
    assert.equal(options.redirect,'error'); assert.ok(options.signal);
    assert.ok(options.headers[auth].includes(apiKey));
    const body=JSON.parse(options.body);
    if(provider==='openai'){assert.equal(body.store,false);assert.equal(body.text.format.strict,true);}
    if(provider==='anthropic'){assert.ok(body.output_config.format.schema);}
    if(provider==='gemini'){assert.ok(body.generationConfig.responseJsonSchema);}
    const input=JSON.parse(body.input ?? body.messages?.[0].content ?? body.contents[0].parts[0].text);
    assert.equal(input[0].id,'A');assert.equal(input[0].keyword,'mesa 1200');assert.equal(input[1].id,'B');
    assert.ok(input[0].variants.includes('mesa de madera'));
    for (const privateText of [apiKey,'9024891','secreto.cl','privado','NO ENVIAR SITIO']) assert.ok(!options.body.includes(privateText));
    return Response.json(wrap(provider,{ideas:responseItems}));
  });
  assert.equal(calls,1);assert.deepEqual(data.map(x=>x.id),ideas.map(x=>x.id));
  assert.equal(data[0].title,responseItems[1].title);assert.equal(data[0].provider,provider);
  assert.ok(data.every(x=>x.model && x.outline.length===2));
});

test('solo admite proveedor fijo y hasta cinco IDs únicos antes de hacer una solicitud',async()=>{
  let reached=false;const request=()=>{reached=true;};
  for(const x of [{provider:'https://atacante.cl'},{provider:'constructor'},{ideas:[ideas[0],ideas[0]]},{ideas:Array(6).fill(ideas[0])},{apiKey:'clave\nmaliciosa'}])
    await assert.rejects(call('openai',request,x),PersonalIdeasError);
  assert.equal(reached,false);
});

test('descarta IDs ajenos o repetidos, métricas, HTML y eco de una clave',async()=>{
  for(const [field,value] of [['id','X'],['id','A'],['angle','Gana 2500 clics.'],['title','<img src=x onerror=alert(1)>'],['outline',['Usa '+apiKey,'Otra cosa']],['angle','Consulta https://privado.cl']]){
    const bad=responseItems.map((x,i)=>i===0?{...x,[field]:value}:x);
    await assert.rejects(call('gemini',async()=>Response.json(wrap('gemini',{ideas:bad}))),e=>e.status===502 && !e.message.includes(apiKey));
  }
});

test('descarta rechazos, JSON incompleto y respuestas excesivas de un proveedor',async()=>{
  const bad=[
    Response.json({status:'incomplete',output:[]}),
    Response.json(wrap('openai','{ideas:')),
    Response.json(wrap('openai',{ideas:[]})),
    new Response('x'.repeat(68000)),new Response('x',{headers:{'content-length':'90000'}}),
  ];
  for(const r of bad)await assert.rejects(call('openai',async()=>r),e=>e instanceof PersonalIdeasError && e.status===502);
});

test('presenta errores de cuota, clave, conexión y plazo sin texto sensible ni reintentos',async()=>{
  for(const [status,publicStatus] of [[401,422],[403,422],[429,429],[402,429],[400,422],[503,502],[504,504]]){
    let count=0;
    await assert.rejects(call('anthropic',async()=>{count++;return new Response('NO DIVULGAR '+apiKey,{status});}),
      e=>e.status===publicStatus && !e.message.includes(apiKey) && !e.message.includes('DIVULGAR'));
    assert.equal(count,1);
  }
  await assert.rejects(call('gemini',async()=>{throw new DOMException(apiKey,'TimeoutError');}),e=>e.status===504&&!e.message.includes(apiKey));
  await assert.rejects(call('gemini',async()=>{throw new Error(apiKey);}),e=>e.status===502&&!e.message.includes(apiKey));
});
