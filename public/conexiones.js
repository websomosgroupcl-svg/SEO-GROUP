const gsc='gsc',ga4='ga4';
const sources={
  gsc:{name:'Search Console',summary:'Búsquedas, clics y posiciones en Google.',asset:'conexion-gsc.svg',permission:'Restringido'},
  ga4:{name:'Google Analytics 4',summary:'Sesiones y eventos clave de tus páginas.',asset:'conexion-ga4.svg',permission:'Lector'}
};
const urls={
  accounts:'https://console.cloud.google.com/iam-admin/serviceaccounts',
  keys:'https://cloud.google.com/iam/docs/keys-create-delete?hl=es',
  gscAccess:'https://support.google.com/webmasters/answer/7687615?hl=es',
  gscTypes:'https://support.google.com/webmasters/answer/34592?hl=es',
  gaAccess:'https://support.google.com/analytics/answer/9305788?hl=es',
  gaId:'https://developers.google.com/analytics/devguides/reporting/data/v1/property-id?hl=es',
  gaUsers:'https://analytics.google.com/analytics/web/#/?pagename=admin-access-management-property',
  gaDetails:'https://analytics.google.com/analytics/web/#/?pagename=admin-property',
  apiLibrary:'https://console.cloud.google.com/apis/library/'
};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span aria-hidden="true"> ↗</span></a>`;
const picture=(name,alt)=>`<figure class="cx-figure"><img src="/${name}" width="480" height="${name==='conexion-cuenta.svg'?'200':'248'}" alt="${esc(alt)}"><figcaption>Ilustración de referencia · Los menús pueden variar de nombre.</figcaption></figure>`;
const button=(name,action,extra='')=>`<button type="button" class="btn secondary compact" data-cx="${action}" ${extra}>${esc(name)}</button>`;
const stepTitles=['Preparar la cuenta','Dar permiso','Vincular el sitio'];
export function mountConnections(container,{site,user,api,onConnected,initialSource=gsc}){
  let source=initialSource===ga4?ga4:gsc,step=0,prep=null,loading=false,prepError='',busy=false,disposed=false;
  const admin=user?.role==='admin'&&!site.demo;
  const canLink=admin||Boolean(!site.demo&&!user?.pendingApproval&&user?.id&&site.memberIds?.includes(user.id));
  let liveReview=Boolean(site.ga4LiveReviewRequired);
  const host=new URL(site.url).hostname;
  const connected={gsc:site.gscProperty||'',ga4:site.ga4PropertyId||''};
  const drafts={...connected};
  const completed={gsc:false,ga4:false};
  const scope='sites/'+encodeURIComponent(site.id)+'/';
  const selected=()=>prep?.[source]||{};
  const status=key=>site.demo?'Ejemplo':connected[key]?'Vinculada':'Pendiente';
  const eligibleGA=new URL(site.url).pathname==='/';
  function feedback(text='',error=false){
    const output=container.querySelector(error?'[data-cx-error]':'[data-cx-status]');
    if(output)output.textContent=text;
  }
  function move(next){
    step=next;
    render();
    container.querySelector('[data-cx-heading]')?.focus();
  }
  const googleApis=key=>(key===gsc?[['searchconsole','Search Console API']]:[['analyticsadmin','Google Analytics Admin API'],['analyticsdata','Google Analytics Data API']]).map(([service,name])=>link(urls.apiLibrary+service+'.googleapis.com',name)).join(' y ');
  function setup(){
    return `<details class="cx-help" ${admin&&prep&&!selected().configured?'open':''}><summary>Cómo preparar la cuenta en Google Cloud</summary>
      <ol><li>El administrador del proyecto abre ${link(urls.accounts,'Cuentas de servicio')}, selecciona el proyecto y crea una cuenta para SEOBESTIA o utiliza la existente. Puede dejar vacíos los roles del proyecto para esta cuenta lectora.</li>
      <li>En el mismo proyecto, abre ${googleApis(source)} y pulsa <strong>Habilitar</strong> en cada API necesaria.</li>
      <li>Si necesitas una credencial nueva, abre la cuenta y entra en <strong>Claves → Agregar clave → Crear clave nueva → JSON</strong>. Conserva el archivo en el equipo del administrador. ${link(urls.keys,'Instrucciones de Google Cloud')}</li></ol></details>`;
  }
  function identity(){
    const email=selected().email;
    return email?`<div class="cx-account"><span>Correo que debes invitar</span><code>${esc(email)}</code>${button('Copiar correo','copy')}</div>`:'';
  }
  function prepBody(){
    const entry=selected();
    let controls='';
    if(!canLink)controls=`<p class="cx-hint">${site.demo?'En una web real, el administrador prepara esta cuenta una vez para el equipo.':'Registrar la web permite analizarla. Para vincular Google, pide al administrador que te asigne esta web en Usuarios → Editar.'}</p>`;
    else if(loading&&!prep)controls='<p role="status">Consultando la preparación del servidor…</p>';
    else if(prepError)controls=`<p class="cx-hint">${esc(prepError)}</p>${button('Volver a comprobar','refresh')}`;
    else if(prep){
      const explanation=entry.invalid?'El servidor encontró una credencial que no puede leer. Revisa la cuenta y su formato con quien gestiona esta instalación.':entry.configured?'El permiso sobre la propiedad se comprueba al finalizar el paso 3.':'Configúrala una vez para esta instalación. Luego concede permiso en cada propiedad.';
      controls=`<p class="cx-hint"><strong>${entry.configured?'Cuenta preparada.':entry.invalid?'Revisar la credencial.':'Falta preparar la cuenta.'}</strong> ${explanation}</p>${identity()}`;
      const hosted=prep.storage==='hosted';
      if(!admin)controls+=`<p>${entry.configured?'Pide al responsable de la propiedad en Google que dé acceso de lectura al correo de arriba. Después podrás comprobar el identificador de este sitio en el paso 3.':'Pide al administrador de SEOBESTIA que prepare la cuenta del equipo.'}</p>${button('Actualizar estado','refresh')}`;
      else if(prep.canUpload&&entry.canUpload!==false)controls+=`<details class="cx-help" ${entry.configured?'':'open'}><summary>${entry.configured?'Cambiar la cuenta para esta fuente':hosted?'Guardar el archivo de Google en SEOBESTIA':'Guardar el archivo de Google en este equipo'}</summary>
        <p>${entry.configured?'Cambiar la cuenta afecta a los sitios que usan esta fuente. Revisa sus permisos antes de hacer el cambio. ':''}Elige el JSON descargado de Google Cloud. ${hosted?'El servidor cifra la credencial antes de guardarla para las revisiones del equipo.':'Windows protege la credencial para el usuario que ejecuta el servidor.'}${source===gsc?' Analytics también podrá usarla si no tiene una cuenta propia.':''}</p>
        <form data-cx-form="credential"><label>Archivo JSON de la cuenta de servicio<input required type="file" name="credential" accept=".json,application/json"></label><button class="btn secondary compact" type="submit">${hosted?'Guardar cuenta para el equipo':'Guardar cuenta en este equipo'}</button></form></details>`;
      else controls+=`<details class="cx-help" ${entry.configured?'':'open'}><summary>Configurar la credencial del servidor</summary>
        ${hosted&&!prep.canUpload?'<p>Para permitir que el administrador suba el archivo aquí, quien gestiona el alojamiento puede configurar una clave de cifrado privada y exclusiva del proyecto en <code>SEO_GOOGLE_VAULT_KEY</code>. Debe contener 32 bytes aleatorios codificados en base64 o hexadecimal y estar disponible para las funciones del servidor.</p>':''}
        <p>Quien administra el alojamiento debe guardar el JSON codificado en base64 en la variable privada <code>${source===gsc?'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64':'GA4_SERVICE_ACCOUNT_JSON_BASE64'}</code> y reiniciar el servidor o desplegar de nuevo.${source===ga4?' Si Analytics usa la misma cuenta que Search Console, basta con la variable de Search Console.':''}</p>
        ${button('Volver a comprobar la cuenta','refresh')}</details>`;
    }
    return `<p>Google necesita un correo al que dar acceso. SEOBESTIA usa una cuenta de servicio, una identidad que pertenece al equipo y puede leer los datos durante las revisiones diarias.</p>${controls}${admin?setup():''}${picture('conexion-cuenta.svg','Google Cloud, IAM y administración, Cuentas de servicio. Localiza el correo de la cuenta que vas a invitar.')}`;
  }
  function permissionBody(){
    const isGsc=source===gsc,prop=connected.gsc;
    const users='https://search.google.com/search-console/users'+(prop?'?resource_id='+encodeURIComponent(prop):'');
    const access=isGsc
      ? `<p>Lo hace el <strong>propietario de Search Console</strong>. Entra con la cuenta que administra <strong>${esc(host)}</strong> y selecciona la propiedad correcta.</p><ol><li>Abre <strong>Ajustes → Usuarios y permisos → Añadir usuario</strong>.</li><li>Pega el correo de la cuenta de servicio, selecciona <strong>Restringido</strong> y guarda.</li></ol>`
      : `<p>Lo hace un <strong>administrador de la propiedad GA4</strong>. En el selector superior elige la propiedad que mide <strong>${esc(host)}</strong>.</p><ol><li>Abre <strong>Administrar → Propiedad → Gestión de accesos a la propiedad</strong>.</li><li>Pulsa <strong>+ → Añadir usuarios</strong>. Pega el correo de la cuenta de servicio, marca <strong>Lector</strong> y añade el usuario.</li></ol>`;
    const help=isGsc?link(urls.gscAccess,'Ayuda sobre los permisos'):link(urls.gaAccess,'Ayuda sobre los permisos');
    return `${access}${identity()||'<p class="cx-hint">El administrador de SEOBESTIA encuentra el correo de la cuenta en el paso 1.</p>'}
      <div class="cx-links">${link(isGsc?users:urls.gaUsers,isGsc?'Abrir Usuarios y permisos':'Abrir accesos de la propiedad')}${help}</div>
      ${picture(sources[source].asset,isGsc?'Propiedad seleccionada, Ajustes, Usuarios y permisos, Añadir usuario con permiso Restringido.':'Administrar, Gestión de accesos a la propiedad, Añadir usuarios con el rol Lector. En Detalles aparece el ID numérico.')}`;
  }
  function propertyBody(){
    const isGsc=source===gsc;
    const where=isGsc?`<p>Abre el selector de propiedades en Search Console y fíjate en cómo está identificada la de <strong>${esc(host)}</strong>.</p>
      <ul><li><strong>Dominio.</strong> Si ves solo el dominio, escribe <code>sc-domain:</code> seguido del dominio tal como aparece, por ejemplo <code>sc-domain:ejemplo.cl</code>.</li>
      <li><strong>Prefijo de URL.</strong> Si ves una dirección web, copia la dirección completa, incluido <code>https://</code>, y conserva la ruta y la barra final que muestra Google.</li></ul>`
      :`<p>En <strong>Administrar → Propiedad → Detalles de la propiedad</strong>, copia el <strong>ID de propiedad</strong>, por ejemplo <code>123456789</code>. El código que empieza por <code>G-</code> identifica el flujo y sirve para instalar la etiqueta.</p>
      <p>En <strong>Recogida y modificación de datos → Flujos de datos</strong>, comprueba que haya un único flujo web cuya URL predeterminada corresponda a <strong>${esc(host)}</strong>.</p>`;
    let form='';
    const confirm=admin&&!isGsc&&liveReview?'<label class="check"><input type="checkbox" name="confirmLiveScope"> Confirmo que este flujo de GA4 solo mide esta web y que su actividad en vivo se puede compartir con el equipo del sitio.</label>':'';
    if(canLink&&!isGsc&&!eligibleGA)form='<p class="cx-hint">GA4 mide un dominio completo. Abre un sitio registrado en la raíz del dominio para vincular este flujo.</p>';
    else if(canLink&&selected().configured)form=`<form data-cx-form="property"><label>${isGsc?'Identificador de propiedad en Search Console':'ID numérico de la propiedad GA4'}<input name="property" required ${isGsc?'maxlength="2000"':'inputmode="numeric" maxlength="20"'} autocomplete="off" spellcheck="false" autocapitalize="none" value="${esc(drafts[source])}" placeholder="${isGsc&&!admin?esc(site.url):isGsc?'sc-domain:ejemplo.cl':'123456789'}"></label>${confirm}<button class="btn primary" type="submit">${connected[source]?'Volver a comprobar la propiedad':'Comprobar y vincular'}</button></form>`;
    else form=`<p class="cx-hint">${site.demo?'Los datos de esta web son de demostración. Para conectar Google, abre una web real del equipo.':!canLink?'Solicita al administrador que te asigne el sitio en Usuarios para poder vincular la propiedad.':'El administrador debe preparar la cuenta en el paso 1.'}</p>`;
    if(!admin&&canLink&&isGsc)form+=`<p class="cx-hint">Usa el prefijo de URL exacto ${esc(site.url)}${eligibleGA?' o la propiedad de dominio sc-domain:'+esc(host):''}.</p>`;
    if(!isGsc&&(liveReview||(!admin&&canLink)))form+='<p class="cx-hint">El histórico se limita al dominio. Para mostrar los últimos 30 minutos, el administrador debe confirmar que el flujo solo mide esta web.</p>';
    const finish=completed[source]?`<div class="cx-success" tabindex="-1" role="status"><strong>${esc(sources[source].name)} vinculada.</strong> ${isGsc?'La próxima revisión consultará los datos disponibles en Search Console.':'Ya se ha consultado el histórico del flujo. Puedes revisar sus sesiones y eventos en Medir.'}</div>`:'';
    return `${where}<div class="cx-links">${link(isGsc?'https://search.google.com/search-console':urls.gaDetails,isGsc?'Abrir Search Console':'Abrir Detalles de la propiedad')}${link(isGsc?urls.gscTypes:urls.gaId,isGsc?'Cómo identificar tu propiedad':'Dónde encontrar el ID')}</div>
      ${finish}${form}${picture(sources[source].asset,isGsc?'Ejemplo de propiedad de dominio en el selector de Search Console.':'Ejemplo. Detalles de la propiedad, ID numérico 123456789.')}`;
  }
  function render(){
    if(disposed)return;
    const history=source===gsc&&site.gscProperty?`<aside class="cx-hint"><strong>Historial de Search Console</strong><p>Detalle consultado hasta ${esc(site.gscUntil||'pendiente')}. Totales hasta ${esc(site.gscTotalsUntil||site.gscUntil||'pendiente')}.</p>${site.gscDetailState==='detenido'?`<p role="status"><strong>Detalle detenido.</strong> ${esc(site.gscDetailNotice)} Las keywords conservan el último período disponible.</p>`:''}${admin&&site.gscArchives?.length?`<details><summary>Descargar lotes archivados (${site.gscArchives.length})</summary><p>Cada archivo contiene las filas originales de este sitio en formato JSON. Guarda una copia externa del historial.</p><ul>${site.gscArchives.map(a=>`<li><a href="/api/${scope}gsc-archives/${encodeURIComponent(a.id)}" download>${esc(a.from)} a ${esc(a.until)} · ${esc(a.count)} filas</a></li>`).join('')}</ul></details>`:''}</aside>`:'';
    container.innerHTML=`<div class="cx"><header><p class="eyebrow">Datos del sitio</p><h2>Conectar con Google</h2><p>Elige de dónde traer los datos de <strong>${esc(host)}</strong>. Puedes conectar cada fuente por separado.</p></header>
      <div class="cx-sources" role="group" aria-label="Fuente de datos">${Object.entries(sources).map(([id,s])=>`<button type="button" data-cx-source="${id}" aria-pressed="${id===source}"><span><strong>${esc(s.name)}</strong><small>${esc(s.summary)}</small></span><span class="cx-badge">${status(id)}</span></button>`).join('')}</div>
      <div class="cx-guide"><nav aria-label="Guía de conexión de ${esc(sources[source].name)}">${stepTitles.map((title,i)=>`<button type="button" data-cx-step="${i}" ${i===step?'aria-current="step"':''}><span>${i+1}</span>${title}</button>`).join('')}</nav>
      <section><p class="eyebrow">${esc(sources[source].name)} · Paso ${step+1} de 3</p><h3 tabindex="-1" data-cx-heading>${stepTitles[step]}</h3>
      ${connected[source]?`<p class="cx-current">Propiedad vinculada · <strong>${esc(connected[source])}</strong></p>`:''}${history}
      ${admin&&source===gsc&&site.gscDetailState==='detenido'&&site.gscDetailCount?`<details class="cx-help"><summary>Exportar el detalle conservado</summary><p>Descarga cada tramo antes de ajustar la capacidad del piloto.</p><ul>${Array.from({length:Math.ceil(site.gscDetailCount/200)},(_,i)=>`<li><a href="/api/${scope}gsc-detail?offset=${i*200}" download>Filas ${i*200+1} a ${Math.min((i+1)*200,site.gscDetailCount)}</a></li>`).join('')}</ul></details>`:''}
      ${step===0?prepBody():step===1?permissionBody():propertyBody()}
      <p data-cx-error role="alert"></p><p data-cx-status role="status"></p>
      <div class="cx-controls">${step>0?button('Anterior','prev'):''}${step<2?button(step===0?'Ver cómo dar permiso':'Ir a la vinculación','next'):''}</div>
      </section></div></div>`;
    if(busy)container.querySelectorAll('button,input').forEach(el=>{el.disabled=true;});
  }
  async function loadPreparation(){
    if(!canLink||loading)return;
    loading=true;prepError='';render();
    try{
      if(admin)prep=await api('conexiones/preparacion');
      else{const [search,analytics]=await Promise.all([api(scope+gsc),api(scope+ga4)]);prep={gsc:search,ga4:analytics};}
    }
    catch(e){prep=null;prepError=e.message||'No se pudo consultar la cuenta del servidor.';}
    finally{loading=false;render();}
  }
  async function click(ev){
    const el=ev.target.closest('button');
    if(!el||busy||!container.contains(el))return;
    if(el.dataset.cxSource){source=el.dataset.cxSource;move(0);return;}
    if(el.hasAttribute('data-cx-step')){move(Number(el.dataset.cxStep));return;}
    switch(el.dataset.cx){
      case 'prev':move(step-1);break;
      case 'next':move(step+1);break;
      case 'refresh':await loadPreparation();break;
      case 'copy':
        try{await navigator.clipboard.writeText(selected().email);feedback('Correo copiado.');}
        catch{feedback('Selecciona el correo de arriba y cópialo.',true);}break;
    }
  }
  function input(ev){if(ev.target.name==='property')drafts[source]=ev.target.value;}
  async function submit(ev){
    const form=ev.target;if(!form.matches('form[data-cx-form]'))return;
    ev.preventDefault();if(!canLink||busy||disposed||loading)return;
    busy=true;
    container.querySelectorAll('button').forEach(el=>{el.disabled=true;});
    feedback();feedback('',true);
    let result='',error='',notify=false;
    try{
      if(form.dataset.cxForm==='credential'){
        if(!admin||!prep?.canUpload||selected().canUpload===false)throw Error('La credencial compartida solo puede cambiarla el administrador.');
        const file=form.elements.credential.files?.[0];
        if(!file||file.size>32768)throw Error('Elige el JSON original de la cuenta de servicio, de hasta 32 KiB.');
        let credential;try{credential=JSON.parse(await file.text());}catch{throw Error('El archivo seleccionado no contiene JSON válido. Descarga el archivo de la cuenta de servicio.');}
        if(credential?.type!=='service_account'||!credential.client_email||!credential.private_key)throw Error('El archivo debe ser una cuenta de servicio de Google con correo y clave privada.');
        if(disposed)return;
        const status=await api('conexiones/credencial','POST',{target:source,credential});
        if(disposed)return;
        if(status?.[source]?.configured){prep=status;prepError='';}
        else await loadPreparation();
        result='Cuenta guardada. Comprueba los permisos de la propiedad en el paso 2.';
      }else{
        completed[source]=false;
        const prop=String(form.elements.property.value).trim();
        if(source===ga4&&!/^[1-9]\d{0,19}$/.test(prop))throw Error('Copia el ID numérico de la propiedad desde Detalles de la propiedad. El identificador G- pertenece al flujo.');
        if(!prop)throw Error('Escribe el identificador de la propiedad que quieres comprobar.');
        feedback('Comprobando el acceso con Google…');
        const data=await api(scope+source,'POST',source===gsc?{gscProperty:prop}:{propertyId:prop,...(form.elements.confirmLiveScope?.checked?{confirmLiveScope:true}:{})});
        if(disposed)return;
        connected[source]=source===gsc?data.gscProperty:data.propertyId;
        if(source===ga4)liveReview=Boolean(data.liveReviewRequired);
        drafts[source]=connected[source];completed[source]=true;notify=true;
      }
    }catch(err){error=err.message||'La operación no pudo completarse. Vuelve a intentarlo.';}
    finally{
      busy=false;
      if(!disposed){
        render();
        if(error){feedback(error,true);container.querySelector('[name="property"],[name="credential"]')?.focus();}
        else if(result)feedback(result);
        if(notify){container.querySelector('.cx-success')?.focus();onConnected?.(source,connected[source]);}
      }
    }
  }
  container.addEventListener('click',click);container.addEventListener('input',input);container.addEventListener('submit',submit);
  render();if(canLink)void loadPreparation();
  return ()=>{disposed=true;container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('submit',submit);};
}
