import test from 'node:test';
import assert from 'node:assert/strict';
import {creditMascota} from '../public/mascota.js';

test('cada hito se acredita una vez por cuenta, sitio y tarea',()=>{
  const event={userId:'member-a',siteId:'site-a',taskId:'task-1',milestone:'registrada'};
  assert.equal(creditMascota(event),true);
  assert.equal(creditMascota(event),false);
  for(const field of [{siteId:'site-b'},{userId:'member-b'},{taskId:'task-2'},{milestone:'aplicada'},{milestone:'cerrada'}]){
    assert.equal(creditMascota({...event,...field}),true);
    assert.equal(creditMascota({...event,...field}),false);
  }
});

test('abrir o ver una tarea y los eventos sin identificadores válidos no suman',()=>{
  const event={userId:'member-c',siteId:'site-c',taskId:'task-3',milestone:'cerrada'};
  for(const field of [{userId:''},{siteId:null},{taskId:'https://privado.example/'},{userId:'email@cuenta.example'},{milestone:'vista'},{milestone:'constructor'}]){
    assert.equal(creditMascota({...event,...field}),false);
  }
  assert.equal(creditMascota(),false);
});
