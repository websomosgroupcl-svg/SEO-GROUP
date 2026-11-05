const kinds={
  hoy:['guia','Lía','Guía del sitio'],
  auditoria:['buho','Mora','Auditoría'],
  keywords:['explora','Miga','Investigación de búsquedas'],
  tareas:['conejo','Lino','Taller de contenido'],
  revisiones:['mide','Nilo','Medición'],
  ajustes:['tortuga','Oliva','Conexiones'],
};
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function animal(kind,css=''){
  const [name]=kinds[kind]||kinds.hoy;
  return '<svg class="companion-art '+escape(css)+'" aria-hidden="true" focusable="false" viewBox="0 0 180 146"><use href="/fauna.svg#'+name+'"/></svg>';
}
export function companion(kind,{title='',message='',compact=false,loading=false,tone='normal'}={}){
  const [,name,work]=kinds[kind]||kinds.hoy;
  const safeTone=['normal','warning','success'].includes(tone)?tone:'normal';
  const text=message||title;
  const caption=message?title:'';
  return '<aside class="companion companion-'+escape(kinds[kind]?kind:'hoy')+' '+(compact?'is-compact ':'')+(loading?'is-loading ':'')+'tone-'+safeTone+'" '+(loading?'role="status"':'aria-label="Consejo de '+name+'"')+'>'+animal(kind)+'<div class="companion-sign"><span class="companion-tag">'+name+' · '+work+'</span>'+(caption?'<strong>'+escape(caption)+'</strong>':'')+(text?'<p>'+escape(text)+'</p>':'')+(loading?'<i class="companion-progress" aria-hidden="true"></i>':'')+'</div></aside>';
}
