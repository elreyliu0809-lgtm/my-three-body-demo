import {validateSchema} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/schema-validation.mjs';
export function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
// Non-cryptographic transport checksum. Trust is the private writer token, not this checksum.
export function payloadHash(x){let h=2166136261;for(const c of canonical(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return 'fnv1a32:'+((h>>>0).toString(16).padStart(8,'0'));}
export class EventStore {
 #token;#events=[];#ids=new Map();#orders=new Map();
 constructor({token,schema,context}){this.#token=token;this.schema=schema;this.context=context;this.world_version=context.world_version;this.facts={application_status:'unchanged',screening_status:'unchanged',admission:'unchanged',benefits:'unchanged',companion:'unchanged'};}
 commit(token,e){
  if(token!==this.#token)throw Error('UNTRUSTED_EVENT_SOURCE');
  const errors=validateSchema(e,this.schema);if(errors.length)throw Error(errors.join(';'));
  for(const k of ['candidate_id','scene_binding_id','scene_fingerprint'])if(e[k]!==this.context[k])throw Error('EVENT_BINDING_MISMATCH');
  if(e.source_executor_id!=='CM-C02-EXECUTOR-R02')throw Error('EXECUTOR_ID');
  const serial=canonical({...e,committed:false}),key=e.execution_id+':'+e.step_id+':'+e.event_sequence;
  const old=this.#ids.get(e.event_id)??this.#ids.get(key);
  if(old){if(old!==serial)throw Error('EVENT_PAYLOAD_MISMATCH');return {duplicate:true,world_version:this.world_version};}
  if(e.event_sequence!==(this.#orders.get(e.execution_id)??0)+1)throw Error('EVENT_PREDECESSOR_MISSING');
  if(e.source_world_version!==this.world_version)throw Error('EVENT_CAS_CONFLICT');
  if(e.payload_hash!==payloadHash(e.proof))throw Error('EVENT_HASH_MISMATCH');
  const p=e.proof;
  if(p.observed!==true||typeof p.adapter!=='string'||!p.adapter.length)throw Error('OBSERVATION_REQUIRED');
  const supported=p.support_verified===true&&Number.isFinite(p.foot_error_m)&&p.foot_error_m>=0&&p.foot_error_m<=.005&&Number.isFinite(p.stable_s)&&p.stable_s>=.25;
  if(e.type==='counter_landing_stable'&&(!supported||p.support_id!=='counter_top_proxy'||p.cancelled!==false||p.binding_id!==this.context.scene_binding_id))throw Error('COUNTER_PROOF_REQUIRED');
  if(e.type==='body_settled'&&!supported)throw Error('SETTLEMENT_PROOF_REQUIRED');
  if(['application_received','prevention_observed','terms_read_or_explained','object_inspected'].includes(e.type))throw Error('RECEIVER_OR_CONTACT_DISABLED');
  const semantic=['body_action_completed','counter_landing_stable','body_settled','dialogue_presented'].includes(e.type),next=this.world_version+Number(semantic);
  if(e.result_world_version!==next)throw Error('EVENT_RESULT_VERSION');
  this.world_version=next;this.context.world_version=next;
  if(semantic)this.facts[e.actor_id]={type:e.type,target_id:e.target_id,proof:structuredClone(p)};
  this.#orders.set(e.execution_id,e.event_sequence);this.#ids.set(e.event_id,serial);this.#ids.set(key,serial);this.#events.push(structuredClone({...e,committed:true}));
  return {duplicate:false,world_version:next};
 }
 snapshot(){return {world_version:this.world_version,facts:structuredClone(this.facts),events:structuredClone(this.#events)};}
 readEvents({after_cursor=0,limit=128}={}){
  if(!Number.isSafeInteger(after_cursor)||after_cursor<0||after_cursor>this.#events.length||!Number.isSafeInteger(limit)||limit<1||limit>256)throw Error('INVALID_LEDGER_CURSOR');
  const end=Math.min(this.#events.length,after_cursor+limit);return {after_cursor,next_cursor:end,through_cursor:this.#events.length,world_version:this.world_version,events:structuredClone(this.#events.slice(after_cursor,end))};
 }
 externalChange(){this.world_version++;this.context.world_version=this.world_version;}
}
