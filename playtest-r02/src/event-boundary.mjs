import {canonical,payloadHash} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/event-store.mjs';
import {validateSchema} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/schema-validation.mjs';
// Read projection of the private C02 committer, never a second world writer.
export class EventBoundary {
 #read;#ids=new Map();#orders=new Map();#events=[];
 constructor({readEvents,context,schema}){this.#read=readEvents;this.context=context;this.schema=schema;this.cursor=0;this.world_version=0;this.position='floor';this.completedJumps=0;this.application='not_submitted';this.screening='not_started';}
 verify(e){
  let found=false,page,cursor=0;do{page=this.#read({after_cursor:cursor,limit:256});found=page.events.some(x=>canonical(x)===canonical(e));cursor=page.next_cursor;}while(!found&&cursor<page.through_cursor);
  if(!found)throw Error('NOT_COMMITTED_BY_BOUND_EXECUTOR');
  const errors=validateSchema(e,this.schema);if(errors.length)throw Error('EVENT_SCHEMA:'+errors.join(';'));
  for(const k of ['candidate_id','scene_binding_id','scene_fingerprint','session_id'])if(e[k]!==this.context[k])throw Error('EVENT_BINDING:'+k);
  if(e.committed!==true||e.source_executor_id!=='CM-C02-EXECUTOR-R02'||payloadHash(e.proof)!==e.payload_hash)throw Error('EVENT_AUTHORITY');
  const identity=e.execution_id+'|'+e.step_id+'|'+e.event_sequence,serial=canonical(e),old=this.#ids.get(e.event_id)??this.#ids.get(identity);
  if(old){if(old!==serial)throw Error('EVENT_PAYLOAD_MISMATCH');return {duplicate:true};}
  if(e.event_sequence!==(this.#orders.get(e.execution_id)??0)+1)throw Error('EVENT_PREDECESSOR');
  if(e.source_world_version!==this.world_version)throw Error('EVENT_CAS');
  const p=e.proof,supported=p.support_verified===true&&Number.isFinite(p.foot_error_m)&&p.foot_error_m>=0&&p.foot_error_m<=.005&&Number.isFinite(p.stable_s)&&p.stable_s>=.25;
  if(e.type==='counter_landing_stable'&&(!supported||p.support_id!=='counter_top_proxy'||p.binding_id!==this.context.scene_binding_id||p.cancelled!==false))throw Error('COUNTER_PROOF');
  if(e.type==='body_settled'&&(!supported||typeof p.cancelled!=='boolean'))throw Error('SETTLEMENT_PROOF');
  // No trusted receipt receiver in this candidate. Even consent=true alone is insufficient.
  if(['application_submitted','application_received','prevention_observed','terms_read_or_explained','object_inspected'].includes(e.type))throw Error('RECEIVER_DISABLED');
  const semantic=['body_action_completed','body_settled','counter_landing_stable','dialogue_presented'].includes(e.type);
  if(e.result_world_version!==this.world_version+Number(semantic))throw Error('EVENT_RESULT_VERSION');
  this.world_version=e.result_world_version;
  if(e.type==='counter_landing_stable'){this.position='on_counter';this.completedJumps++;}
  if(e.type==='body_settled')this.position=p.support_id==='floor'?'floor':'on_counter';
  this.#orders.set(e.execution_id,e.event_sequence);this.#ids.set(identity,serial);this.#ids.set(e.event_id,serial);this.#events.push(structuredClone(e));return {duplicate:false};
 }
 sync(){let result;do{result=this.#read({after_cursor:this.cursor,limit:128});for(const e of result.events)this.verify(e);this.cursor=result.next_cursor;}while(this.cursor<result.through_cursor);return this.snapshot();}
 snapshot(){return {world_version:this.world_version,position:this.position,completedJumps:this.completedJumps,application:this.application,screening:this.screening,admission:'not_decided',benefits:false,companionBenefits:false,events:structuredClone(this.#events),npc_projection:'PROJECTION_PENDING',npc_observation:'NOT_IMPLEMENTED'};}
}
