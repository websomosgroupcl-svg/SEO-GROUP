import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identifyStream,liveAnalytics,historicalAnalytics,metricsInput} from '../lib/analytics.mjs';
import {makeDemo,siteOpportunities} from '../lib/site.mjs';
const json=body=>Response.json(body);
const site={url:'https://tienda.example/',id:'analytics-test',ga4PropertyId:'12345',ga4StreamId:'6789'};
const token=async()=>'mock';
test('solo vincula el único flujo web autorizado del dominio',async()=>{
 const stream={type:'WEB_DATA_STREAM',webStreamData:{defaultUri:site.url},name:'properties/12345/dataStreams/6789'};
 const opts={token,request:async()=>json({dataStreams:[stream]})};
 assert.deepEqual(await identifyStream(site,'12345',opts),{ga4PropertyId:'12345',ga4StreamId:'6789'});
 await assert.rejects(identifyStream({...site,url:'https://cliente.example/'},'12345',opts));
 await assert.rejects(identifyStream({...site,url:site.url+'cliente/'},'12345',opts));
 await assert.rejects(identifyStream(site,'12345',{token,request:async()=>json({dataStreams:[stream,stream]})}));
});
test('la vinculación delegada comprueba el origen y la raíz después de descartar dominios ambiguos',async()=>{
 const stream=(uri,name='properties/12345/dataStreams/6789')=>({type:'WEB_DATA_STREAM',name,webStreamData:{defaultUri:uri}});
 const check=(entries,more={})=>identifyStream(site,'12345',{strictOrigin:true,token,request:async()=>json({dataStreams:entries,...more})});
 assert.equal((await check([stream('https://tienda.example:443')])).ga4StreamId,'6789');
 for(const uri of ['http://tienda.example','https://tienda.example:8443','https://tienda.example/otra/','https://lector:secreto@tienda.example/','https://tienda.example/?pagina=2','https://tienda.example/#ancla']){
   await assert.rejects(check([stream(uri)]),/raíz exacta/);
 }
 await assert.rejects(check([stream(site.url),stream(site.url+'otra/')]),/único flujo/);
 await assert.rejects(check([stream(site.url)],{nextPageToken:'siguiente'}),/único flujo/);
 for(const name of ['properties/999/dataStreams/6789','otro/6789','properties/12345/dataStreams/00','properties/12345/dataStreams/6789/extra',null]){
   await assert.rejects(check([stream(site.url,name)]),/propiedad solicitada/);
 }
});
test('tiempo real deduplica lecturas simultáneas y usa usuarios únicos del informe completo',async()=>{
 let calls=0;
 const opts={token,request:async(url,init)=>{
   calls++;const b=JSON.parse(init.body);assert.ok(url.endsWith('12345:runRealtimeReport'));assert.equal(b.dimensionFilter.filter.stringFilter.value,'6789');
   return json(b.dimensions?{rows:[{dimensionValues:[{value:'5'}],metricValues:[{value:'18'}]}]}:{rows:[{metricValues:[{value:'9'},{value:'22'},{value:'2'}]}]});
 }};
 const [a,b]=await Promise.all([liveAnalytics(site,opts),liveAnalytics(site,opts)]);
 assert.equal(calls,2);assert.equal(a.status,'live');assert.equal(a.activeUsers,9);assert.equal(a.views,22);assert.equal(b.series.find(x=>x.minutesAgo===5).views,18);
 const restricted=await liveAnalytics({...site,ga4LiveReviewRequired:true},opts);
 assert.equal(restricted.status,'unavailable');assert.equal(restricted.activeUsers,null);assert.equal(restricted.views,null);assert.equal(restricted.keyEvents,null);assert.deepEqual(restricted.series,[]);
 assert.match(restricted.message,/administrador/);assert.equal(calls,2);
 assert.equal((await liveAnalytics({})).views,null);
 const down=await liveAnalytics({...site,id:'other-site'},{token,request:async()=>new Response('',{status:429})});
 assert.equal(down.status,'unavailable');assert.equal(down.activeUsers,null);
});
test('histórico distingue sesiones, personas activas diarias y eventos por destino',async()=>{
 const response=(dims,vs)=>({dimensionValues:[{value:dims}],metricValues:vs.map(value=>({value:String(value)}))});
 const data=await historicalAnalytics(site,{token,now:new Date('2026-11-04T14:00:00Z'),request:async(url,init)=>{
   const q=JSON.parse(init.body);
   assert.deepEqual(q.dimensionFilter.andGroup.expressions.slice(0,2).map(e=>[e.filter.fieldName,e.filter.stringFilter.matchType,e.filter.stringFilter.value]),[['streamId','EXACT','6789'],['hostName','EXACT','tienda.example']]);
   if(q.dimensions[1]?.name==='sessionSource'){
     assert.match('chatgpt.com',new RegExp(q.dimensionFilter.andGroup.expressions[2].filter.stringFilter.value));
     return json({rows:[{dimensionValues:[{value:'20261102'},{value:'chatgpt.com'}],metricValues:[{value:'7'}]}]});
   }
   return json({rows:q.dimensions[0].name==='date'?[response('20261102',[24,18,3])]:[response('/muebles',[140,12])],metadata:{timeZone:'America/Santiago'}});
 }});
 assert.deepEqual(data.analyticsDays,[{date:'2026-11-02',sessions:24,activeUsers:18,keyEvents:3}]);
 assert.deepEqual(data.ga4AiDays,[{date:'2026-11-02',source:'chatgpt.com',sessions:7}]);
 assert.equal(data.ga4Landing[0].endDate,'2026-11-03');assert.equal(data.ga4Landing[0].keyEvents,12);
});
test('sugerencia comercial cita búsqueda semilla y distingue hipótesis de medición',()=>{
 const demo=makeDemo({id:'u'});demo.businessGoal='Solicitudes de cotización';
 const list=siteOpportunities(demo);
 const idea=list.find(o=>o.source==='Propuesta desde consultas observadas');
 assert.ok(idea?.evidence.seed);assert.equal(idea.goal,demo.businessGoal);assert.equal(idea.impressions,null);assert.equal(idea.volume,null);
 assert.ok(list.some(o=>o.inContent&&o.contentEvidence?.url));assert.equal(metricsInput({demo:false}).analyticsDays,undefined);
});

