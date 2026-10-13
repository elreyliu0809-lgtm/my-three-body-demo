import {canonical,immutable,strictJSONParse,finiteNPCDecision} from './http-protocol.mjs';
import {apiFetch} from '../share-connection.mjs';
export {canonical,immutable,strictJSONParse,finiteNPCDecision};
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
const fault=code=>Object.assign(Error(code),{code});
async function awaitForeground(signal){
 while(document.hidden||!document.hasFocus()){
  if(signal?.aborted)throw fault('MODEL_HOST_CANCELLED');
  await new Promise((resolve,reject)=>{let timer;const done=()=>{clearTimeout(timer);window.removeEventListener('focus',done);document.removeEventListener('visibilitychange',done);signal?.removeEventListener('abort',abort);resolve();};const abort=()=>{done();reject(fault('MODEL_HOST_CANCELLED'));};window.addEventListener('focus',done,{once:true});document.addEventListener('visibilitychange',done,{once:true});signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(done,250);});
 }
}
export function createHttpModelClient({readSnapshot,expectedCandidate,expectedSourceLock,provisionPreparations,onConsumed}){
 let mode='UNAVAILABLE',model_calls=0,in_flight=0,epoch=0,binding=null;
 const issued=new WeakMap(),jobs=new Map();
 const snapshot=(kind,actor)=>immutable(structuredClone(readSnapshot(kind,actor)));
 function alive(s,kind,actor,signal,generation){if(signal?.aborted)throw fault('MODEL_HOST_CANCELLED');if(generation!==epoch||canonical(snapshot(kind,actor))!==canonical(s))throw fault('MODEL_HOST_STALE');}
 async function initialize(){try{const response=await apiFetch('/model/status');const dto=strictJSONParse(await response.text());if(!response.ok||dto.candidate_id!==expectedCandidate||dto.source_lock_sha256!==expectedSourceLock||dto.model!=='deepseek-v4-flash')throw fault('MODEL_HOST_SOURCE_BINDING');binding=dto;mode=dto.mode;model_calls=dto.model_calls;return status();}catch{mode='UNAVAILABLE';return status();}}
 async function request({kind,actor_id,signal}={}){
  if(mode!=='MODEL_TEXT'||!binding)throw fault('MODEL_HOST_UNAVAILABLE');
  if(!['PLAYER','NPC'].includes(kind)||kind==='PLAYER'&&actor_id!=='player'||kind==='NPC'&&!['lin','officer'].includes(actor_id))throw fault('MODEL_HOST_REQUEST_INVALID');
  const sealed=snapshot(kind,actor_id),generation=epoch,key=canonical([kind,actor_id,sealed.request.session_id,sealed.request.request_id,sealed.request.request_revision]),bytes=canonical(sealed);
  alive(sealed,kind,actor_id,signal,generation);const old=jobs.get(key);if(old){if(old.bytes!==bytes)throw fault('MODEL_HOST_DUPLICATE_CONFLICT');return old.promise;}
  const nonce=crypto.randomUUID();
  const promise=(async()=>{in_flight++;try{
   const response=await apiFetch('/model/request',{method:'POST',signal,headers:{'content-type':'application/json'},body:JSON.stringify({kind,actor_id,snapshot:sealed,request_nonce:nonce,window_id:binding.window_id,candidate_id:expectedCandidate,source_lock_sha256:expectedSourceLock})});
   const dto=strictJSONParse(await response.text(),1048576);if(Number.isInteger(dto.model_calls))model_calls=dto.model_calls;if(!response.ok)throw fault(dto.error_code??'MODEL_HOST_FAILED');
   // Keep a finished model response while the player is away; foreground
   // restoration must happen before current-state validation or admission.
   await awaitForeground(signal);alive(sealed,kind,actor_id,signal,generation);
   const checksum={...dto};delete checksum.result_sha256;
   if(dto.result_sha256!==await digest(canonical(checksum))||dto.origin!=='MODEL_TEXT'||dto.candidate_id!==expectedCandidate||dto.source_lock_sha256!==expectedSourceLock||dto.window_id!==binding.window_id||dto.request_nonce!==nonce||canonical(dto.snapshot)!==bytes)throw fault('MODEL_HOST_SOURCE_BINDING');
   if(!['deepseek-v4-flash','deepseek-v4-flash-0731'].includes(dto.actual_model)||dto.stop_reason!=='end_turn'||dto.raw_response_sha256!==await digest(dto.raw_response))throw fault('MODEL_HOST_RESPONSE_INVALID');
   const raw=strictJSONParse(dto.raw_response,262144),parsed=strictJSONParse(raw.content.filter(x=>x.type==='text').map(x=>x.text).join(''),262144);
   if(raw.model!==dto.actual_model||raw.stop_reason!=='end_turn')throw fault('MODEL_HOST_RESPONSE_INVALID');
   if(kind==='PLAYER'&&(parsed.kind!=='FP_COMPLETE_PLAN_R01'||canonical(parsed.request)!==canonical(sealed.request)||canonical(parsed)!==canonical(dto.wrapper)))throw fault('MODEL_HOST_DECISION_INVALID');
   if(kind==='NPC'&&(!finiteNPCDecision(parsed,{actor_id,...sealed})||canonical(parsed)!==canonical(dto.decision)))throw fault('MODEL_HOST_DECISION_INVALID');
   const result=immutable({kind,actor_id,...sealed,...(kind==='PLAYER'?{wrapper:parsed}:{decision:parsed}),origin:'MODEL_TEXT',bindings:{request_nonce:nonce,job_id:dto.job_id}});issued.set(result,{sealed,kind,actor_id,signal,generation,bytes:canonical(result),consumed:false});return result;
  }finally{in_flight--;}})();jobs.set(key,{bytes,promise});return promise;
 }
 function validate(result){try{const x=issued.get(result);if(!x||canonical(result)!==x.bytes)return false;alive(x.sealed,x.kind,x.actor_id,x.signal,x.generation);return true;}catch{return false;}}
 function consume(result){const x=issued.get(result);if(!validate(result)||x.consumed)throw fault('MODEL_HOST_CAPABILITY_INVALID');x.consumed=true;if(result.kind==='PLAYER')onConsumed?.({request:result.request,wrapper:result.wrapper,bindings:result.bindings});return result;}
 function status(){return Object.freeze({mode,model_calls,model_calls_status:in_flight?'AWAITING_SERVER_RECEIPT':'SERVER_CONFIRMED',fake_calls:0,in_flight,http_requests:model_calls,canary_used:false,test_only:false,evidence_origin:mode==='MODEL_TEXT'?'MODEL_TEXT':'UNAVAILABLE'});}
 // The previous owner-only canary preparer is retained as unavailable; normal
 // player commands use the same closed executor through the live transport.
 provisionPreparations?.(Object.freeze({invalidate(){epoch++;},preparePLAYER(){throw fault('MODEL_HOST_PREPARATION_UNAVAILABLE');},inspect(){throw fault('MODEL_HOST_PREPARATION_UNAVAILABLE');},arm(){throw fault('MODEL_HOST_PREPARATION_UNAVAILABLE');}}));
 return Object.freeze({request,validate,consume,status,initialize,readSnapshot:snapshot});
}
