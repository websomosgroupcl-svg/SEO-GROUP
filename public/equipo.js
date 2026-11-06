const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(name,action,id='')=>'<button type="button" class="btn secondary compact" data-team="'+action+'" data-id="'+escape(id)+'">'+name+'</button>';

export function mountTeam(root,{api,user,sites,show}){
  let users=[],closed=false;
  root.innerHTML='<section class="panel"><header class="panel-head"><div><p class="eyebrow">Administración</p><h2>Personas y permisos</h2></div>'+button('Crear usuario','new')+'</header><p>Los miembros trabajan en sus sitios y en los que les asignes. Los administradores gestionan todo el espacio.</p><div data-directory role="status">Cargando personas…</div></section><details class="panel system-console"><summary>Consola de preparación</summary><p>Comprueba la instalación o consulta cómo preparar otro equipo.</p><div class="actions">'+button('Comprobar sistema','status')+button('Comprobar Google','google')+button('Instalación local','install')+'<a class="btn secondary compact" href="/preparar-seobestia.cmd" download="preparar-seobestia.cmd">Descargar instalador para Windows</a></div><output data-console aria-live="polite">Elige una comprobación.</output></details>';
  const list=root.querySelector('[data-directory]'),output=root.querySelector('[data-console]');
  const invitation=document.createElement('section');invitation.className='panel team-invite';
  list.closest('.panel').after(invitation);
  let link='',inviteBusy=false;
  function invitePanel(status){
    const active=Boolean(status.active??status.enabled),until=status.expiresAt?new Date(status.expiresAt).toLocaleString('es-CL'):'';
    invitation.innerHTML='<p class="eyebrow">Acceso por invitación</p><h2>Invitar al equipo</h2><p>Quien tenga este enlace puede crear una cuenta de miembro y entrar sin esperar aprobación. Compártelo en privado con tu equipo. Después podrás asignar las webs de cada persona.</p>'+
      (active?'<p>Enlace activo'+(until?' hasta '+escape(until):'')+'.</p>':'<p>Actualmente no hay un enlace activo.</p>')+
      (link?'<label>Enlace privado para compartir<input readonly data-invite-link autocomplete="off" spellcheck="false" value="'+escape(link)+'"></label>':active?'<p class="meta">El enlace se muestra al generarlo. Si necesitas otra copia, genera uno nuevo y comparte el reemplazo.</p>':'')+
      '<div class="actions">'+(link?button('Copiar enlace','invite-copy'):'')+button(active?'Rotar enlace':'Generar enlace privado','invite-new')+(active?button('Revocar enlace','invite-revoke'):'')+'</div><p data-invite-feedback role="status"></p>';
  }
  async function loadInvite(){
    invitation.innerHTML='<p role="status">Consultando el estado de las invitaciones…</p>';
    try{const status=await api('team-invite');if(!closed)invitePanel(status);}
    catch(err){if(!closed)invitation.innerHTML='<p role="alert">'+escape(err.message)+'</p>'+button('Reintentar invitaciones','invite-load');}
  }
  async function issueInvite(action){
    if(inviteBusy)return;inviteBusy=true;
    invitation.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      const result=await api('team-invite',action==='invite-new'?'POST':'DELETE',{});
      if(closed)return;
      link=result.code?location.origin+location.pathname+'#/unirse/'+encodeURIComponent(result.code):'';
      invitePanel({...result,active:Boolean(result.code)});
      invitation.querySelector('[data-invite-feedback]').textContent=link?'Enlace generado. Cópialo antes de salir de esta pantalla.':'El enlace quedó revocado.';
    }catch(err){if(!closed)invitation.querySelector('[data-invite-feedback]').textContent=err.message;}
    finally{inviteBusy=false;if(!closed)invitation.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  const form=(person=null,approving=false)=>{
    const modify=Boolean(person);
    const assignment=sites.filter(s=>!s.demo).map(s=>'<label class="check"><input type="checkbox" name="siteIds" value="'+escape(s.id)+'" '+(person?.siteIds?.includes(s.id)?'checked':'')+'> '+escape(s.name)+'</label>').join('');
    const password=approving?'':'<label>'+(modify?'Nueva contraseña (opcional)':'Contraseña inicial')+'<input type="password" minlength="1" maxlength="512" name="password" autocomplete="new-password" '+(modify?'':'required')+'></label><small>Puedes usar una clave sencilla.</small>';
    const status=modify&&!approving?'<label class="check"><input name="disabled" type="checkbox" '+(person.disabled?'checked':'')+'> Desactivar acceso</label>':'';
    const guidance=approving?'<p class="signup-receipt">La persona indicó este correo al registrarse. Confirma su identidad con tu equipo antes de aprobar la solicitud.</p>':'';
    const title=approving?'Aprobar acceso':modify?'Editar usuario':'Crear usuario';
    show(title,'<div class="fields">'+guidance+'<label>Nombre<input name="name" maxlength="100" required value="'+escape(person?.name)+'"></label>'+(modify?'<p class="meta">'+escape(person.email)+'</p>':'<label>Usuario o correo<input type="text" name="email" autocomplete="off" required></label>')+password+'<label>Rol<select name="role"><option value="member">Miembro</option><option value="admin"'+(person?.role==='admin'?' selected':'')+'>Administrador</option></select></label><small>El administrador puede gestionar todos los sitios reales del equipo. Para un miembro, elige sus webs abajo.</small>'+status+'<fieldset><legend>Sitios asignados al miembro</legend>'+(assignment||'<p>Podrás asignar sitios cuando agregues la primera web.</p>')+'</fieldset></div>',async(data,form)=>{
      const changes={...data,siteIds:new FormData(form).getAll('siteIds'),disabled:data.disabled==='on'};
      if(approving)changes.pendingApproval=false;
      if(!changes.password)delete changes.password;
      await api(modify?'users/'+encodeURIComponent(person.id):'users',modify?'PATCH':'POST',changes);
      return approving?'Acceso aprobado y permisos guardados.':modify?'Cambios guardados.':'Usuario creado.';
    },approving?'Aprobar y guardar permisos':modify?'Guardar cambios':'Crear usuario');
  };
  function personRow(p){
    const waiting=p.pendingApproval&&!p.disabled, label=p.disabled?'Desactivado':waiting?'Pendiente de aprobación':'Activo';
    const allowed=p.role==='admin'?'Todos los sitios reales':(sites.filter(s=>p.siteIds?.includes(s.id)).map(s=>s.name).join(', ')||'Sin sitios asignados');
    return '<article class="team-person"><span class="avatar">'+escape(p.name.slice(0,1))+'</span><div><h3>'+escape(p.name)+'</h3><small>'+escape(p.email)+' · '+(p.role==='admin'?'Administrador':'Miembro')+' · '+label+'</small>'+(!waiting?'<small class="team-site-access">'+escape(allowed)+'</small>':'')+'</div>'+
      (p.localOnly?'<span class="badge">Acceso local</span>':'<div class="team-person-actions">'+(waiting?button('Aprobar acceso','approve',p.id)+button('Desactivar','disable-request',p.id):button('Editar','edit',p.id))+'</div>')+'</article>';
  }
  async function load(){
    try{
      const response=await api('users');if(closed)return;users=response.users;
      const waiting=users.filter(p=>p.pendingApproval&&!p.disabled),rest=users.filter(p=>!p.pendingApproval||p.disabled);
      const review=waiting.length?'<section class="team-requests"><h3>Solicitudes pendientes · '+waiting.length+'</h3>'+waiting.map(personRow).join('')+'</section>':'';
      list.innerHTML=review+'<section><h3>Cuentas del equipo</h3>'+rest.map(personRow).join('')+'</section>';
    }catch(e){if(!closed)list.innerHTML='<p role="alert">'+escape(e.message)+'</p>'+button('Reintentar','reload');}
  }
  async function click(ev){
    const b=ev.target.closest('[data-team]');if(!b)return;
    const action=b.dataset.team;
    if(action==='invite-load'){await loadInvite();return;}
    if(action==='invite-new'||action==='invite-revoke'){await issueInvite(action);return;}
    if(action==='invite-copy'){
      if(!link)return;
      try{await navigator.clipboard.writeText(link);invitation.querySelector('[data-invite-feedback]').textContent='Enlace copiado.';}
      catch{const field=invitation.querySelector('[data-invite-link]');field?.focus();field?.select();invitation.querySelector('[data-invite-feedback]').textContent='Copia el enlace seleccionado.';}return;
    }
    if(action==='new'){form();return;}if(action==='edit'||action==='approve'){const p=users.find(u=>u.id===b.dataset.id);if(p)form(p,action==='approve');return;}
    if(action==='disable-request'){
      const p=users.find(u=>u.id===b.dataset.id);if(!p)return;
      show('Desactivar solicitud','<p>Se cerrará el acceso de <strong>'+escape(p.email)+'</strong>. Puedes reactivarlo desde la lista de cuentas.</p>',async()=>{
        await api('users/'+encodeURIComponent(p.id),'PATCH',{name:p.name,role:'member',disabled:true,siteIds:[]});
        return 'Solicitud desactivada.';
      },'Desactivar solicitud');return;
    }
    if(action==='reload'){load();return;}
    if(action==='install'){output.textContent='En Windows, descarga el instalador, guárdalo junto a server.mjs y ábrelo. Comprueba Node y prepara las dependencias de este proyecto.\n\nTambién puedes instalarlas en una terminal con Node 24.14 o superior:\n\nnpm ci\nnpm start\n\nAbre http://127.0.0.1:4173. El rastreador, los gráficos y los conectores vienen incluidos.';return;}
    b.disabled=true;output.textContent='Comprobando…';
    try{
      const s=await api('sistema');if(closed)return;
      if(action==='google')output.textContent=['Search Console',s.google.gsc.configured?s.google.gsc.email:'Falta configurar una cuenta de servicio.','','Google Analytics 4',s.google.ga4.configured?s.google.ga4.email:'Falta configurar una cuenta de servicio.','','Abre Conexiones dentro de un sitio para comprobar el permiso de la propiedad.'].join('\n');
      else output.textContent=['Servidor activo · Node '+s.node,'Base de datos accesible · '+s.storage,'Entorno · '+(s.local?'Este computador':'Alojado'),'Sitios en seguimiento · '+s.sites,'Trabajos pendientes o en curso · '+s.pending].join('\n');
    }catch(e){if(!closed)output.textContent=e.message;}finally{b.disabled=false;}
  }
  root.addEventListener('click',click);load();loadInvite();
  return ()=>{closed=true;link='';invitation.replaceChildren();root.removeEventListener('click',click);};
}

