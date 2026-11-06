import {extractPage} from './crawl.mjs';
import {auditSite} from './seo.mjs';

const base = 'https://maderasur.example/';
const legacyDescription = 'Muebles de madera fabricados a medida en Santiago.';
const source = 'Demostración';
const catalog = {
  '': {
    label:'Taller Madera Sur', description:'Conoce el taller y sus colecciones de escritorios, mesas plegables y muebles a medida para viviendas pequeñas.',
    heading:'Tres colecciones del taller', alt:'Escritorio y mesa plegable en el espacio de trabajo del taller',
    body:'El taller reúne tres colecciones para resolver tareas cotidianas en habitaciones pequeñas. En cada colección puedes ver la distribución del mueble y los detalles que necesita el equipo antes de preparar un encargo.'
  },
  'escritorios': {
    label:'Escritorios de madera', description:'', heading:'Cubiertas, patas y acabados', alt:'Escritorio de madera con cubierta rectangular y patas desmontables',
    body:'Esta colección reúne escritorios de madera para estudio y trabajo. Las cubiertas rectangulares pueden combinarse con patas desmontables. El equipo del taller revisa el acabado elegido y la distribución de los cables antes de preparar la propuesta.'
  },
  'mesas-plegables': {
    label:'Mesas plegables', description:'Explora mesas abatibles de madera para cocinas pequeñas y conoce las opciones de apoyo y cierre.',
    heading:'Opciones de apoyo y cierre', alt:'Mesa abatible de pared con el soporte de madera abierto',
    body:'Estas mesas se recogen contra la pared para liberar el paso en la cocina. El soporte se despliega al abrir la cubierta. Para preparar el encargo, el taller pide una foto de la pared y una referencia del espacio disponible.'
  },
  'muebles-a-medida': {
    label:'Muebles a medida', description:'Descubre cómo encargar al taller un mueble adaptado a un rincón, una habitación o un espacio de trabajo en Santiago.',
    heading:'Del primer croquis al encargo', alt:'Croquis de una estantería junto a una muestra de madera',
    body:'Cada encargo empieza con un croquis del lugar y una descripción del uso esperado. El equipo revisa los obstáculos, propone una distribución y comparte una vista del mueble antes de confirmar el acabado.'
  }
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pathFor = page => page.url.startsWith(base) ? page.url.slice(base.length) : null;

function enrichPage(page, paths) {
  const path = pathFor(page);
  if (!Object.hasOwn(catalog,path) || page.contentHash || page.html === false || page.status !== 200) return page;
  const copy = catalog[path];
  const description = page.description === legacyDescription || page.description == null ? copy.description : page.description;
  const nav = paths.filter(p=>p!==path).map(p=>'<a href="'+base+p+'">'+catalog[p].label+'</a>').join(' ');
  const image = base+'images/'+(path||'taller')+'.jpg';
  const schema = JSON.stringify({'@context':'https://schema.org','@type':path?'CollectionPage':'WebPage',name:page.title,url:page.url}).replace(/</g,'\\u003c');
  const html = `<!doctype html><html lang="es-CL" data-source="demostracion"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(page.title)}</title><meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(page.canonical||page.url)}">
    <script type="application/ld+json">${schema}</script></head><body>
    <nav>${nav}</nav><main><h1>${escapeHtml(page.h1)}</h1>
    <h2>${copy.heading}</h2><p>${copy.body}</p>
    <h2>Cómo trabajamos</h2><p>Antes de empezar, el taller confirma las medidas del lugar, el tipo de madera y el acabado que mejor resiste el uso diario. Después comparte un presupuesto por escrito con el plazo de fabricación y la forma de entrega. Si el espacio cambia durante el encargo, el equipo revisa el diseño contigo y ajusta lo necesario antes de cortar las piezas.</p>
    <img src="${image}" alt="${copy.alt}"></main></body></html>`;
  const extracted = extractPage(html,page.url);
  return {...extracted,...page,description,links:page.links?.length?page.links:extracted.links,source,synthetic:true};
}

function addExampleQuestion(rows, category) {
  if (!category) return;
  const query = 'qué altura debe tener un escritorio para trabajar con una silla regulable';
  const dates = new Set(rows.filter(r=>r.source===source && r.page===category && r.query==='escritorio de madera para espacios pequeños').map(r=>r.date));
  const existing = new Set(rows.filter(r=>r.source===source && r.page===category && r.query===query && r.country==='Chile' && r.device==='MOBILE').map(r=>r.date));
  for (const date of dates) {
    if (existing.has(date) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day = Number(date.slice(-2));
    rows.push({query,page:category,date,country:'Chile',device:'MOBILE',impressions:24+day%7,clicks:day%4===0?1:0,position:13+day%3,source,observed:true,synthetic:true});
  }
}

export function upgradeDemoWorkshop(site) {
  if (site?.demo !== true || site.url !== base || Object.hasOwn(site,'demoWorkshopVersion')) return false;
  const paths = site.pages.map(pathFor).filter(path=>Object.hasOwn(catalog,path));
  site.pages = site.pages.map(page=>enrichPage(page,paths));
  addExampleQuestion(site.rows,paths.includes('escritorios')?base+'escritorios':null);
  site.audit = {...auditSite({pages:site.pages,errors:[],complete:true,checkedAt:site.lastReviewAt}),source,synthetic:true};
  site.demoWorkshopVersion = 1;
  return true;
}
