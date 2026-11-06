import {problem} from './sources.mjs';

const API='https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const score=c=>c?.score==null?null:Math.round(c.score*100);
const amount=a=>Number.isFinite(a?.numericValue)?a.numericValue:null;

function summarize(data) {
  const lh=data.lighthouseResult||{},cat=lh.categories||{},audits=lh.audits||{};
  const exp=data.loadingExperience?.metrics?data.loadingExperience:data.originLoadingExperience;
  const m=exp?.metrics;
  return {
    performance:score(cat.performance),accessibility:score(cat.accessibility),bestPractices:score(cat['best-practices']),seo:score(cat.seo),
    lab:{lcpMs:amount(audits['largest-contentful-paint']),cls:amount(audits['cumulative-layout-shift']),tbtMs:amount(audits['total-blocking-time'])},
    // Real-user data exists only with enough Chrome traffic. It can describe the page or the whole origin.
    field:m?{scope:exp.origin_fallback||exp===data.originLoadingExperience?'origen':'página',category:exp.overall_category||null,
      lcpMs:m.LARGEST_CONTENTFUL_PAINT_MS?.percentile??null,inpMs:m.INTERACTION_TO_NEXT_PAINT?.percentile??null,
      cls:m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile==null?null:m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile/100}:null
  };
}

async function run(url,strategy,key,fetcher) {
  const query=new URLSearchParams({url,strategy,key,locale:'es'});
  for(const c of ['PERFORMANCE','ACCESSIBILITY','BEST_PRACTICES','SEO'])query.append('category',c);
  let res;
  // The request URL carries the key: never log or forward the underlying error.
  try{res=await fetcher(API+'?'+query,{signal:AbortSignal.timeout(120000)});}
  catch{throw problem('PageSpeed no respondió.',502);}
  if(!res.ok)throw problem('PageSpeed respondió HTTP '+res.status+'.',502);
  return summarize(await res.json());
}

// Returns null without a key so that a review works the same without this source.
export async function pageSpeed(url,{key=process.env.PAGESPEED_API_KEY,fetcher=fetch,now=new Date()}={}) {
  if(!key)return null;
  const [mobile,desktop]=await Promise.allSettled([run(url,'mobile',key,fetcher),run(url,'desktop',key,fetcher)]);
  if(mobile.status==='rejected'&&desktop.status==='rejected')throw mobile.reason;
  return {at:now.toISOString(),url,mobile:mobile.value||null,desktop:desktop.value||null};
}
