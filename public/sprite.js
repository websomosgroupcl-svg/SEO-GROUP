// Pet Cats Pack by LuizMelo (CC0), hosted with the app so the mascot never depends on a third party at runtime.
// Each sheet is a row of 50 px frames. CSS steps through it; see .sprite in mascota.css.
export const anims={idle:[10,8],itch:[2,8],laying:[8,9],'licking-1':[5,6],'licking-2':[5,6],meow:[4,7],run:[8,14],sitting:[1,1],'sleeping-1':[1,1],'sleeping-2':[1,1],stretching:[13,9],walk:[8,10]};
const cats={hoy:1,auditoria:2,keywords:6,tareas:3,revisiones:4,ajustes:5};
const noItch=new Set(['tareas']); // Cat 3 ships without this sheet.

const catOf=kind=>cats[kind]||cats.hoy;
const usable=(kind,anim)=>Object.hasOwn(anims,anim)&&!(anim==='itch'&&noItch.has(kind))?anim:'idle';
const frame=(kind,anim)=>{
  const name=usable(kind,anim),[frames,fps]=anims[name];
  return '<img src="/sprites/cat-'+catOf(kind)+'/'+name+'.png" alt="" draggable="false" style="--frames:'+frames+';--dur:'+(frames/fps).toFixed(3)+'s">';
};
export const spriteMs=(kind,anim,loops=1)=>{const [frames,fps]=anims[usable(kind,anim)];return Math.round(frames/fps*1000*loops);};
export const sprite=(kind,anim='idle',css='')=>'<span class="sprite '+css+'" aria-hidden="true">'+frame(kind,anim)+'</span>';
export function setSprite(el,kind,anim){if(el)el.innerHTML=frame(kind,anim);}
export function preloadSprites(kind){for(const anim of Object.keys(anims))if(usable(kind,anim)===anim)new Image().src='/sprites/cat-'+catOf(kind)+'/'+anim+'.png';}
