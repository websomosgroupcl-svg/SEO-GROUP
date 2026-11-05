import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {extractPage} from '../lib/crawl.mjs';

test('reconstruye líneas y bloques del encabezado, el extracto y el enlace sin separar fragmentos inline',()=>{
  const html='<main><h1>Recupera la calma<br><em style="font-style:normal;color:#4BB137">que te quitaron</em><br>las cuotas</h1>'
    +'<h2><span style="display:block">Sin deudas</span><span style="display:block">por adelantado</span></h2>'
    +'<p>Aprende a re<strong>nego</strong>ciar<br>tu deuda.</p>'
    +'<a href="/ayuda"><div>Pide</div><div>ayu<span>da</span>.</div></a></main>';
  const p=extractPage(html,'https://fixture.example/');
  assert.equal(p.h1,'Recupera la calma que te quitaron las cuotas');
  assert.deepEqual(p.h2,['Sin deudas por adelantado']);
  assert.deepEqual(p.headings,[{level:1,text:p.h1},{level:2,text:p.h2[0]}]);
  assert.deepEqual(p.keywordExcerpts,['Aprende a renegociar tu deuda.']);
  assert.equal(p.outgoing[0].anchor,'Pide ayuda.');
  assert.equal(p.wordCount,19);
  // The monitor compared this pre-existing source-text signature before the extraction fix.
  const legacy='Recupera la calmaque te quitaronlas cuotasSin deudaspor adelantadoAprende a renegociartu deuda.Pideayuda.';
  assert.equal(p.contentHash,createHash('sha256').update(legacy).digest('hex'));
});
