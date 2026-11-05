import {AsyncLocalStorage} from 'node:async_hooks';

const context=new AsyncLocalStorage();
const variables={gsc:'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64',ga4:'GA4_SERVICE_ACCOUNT_JSON_BASE64'};
export const inGoogleContext=(records,work)=>context.run(records,work);
export function googleAccount(target) {
  const records=context.getStore();
  const lookup=id=>process.env[variables[id]]?{raw:process.env[variables[id]]}:records?.[id];
  return lookup(target)||(target==='ga4'?lookup('gsc'):null)||{};
}
export const deploymentOwnsGoogle=target=>Object.hasOwn(variables,target)&&Boolean(process.env[variables[target]]);
