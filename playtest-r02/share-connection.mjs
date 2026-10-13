const fragment=new URLSearchParams(location.hash.slice(1));
const access=fragment.get('access');
if(access){sessionStorage.setItem('MT_SHARE_R02_ACCESS',access);history.replaceState(null,'',location.pathname+location.search);}
const config=await(await fetch(new URL('./connection.json',import.meta.url),{cache:'no-store'})).json();
const local=['127.0.0.1','localhost'].includes(location.hostname);
export const backend=local?location.origin:config.backend_url;
export async function apiFetch(route,options={}){
 const token=sessionStorage.getItem('MT_SHARE_R02_ACCESS');
 if(!backend||!token)throw Object.assign(Error('MODEL_HOST_UNAVAILABLE'),{code:'MODEL_HOST_UNAVAILABLE'});
 const url=new URL(route,backend);
 if(!local&&url.protocol!=='https:')throw Error('HTTPS_BACKEND_REQUIRED');
 return fetch(url,{...options,credentials:'omit',redirect:'error',cache:'no-store',headers:{...options.headers,authorization:'Bearer '+token}});
}
