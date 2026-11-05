import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,syncGsc,propertyOf,verifyProperty} from '../lib/sources.mjs';

const site={url:'https://shop.example.org/catalogo/',country:'CL',gscProperty:'sc-domain:example.org'};
test('CSV mantiene valores desconocidos, detecta idioma y limita las páginas al sitio',()=>{
  const [dated,plain]=parseCsv('Consulta;Página;Fecha;Impresiones;Clics;Posición media\nmesa;'+site.url+'mesa;2026-02-28;25;3;7,5\nmesa plegable;;;;;',site);
  assert.equal(dated.position,7.5);assert.equal(plain.impressions,null);assert.equal(plain.observed,false);
  for(const value of ['https://shop.example.org/catalogos','https://x@shop.example.org/catalogo/x','http://shop.example.org/catalogo/'])assert.throws(()=>parseCsv('Query,URL\nx,'+value,site));
  assert.throws(()=>parseCsv('Consulta;Fecha\nmesa;2026-02-30',site));
});

test('propiedad padre o prefijo válido exige comprobación de permisos exactos',async()=>{
  assert.equal(propertyOf(site.url,site.gscProperty),site.gscProperty);
  assert.equal(propertyOf(site.url,'https://shop.example.org/'),'https://shop.example.org/');
  assert.throws(()=>propertyOf(site.url,'sc-domain:xample.org'));
  const verify=permissionLevel=>verifyProperty(site,{token:async()=>'unit',request:async()=>Response.json({siteUrl:site.gscProperty,permissionLevel})});
  assert.equal(await verify('siteRestrictedUser'),site.gscProperty);
  await assert.rejects(verify('siteUnverifiedUser'));
});

test('GSC usa fecha Pacífico al cambiar de año y filtra totales y detalle al prefijo',async()=>{
  const bodies=[];
  const r={keys:['mesa',site.url+'mesas','chl','MOBILE'],clicks:1,impressions:4,position:10};
  const request=async(url,options)=>{
    const b=JSON.parse(options.body);bodies.push(b);
    return Response.json({rows:b.dimensions.includes('query')?[r,{...r,keys:['foo','https://shop.example.org/catalogos','chl','MOBILE']}]:[{keys:['2025-12-30'],clicks:12,impressions:29,position:9}]});
  };
  const result=await syncGsc(site,{now:new Date('2026-01-01T04:00:00Z'),token:async()=>'unit',request});
  assert.equal(result.end,'2025-12-30');assert.equal(result.start,'2025-12-03');
  assert.equal(result.rows.length,1);assert.equal(result.totals[0].clicks,12);
  for(const b of bodies){
    const exp=new RegExp(b.dimensionFilterGroups[0].filters[0].expression);
    assert.ok(exp.test(site.url+'mesa'));
    assert.equal(exp.test(site.url.replace('shop.','other.')),false);
    assert.equal(exp.test(site.url.replace('catalogo/','catalogos')),false);
    assert.equal(b.dataState,'final');
  }
});

test('GSC declara truncamiento con fila centinela, sin sumar filas al total independiente',async()=>{
  const row={keys:['a',site.url+'s','chl','MOBILE'],clicks:1,impressions:3,position:2};
  const out=await syncGsc(site,{now:new Date('2026-05-05T12:00:00Z'),token:async()=>'unit',request:async(url,{body})=>{
    const b=JSON.parse(body);
    return Response.json({rows:b.dimensions.length===1?[{keys:['2026-05-01'],clicks:700,impressions:1500,position:3}]:Array.from({length:501},(_,i)=>({...row,keys:['a'+i,...row.keys.slice(1)]}))});
  }});
  assert.equal(out.rows.length,500);assert.deepEqual(out.capped,['2026-05-01']);assert.equal(out.totals[0].clicks,700);
});
