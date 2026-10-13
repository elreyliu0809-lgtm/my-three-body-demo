// Browser-only transport. JSON data is never an admission capability.
export const PROTOCOL='MT_MODEL_HTTP_R02';
export const canonical=value=>JSON.stringify(order(value));
function order(v){return Array.isArray(v)?v.map(order):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])])):v;}
export function immutable(v){if(v&&typeof v==='object'){Object.values(v).forEach(immutable);Object.freeze(v);}return v;}
const fault=code=>Object.assign(new Error(code),{code});
export function validUnicode(text){for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);if(n>=0xD800&&n<=0xDBFF){const low=text.charCodeAt(++i);if(!(low>=0xDC00&&low<=0xDFFF))return false;}else if(n>=0xDC00&&n<=0xDFFF)return false;}return true;}
// Parse decoded object keys before JSON.parse can erase duplicates, including escaped keys.
export function strictJSONParse(text,maxBytes=262144){
 const fail=()=>{throw fault('MODEL_HOST_RESPONSE_INVALID');};
 if(typeof text!=='string'||new TextEncoder().encode(text).length>maxBytes||!validUnicode(text))fail();
 let i=0,depth=0;const space=()=>{while(/[\x20\t\r\n]/.test(text[i]??'\0'))i++;};
 function string(){if(text[i++]!=='"')fail();const start=i-1;while(i<text.length){const c=text[i++];if(c==='"'){let value;try{value=JSON.parse(text.slice(start,i));}catch{fail();}if(!validUnicode(value))fail();return value;}if(c<' ')fail();if(c==='\\'){const escape=text[i++];if(escape==='u'){if(!/^[0-9a-fA-F]{4}$/.test(text.slice(i,i+4)))fail();i+=4;}else if(!'"\\/bfnrt'.includes(escape??'\0'))fail();}}fail();}
 function value(){space();if(++depth>96)fail();const c=text[i];let out;if(c==='"')out=string();else if(c==='{'){i++;out={};const keys=new Set();space();if(text[i]==='}')i++;else{for(;;){space();if(text[i]!=='"')fail();const key=string();if(keys.has(key))fail();keys.add(key);space();if(text[i++]!==':')fail();const item=value();Object.defineProperty(out,key,{value:item,enumerable:true,writable:true,configurable:true});space();const end=text[i++];if(end==='}')break;if(end!==',')fail();}}}else if(c==='['){i++;out=[];space();if(text[i]===']')i++;else for(;;){out.push(value());space();const end=text[i++];if(end===']')break;if(end!==',')fail();}}else{const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));if(!m)fail();i+=m[0].length;out=JSON.parse(m[0]);if(typeof out==='number'&&!Number.isFinite(out))fail();}depth--;return out;}
 const parsed=value();space();if(i!==text.length)fail();return parsed;
}
const clone=v=>strictJSONParse(JSON.stringify(v),524288);
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const speechActs=new Set(['ACKNOWLEDGE','CLARIFY_REQUEST','EXPLAIN_SELECTION_LIMITS','DISCLOSE_APPLICATION_STATUS','SET_PUBLIC_BOUNDARY']);
export function finiteNPCDecision(d,{actor_id,reads,facts,actor}={}){
 const permitted=new Set([...(reads??[]).map(x=>x.receipt?.id),...(facts??[])]);
 if(!d||Object.keys(d).sort().join()!=='fact_refs,speech_act'||!speechActs.has(d.speech_act)||!Array.isArray(d.fact_refs)||d.fact_refs.length>16||new Set(d.fact_refs).size!==d.fact_refs.length||d.fact_refs.some(x=>typeof x!=='string'||!x||x.length>160||!permitted.has(x)))return false;
 if(d.speech_act==='DISCLOSE_APPLICATION_STATUS'&&(actor_id!=='lin'||!actor?.private_facts?.includes('APPLIED_ONCE_NOT_ADMITTED')||!d.fact_refs.includes('E01')||!facts?.includes('E01')))return false;
 if(d.speech_act==='EXPLAIN_SELECTION_LIMITS'&&(actor_id!=='officer'||actor?.baseline_receipt?.source_hash!=='A84F6E24FA7C6D398FF81F0284EA1584AE91A82147F9DD866382D78EB79C661F'))return false;
 if(d.speech_act==='SET_PUBLIC_BOUNDARY'&&(actor_id!=='lin'||!d.fact_refs.includes('E03')||!facts?.includes('E03')||!facts?.includes('E02')))return false;
 return true;
}
const SCOPE_SHA256='FF83F7C19B7ED917443DF04FCEE359B90EE3A97E5BE782D4E6A57DE023833143';
const BRIDGE_SHA256='2A5B511C7940B5C3B277EBFC83F534D74FE3E387AD6E31607FE7888E333FEF88';
const shaPattern=/^[A-F0-9]{64}$/;
const expires=window=>typeof window?.expires_at==='string'?Date.parse(window.expires_at):NaN;
export function createHttpModelClient({readSnapshot,endpoint='/model/request',fetchImpl,expectedCandidate,expectedSourceLock,provisionPreparations,onConsumed}={}){
 const preparations=new WeakMap();let preparationEpoch=0,armedPreparation=null;
 const injected=fetchImpl!==undefined,NativeResponse=globalThis.Response,fetcher=fetchImpl??globalThis.fetch?.bind(globalThis),issued=new WeakMap(),jobs=new Map();
 let mode='UNAVAILABLE',in_flight=0,model_calls=0,fake_calls=0,http_requests=0,spent=false,statusGeneration=0,source=null,window=null,testOnly=false,cancel_pending=0,cancellation_state='NOT_REQUESTED';
 const base=globalThis.location?.href??(injected?'http://in-memory.invalid/':null);
 if(!base||typeof fetcher!=='function'||typeof readSnapshot!=='function'||typeof expectedCandidate!=='string'||!expectedCandidate||expectedSourceLock!==undefined&&!shaPattern.test(expectedSourceLock))throw fault('MODEL_HOST_REQUEST_INVALID');
 const target=new URL(endpoint,base),origin=new URL(base).origin;
 if(target.origin!==origin||target.username||target.password||target.search||target.hash)throw fault('MODEL_HOST_REQUEST_INVALID');
 const statusURL=new URL('/model/status',target);
 function sourceValid(s){return !!s&&Object.keys(s).sort().join()==='bridge_manifest_sha256,scope_sha256,source_lock_sha256'&&s.scope_sha256===SCOPE_SHA256&&s.bridge_manifest_sha256===BRIDGE_SHA256&&shaPattern.test(s.source_lock_sha256)&&(!expectedSourceLock||s.source_lock_sha256===expectedSourceLock);}
 function windowValid(w){return !!w&&Object.keys(w).sort().join()==='expires_at,window_id'&&typeof w.window_id==='string'&&w.window_id.length>=16&&w.window_id.length<=160&&Number.isFinite(expires(w))&&expires(w)>Date.now();}
 function evidenceValid(dto,{attempted=false}={}){return injected?dto.test_only===true&&dto.evidence_origin==='AUTHOR_TEST'&&dto.model_calls===0&&dto.fake_calls===(attempted?1:0):(dto.test_only===undefined||dto.test_only===false)&&(dto.evidence_origin===undefined||dto.evidence_origin==='MODEL_TEXT')&&dto.fake_calls===0&&(attempted?dto.model_calls===1:Number.isSafeInteger(dto.model_calls)&&dto.model_calls>=0&&dto.model_calls<=1);}
 function snapshot(kind,actor){const s=immutable(clone(readSnapshot(kind,actor)));if(!s?.request||!s.context||!s.actor||!Array.isArray(s.reads)||!Array.isArray(s.facts)||Object.keys(s).sort().join()!=='actor,context,facts,reads,request'||s.context.candidate_id!==expectedCandidate)throw fault('MODEL_HOST_SNAPSHOT_INVALID');if(s.context.cancelled)throw fault('MODEL_HOST_CANCELLED');if(s.context.unknown||s.context.suspended)throw fault('MODEL_HOST_STALE');return s;}
 function alive(sealed,signal,generation){if(signal!==undefined&&nativeAborted.call(signal))throw fault('MODEL_HOST_CANCELLED');if(generation!==statusGeneration||canonical(snapshot('PLAYER','player'))!==canonical(sealed))throw fault('MODEL_HOST_STALE');}
 // Error/CANCEL DTOs can omit source fields: their counters belong only to the
 // captured current request, never a later status generation or foreign source.
 function counts(dto,binding){
  if(!binding||binding.generation!==statusGeneration||!sourceValid(binding.source)||source&&canonical(source)!==canonical(binding.source)||dto?.protocol!==PROTOCOL||dto.candidate_id!==expectedCandidate||dto.source!==undefined&&canonical(dto.source)!==canonical(binding.source)||dto.window!==undefined&&canonical(dto.window)!==canonical(binding.window))return;
  if(!(dto.model_calls===null&&!injected||Number.isSafeInteger(dto.model_calls)&&dto.model_calls>=0&&dto.model_calls<=1)||!Number.isSafeInteger(dto.fake_calls)||dto.fake_calls<0||dto.fake_calls>(injected?1:0)||!injected&&(dto.test_only===true||dto.evidence_origin!==undefined&&dto.evidence_origin!=='MODEL_TEXT'))return;
  model_calls=dto.model_calls;fake_calls=dto.fake_calls;
 }
 async function capture(url,options,binding){
  const response=await fetcher(url.href,{...options,credentials:'same-origin',redirect:'error',cache:'no-store'});
  if(!response||response.redirected===true||typeof response.url!=='string'||new URL(response.url,base).href!==url.href||!injected&&(!(response instanceof NativeResponse)||!['basic','default'].includes(response.type)))throw fault('MODEL_HOST_RESPONSE_INVALID');
  const type=response.headers?.get?.('content-type')??'';if(!/^application\/json(?:;|$)/i.test(type))throw fault('MODEL_HOST_RESPONSE_INVALID');
  const dto=strictJSONParse(await response.text(),524288);if(response.ok!==true){counts(dto,binding);if(dto?.state==='UNAVAILABLE')mode='UNAVAILABLE';throw fault(/^MODEL_HOST_[A-Z_]+$/.test(dto?.error_code??'')?dto.error_code:'MODEL_HOST_RESPONSE_INVALID');}return dto;
 }
 async function initialize(){model_calls=0;fake_calls=0;mode='UNAVAILABLE';source=null;window=null;return status();}

 async function cancelHTTP({request_nonce,source:boundSource,window:boundWindow,generation}){
  cancellation_state='PENDING';cancel_pending++;
  const binding={source:boundSource,window:boundWindow,generation};
  try{const dto=await capture(target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({protocol:PROTOCOL,action:'CANCEL',candidate_id:expectedCandidate,request_nonce,window_id:boundWindow.window_id,source_lock_sha256:boundSource.source_lock_sha256})},binding);if(dto.protocol!==PROTOCOL||dto.candidate_id!==expectedCandidate||!['CANCELLED','UNKNOWN'].includes(dto.state))throw fault('MODEL_HOST_RESPONSE_INVALID');counts(dto,binding);cancellation_state=dto.state;}catch{cancellation_state='UNKNOWN';}finally{cancel_pending--;}
 }
 function request({kind,actor_id,signal}={}){try{
  // The future canary is one PLAYER call. These refusals precede all fetches.
  if(kind!=='PLAYER'||actor_id!=='player')throw fault('MODEL_HOST_REQUEST_INVALID');
  if(mode!=='MODEL_TEXT'||!source||!window||!windowValid(window))throw fault('MODEL_HOST_UNAVAILABLE');
  if(signal!==undefined){try{nativeAborted.call(signal);}catch{throw fault('MODEL_HOST_SIGNAL_INVALID');}}
  const sealed=snapshot(kind,actor_id),generation=statusGeneration;alive(sealed,signal,generation);
  if(sealed.request.actor_id!=='player'||sealed.request.request_revision!==1||sealed.context.clarification_history?.length)throw fault('MODEL_HOST_REQUEST_INVALID');
  if(sealed.context.scene_fingerprint!==source.source_lock_sha256||sealed.request.scene_fingerprint!==source.source_lock_sha256)throw fault('MODEL_HOST_SOURCE_BINDING');
  const prepared=armedPreparation;if(!prepared||prepared.epoch!==preparationEpoch||prepared.bytes!==canonical(sealed))throw fault('MODEL_HOST_PREPARATION_REQUIRED');
  const r=sealed.request,key=canonical([kind,actor_id,r.session_id,r.request_id,r.request_revision]),bytes=canonical(sealed),old=jobs.get(key);
  if(old){if(old.bytes!==bytes||old.signal!==signal||old.generation!==generation)throw fault('MODEL_HOST_DUPLICATE_CONFLICT');return old.promise;}
  if(spent)throw fault('MODEL_HOST_CANARY_USED');spent=true;
  const request_nonce=prepared.request_nonce,boundSource=source,boundWindow=window,binding={source:source,window:window,generation};let postStarted=false,cancelSent=false;
  const abort=()=>{if(postStarted&&!cancelSent){mode='UNAVAILABLE';cancelSent=true;void cancelHTTP({request_nonce,source:boundSource,window:boundWindow,generation});}};
  const promise=(async()=>{in_flight++;try{
   const snapshot_sha256=await digest(bytes);alive(sealed,signal,generation);if(!windowValid(boundWindow))throw fault('MODEL_HOST_UNAVAILABLE');
   signal?.addEventListener('abort',abort,{once:true});postStarted=true;http_requests++;abortIfNeeded();if(!injected)model_calls=null;
   const dto=await capture(target,{method:'POST',signal,headers:{'content-type':'application/json'},body:JSON.stringify({protocol:PROTOCOL,action:'REQUEST',candidate_id:expectedCandidate,kind,actor_id,snapshot:sealed,snapshot_sha256,request_nonce,window_id:boundWindow.window_id,source_lock_sha256:boundSource.source_lock_sha256})},binding);
   alive(sealed,signal,generation);if(!windowValid(boundWindow))throw fault('MODEL_HOST_STALE');
   const b=dto.bindings;
   if(dto.protocol!==PROTOCOL||dto.candidate_id!==expectedCandidate||dto.kind!==kind||dto.actor_id!==actor_id||dto.origin!=='MODEL_TEXT'||!evidenceValid(dto,{attempted:true})||canonical(dto.source)!==canonical(boundSource)||canonical(dto.window)!==canonical(boundWindow)||canonical(dto.snapshot)!==bytes||b?.canonical_snapshot_sha256!==snapshot_sha256||b.request_nonce!==request_nonce||b.window_id!==boundWindow.window_id||b.source_lock_sha256!==boundSource.source_lock_sha256||b.canonical_request_sha256!==await digest(canonical(r))||!['packet_sha256','wire_sha256'].every(k=>shaPattern.test(b[k]??''))||typeof b.job_id!=='string'||!b.job_id)throw fault('MODEL_HOST_RESPONSE_INVALID');
   const check={...dto};delete check.result_sha256;if(dto.result_sha256!==await digest(canonical(check)))throw fault('MODEL_HOST_RESPONSE_INVALID');
   const receipt=dto.receipt,raw=strictJSONParse(dto.raw_response,65536);
   if(!receipt||receipt.state!=='MODEL_BRIDGE_ACCEPTED'||receipt.requested_model!=='deepseek-v4-flash'||!['deepseek-v4-flash','deepseek-v4-flash-0731'].includes(receipt.actual_model)||receipt.identity_match_type!==(receipt.actual_model==='deepseek-v4-flash'?'EXACT':'FINITE_HOST_REPORTED_ALIAS')||canonical(receipt.allowed_response_models)!==canonical(['deepseek-v4-flash-0731'])||receipt.expected_modality!=='text'||receipt.stop_reason!=='end_turn'||receipt.text_present!==true||receipt.production_response_accepted!==true||receipt.request_sha256!==b.wire_sha256||receipt.raw_response_sha256!==await digest(dto.raw_response)||raw.model!==receipt.actual_model||raw.stop_reason!=='end_turn'||!Array.isArray(raw.content)||!raw.content.length||raw.content.some(x=>x.type!=='text'||typeof x.text!=='string'))throw fault('MODEL_HOST_RESPONSE_INVALID');
   const parsed=strictJSONParse(raw.content.map(x=>x.text).join(''),65536);
   if(canonical(parsed)!==canonical(dto.wrapper)||Object.keys(parsed).sort().join()!=='kind,plan,request'||parsed.kind!=='FP_COMPLETE_PLAN_R01'||canonical(parsed.request)!==canonical(r))throw fault('MODEL_HOST_RESPONSE_INVALID');
   alive(sealed,signal,generation);counts(dto,binding);
   // HTTP JSON only mints a source-bound local response capability here. It is
   // still an offered plan and must pass the original single executor validator.
   const result=immutable({kind,actor_id,...sealed,wrapper:parsed,bindings:clone(b),source:clone(boundSource),window:clone(boundWindow),origin:'MODEL_TEXT',test_only:testOnly,evidence_origin:testOnly?'AUTHOR_TEST':'MODEL_TEXT'});
   issued.set(result,{sealed,signal,bytes:canonical(result),generation,source:boundSource,window:boundWindow});return result;
  }catch(error){abort();throw error?.code?error:fault('MODEL_HOST_FAILED');}finally{in_flight--;signal?.removeEventListener('abort',abort);}})();
  function abortIfNeeded(){if(signal!==undefined&&nativeAborted.call(signal)){abort();throw fault('MODEL_HOST_CANCELLED');}}
  jobs.set(key,{bytes,signal,promise,generation});return promise;
 }catch(error){return Promise.reject(error);}}
 function validate(result){try{const v=issued.get(result);if(!v||!windowValid(v.window)||v.bytes!==canonical(result)||canonical(v.source)!==canonical(source)||canonical(v.window)!==canonical(window))return false;alive(v.sealed,v.signal,v.generation);return true;}catch{return false;}}
 function status(){if(mode==='MODEL_TEXT'&&!windowValid(window))mode='UNAVAILABLE';return Object.freeze({mode,model_calls,fake_calls,model_calls_status:'OFFLINE_DISABLED',in_flight,http_requests,canary_used:spent,test_only:testOnly,evidence_origin:testOnly?'AUTHOR_TEST':mode==='MODEL_TEXT'?'MODEL_TEXT':'UNAVAILABLE',cancel_pending,cancellation_state});}
 if(provisionPreparations!==undefined){if(typeof provisionPreparations!=='function')throw fault('MODEL_HOST_REQUEST_INVALID');provisionPreparations(Object.freeze({
  async preparePLAYER(){if(spent||armedPreparation)throw fault('MODEL_HOST_CANARY_USED');const sealed=snapshot('PLAYER','player'),epoch=preparationEpoch,bytes=canonical(sealed);if(sealed.request.actor_id!=='player'||sealed.request.request_revision!==1||sealed.context.clarification_history?.length)throw fault('MODEL_HOST_REQUEST_INVALID');const request_nonce=crypto.randomUUID(),snapshot_sha256=await digest(bytes);if(epoch!==preparationEpoch||canonical(snapshot('PLAYER','player'))!==bytes)throw fault('MODEL_HOST_STALE');const capability=Object.freeze({}),record={sealed,bytes,request_nonce,snapshot_sha256,epoch};preparations.set(capability,record);return Object.freeze({capability,request_nonce,snapshot_sha256,snapshot:sealed});},
  arm(capability,qualification){const r=preparations.get(capability);if(!r||r.epoch!==preparationEpoch||armedPreparation||spent||mode!=='MODEL_TEXT'||!source||!window||!windowValid(window)||canonical(snapshot('PLAYER','player'))!==r.bytes||qualification?.candidate_id!==expectedCandidate||qualification.source_lock_sha256!==source.source_lock_sha256||qualification.window_id!==window.window_id)throw fault('MODEL_HOST_PREPARATION_REQUIRED');armedPreparation=r;return true;},
  inspect(capability){const r=preparations.get(capability);if(!r||r.epoch!==preparationEpoch)throw fault('MODEL_HOST_STALE');return immutable(clone({request_nonce:r.request_nonce,snapshot_sha256:r.snapshot_sha256,snapshot:r.sealed,armed:armedPreparation===r}));},
  invalidate(){preparationEpoch++;armedPreparation=null;}
 }));}
 return Object.freeze({request,validate,consume(result){const record=issued.get(result);if(!validate(result)||record.consumed===true)throw fault('MODEL_HOST_CAPABILITY_INVALID');record.consumed=true;if(onConsumed!==undefined){if(typeof onConsumed!=='function')throw fault('MODEL_HOST_CAPABILITY_INVALID');onConsumed(immutable(clone({request:result.request,wrapper:result.wrapper,bindings:result.bindings,origin:result.origin})));}return result;},status,initialize,readSnapshot:snapshot});
}
