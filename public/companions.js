import {sprite} from './sprite.js';

const kinds={
  hoy:['Lía','Guía del sitio'],
  auditoria:['Mora','Auditoría'],
  keywords:['Miga','Investigación de búsquedas'],
  tareas:['Lino','Taller de contenido'],
  revisiones:['Nilo','Medición'],
  ajustes:['Oliva','Conexiones'],
};
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const animal=(kind,anim='sitting')=>sprite(kinds[kind]?kind:'hoy',anim);
export function companion(kind,{title='',message='',compact=false,loading=false,tone='normal'}={}){
  const known=kinds[kind]?kind:'hoy',[name,work]=kinds[known];
  const safeTone=['normal','warning','success'].includes(tone)?tone:'normal';
  const text=message||title;
  const caption=message?title:'';
  return '<aside class="companion '+(compact?'is-compact ':'')+(loading?'is-loading ':'')+'tone-'+safeTone+'" '+(loading?'role="status"':'aria-label="Consejo de '+name+'"')+'>'+animal(known,loading?'run':'idle')+'<div class="companion-sign"><span class="companion-tag">'+name+' · '+work+'</span>'+(caption?'<strong>'+escape(caption)+'</strong>':'')+(text?'<p>'+escape(text)+'</p>':'')+(loading?'<i class="companion-progress" aria-hidden="true"></i>':'')+'</div></aside>';
}
