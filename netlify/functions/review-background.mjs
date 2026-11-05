import {withGoogleDatabase,workerAllowed} from '../../lib/host.mjs';
import {runNext} from '../../lib/reviews.mjs';
export default async function review(req){
  if(req.method!=='POST'||!workerAllowed(req))return;
  await withGoogleDatabase(store=>runNext(store));
}

