import {database,wakeWorker} from '../../lib/host.mjs';
import {schedule} from '../../lib/reviews.mjs';
export default async function tick(){
  const db=await database();
  const pending=await db.mutate(state=>{schedule(state);return state.jobs.some(j=>j.status==='pending'||j.status==='running');},{keys:['sites','jobs'],siteSummary:true});
  if(pending)await wakeWorker();
}
export const config={schedule:'17 * * * *'};

