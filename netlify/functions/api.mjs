import {database,wakeWorker,withGoogleDatabase} from '../../lib/host.mjs';
import {handle} from '../../lib/api.mjs';
export default async function api(request,context){
  const dispatch=(store,googleManager=null)=>handle(request,{store,googleManager,ip:context.ip,wake:wakeWorker});
  const path=new URL(request.url).pathname;
  // Login, static data views and unrelated actions need no decrypted credentials.
  if(/^\/api\/(?:conexiones\/|sistema\/?$|sites\/[^/]+\/(?:gsc|ga4|live)\/?$)/.test(path)||
     request.method==='POST'&&/^\/api\/sites\/?$/.test(path))return withGoogleDatabase(dispatch);
  return dispatch(await database());
}
export const config={path:'/api/*'};

