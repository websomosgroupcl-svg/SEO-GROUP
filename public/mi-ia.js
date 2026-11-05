export const providerNames=Object.freeze({openai:'OpenAI · GPT',anthropic:'Anthropic · Claude',gemini:'Google · Gemini'});

export async function configurePersonalAI({api,show,userId}){
  const {provider}=await api('mi-ia');
  const choices=Object.entries(providerNames).map(([id,name])=>'<option value="'+id+'" '+(id===provider?'selected':'')+'>'+name+'</option>').join('');
  const current=providerNames[provider];
  const state=current?'<p class="inline-note">Configurado en esta sesión · <strong>'+current+'</strong></p>':'<p class="meta">Todavía no has conectado un proveedor en esta sesión.</p>';
  show('Mi IA para ideas',state+'<div class="fields"><p>Usa tu cuenta para pedir títulos y enfoques a partir de las búsquedas del sitio. Puedes cambiar de proveedor cuando quieras.</p><label>Proveedor<select name="provider">'+choices+'</select></label><label>Clave API personal<input name="apiKey" type="password" required minlength="12" maxlength="512" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="Pega tu clave aquí"></label><small>La clave se guarda cifrada para esta sesión y se elimina al cerrarla. La cuota o el coste dependen de tu cuenta con el proveedor. Guardarla aquí no genera ninguna idea.</small>'+(current?'<button type="button" class="btn secondary compact" data-action="ai-forget">Olvidar mi clave</button>':'')+'</div>',async data=>{
    await api('mi-ia','PUT',{userId,provider:data.provider,apiKey:data.apiKey.trim()});
    return 'Clave guardada. Puedes usarla desde Keywords.';
  },current?'Reemplazar mi clave':'Guardar mi clave');
}

