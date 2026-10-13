import {validateSchema} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/schema-validation.mjs';
import {canonical,payloadHash} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story/executor/event-store.mjs';
import {sha256} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story/actor-runtime.mjs';

export const SEMANTIC_SOURCE = Object.freeze({candidate_id:'MT_GENERATED_STORY_SEMANTICS_R02_20261012',manifest_sha256:'A96CAB7D655DEE7864151346B29C8D53CC4C9B2A8BB4E6CB946429EF84A271ED',contract_sha256:'7A9FA48F78C9BAC6DE891951E4B76DDD575D9803E679E084FF40EADA7D77C150',selected_policy:'NONE',adopted:false});
export function validUnicode(text){return typeof text==='string'&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text);}
export function validateSpans(text,clauses){if(!validUnicode(text))return ['CONTENT_BINDING_MISMATCH'];const cp=[...text];return (Array.isArray(clauses)?clauses:[]).some(c=>!Number.isSafeInteger(c.start_codepoint)||!Number.isSafeInteger(c.end_codepoint)||c.start_codepoint<0||c.end_codepoint<=c.start_codepoint||c.end_codepoint>cp.length||cp.slice(c.start_codepoint,c.end_codepoint).join('')!==c.exact_text)?['SPAN_INVALID']:[];}
const refusal=(id,reasons,status='OPEN_UNVERIFIED')=>Object.freeze({status,proposal_id:id??null,candidate_semantics:[],join_refs:[],reason_codes:[...new Set(reasons)].slice(0,32),world_write_count:0,execution_replay_count:0,semantic_projection_revision:0});
const currentKeys=['candidate_id','session_id','scene_binding_id','scene_fingerprint','knowledge_snapshot_id','policy_snapshot_id','capability_snapshot_id'];

// This preparatory object has no semantic issuer, policy setter, world writer or
// grant method. A JSON policy (including B) cannot activate it.
export function createSemanticAdmission({contract,eventSchema,context,resolveReceipt,resolveEvent,readEvents,readActor,readCurrent,verifyProposal=()=>false}={}){
 const snapshots=new Map(),proposals=new Map(),lateRequests=new Map(),handles=new WeakMap();let capabilityEpoch=0;
 const schema=contract?.source_snapshot?.private_schemas?.semantic_proposal;
 const sourceBound=contract?.source_identity?.manifest_sha256===SEMANTIC_SOURCE.manifest_sha256&&contract?.source_identity?.contract_sha256===SEMANTIC_SOURCE.contract_sha256&&contract?.source_snapshot?.candidate_id===SEMANTIC_SOURCE.candidate_id;
 function verifyRead(event,receipt){
  const errors=[];const events=readEvents?.()??[],original=resolveEvent?.(event?.event_id);
  if(!original||canonical(original)!==canonical(event)||event?.committed!==true||event.type!=='dialogue_presented'||Object.keys(event).length!==22||event.proof?.observed!==true||(eventSchema&&validateSchema(event,eventSchema).length)||event.payload_hash!==payloadHash(event.proof))errors.push('EVENT_READER_UNTRUSTED');
  let expected=1;for(const e of events.filter(e=>e.execution_id===event?.execution_id)){if(e.event_sequence!==expected++)errors.push('SEQUENCE_GAP');}
  if(!events.some(e=>e.event_id===event?.event_id)||event?.event_sequence!==events.filter(e=>e.execution_id===event?.execution_id&&e.event_sequence<=event.event_sequence).length)errors.push('SEQUENCE_GAP');
  if(!receipt||!validUnicode(receipt.text)||receipt.complete!==true||receipt.range_start!==0||receipt.range_end!==[...(receipt.text??'')].length||receipt.full_range_end!==receipt.range_end)errors.push('PARTIAL_READ');
  if(receipt&&(receipt.source_event_id!==event?.event_id||receipt.source_request_id!==event?.request_id||receipt.source_step_id!==event?.step_id||receipt.speaker_id!==event?.actor_id||receipt.actor_id!==event?.target_id||receipt.content_hash!==event?.proof?.content_hash||receipt.text!==event?.proof?.text||event?.proof?.receipt_id!==receipt.id||event?.proof?.complete!==true||event?.proof?.range_start!==0||event?.proof?.range_end!==receipt.range_end||event?.proof?.audience_id!==receipt.actor_id))errors.push('CONTENT_BINDING_MISMATCH');
  if(!receipt?.channel_id||receipt.delivery!=='ADDRESSED_TEXT_READ'||!Array.isArray(receipt.recipient_ids)||!receipt.recipient_ids.includes(receipt.actor_id)||receipt.recipient_ids.some(id=>readActor?.(id)?.bound!==true))errors.push('CHANNEL_UNVERIFIED');
  if(currentKeys.slice(0,4).some(k=>event?.[k]!==context?.[k])||receipt?.scene_id!==context?.story_scene_id)errors.push('STALE_BINDING');
  return [...new Set(errors)];
 }
 async function recordEvent(event,{request,plan,actor_versions,cancel_epoch=0,knowledge=[],persona_mapping=null}={}){
  const receipt=resolveReceipt?.(event?.proof?.receipt_id),errors=verifyRead(event,receipt);
  if(receipt&&await sha256(receipt.text)!==receipt.content_hash)errors.push('CONTENT_BINDING_MISMATCH');
  if(!request||!plan||currentKeys.some(k=>plan?.[k]!==request?.[k]&&k!=='candidate_id')||plan.candidate_id!==context?.candidate_id||request.request_id!==event?.request_id||request.request_revision!==event?.request_revision||plan.plan_id==null||plan.request_id!==request.request_id||plan.request_revision!==request.request_revision||plan.session_id!==event?.session_id||plan.candidate_id!==event?.candidate_id)errors.push('STALE_BINDING');
  if(errors.length)return refusal(null,errors,'OPEN_UNAVAILABLE');
  const value=structuredClone({event,receipt,request,plan,actor_versions,cancel_epoch,knowledge,persona_mapping,context:structuredClone(context)}),bytes=canonical(value),prior=snapshots.get(event.event_id);
  if(prior)return prior.bytes===bytes?{status:'EVENT_TIME_PREPARED',duplicate:true}:refusal(null,['SEMANTIC_ID_PAYLOAD_CONFLICT'],'CONFLICT');
  // Historical evidence is private and immutable; it is never serialized as a capability.
  snapshots.set(event.event_id,{bytes,value});return {status:'EVENT_TIME_PREPARED',semantic_projection_revision:0,world_write_count:0};
 }
 async function prepare(proposal){
  const id=proposal?.proposal_id,bytes=canonical(proposal),prior=proposals.get(id);
  if(prior&&prior.bytes!==bytes)return refusal(id,['SEMANTIC_ID_PAYLOAD_CONFLICT'],'CONFLICT');
  if(prior)return {...prior.result,duplicate:true};
  let reasons=[];if(!sourceBound||!schema)reasons.push('SOURCE_DRIFT');
  if(schema&&validateSchema(proposal,schema).length)reasons.push('PROPOSAL_SCHEMA_INVALID');
  if(!validUnicode(proposal?.original_text))reasons.push('CONTENT_BINDING_MISMATCH');
  reasons.push(...validateSpans(proposal?.original_text,proposal?.clauses));
  const b=proposal?.binding??{},now=readCurrent?.()??{};
  if(currentKeys.some(k=>b[k]!==context?.[k])||b.scene_instance_id!==context?.story_scene_id||b.request_id!==now.request?.request_id||b.request_revision!==now.request?.request_revision||b.source_world_version!==context?.world_version||b.cancel_epoch!==now.cancel_epoch||now.cancelled===true)reasons.push('STALE_BINDING');
  if(now.plan&&(b.plan_id!==now.plan.plan_id||b.plan_sha256!==await sha256(canonical(now.plan))||!now.plan.steps?.some(s=>s.id===b.step_id&&s.actor_id===b.speaker_actor_id)))reasons.push('STALE_BINDING');
  const actor=readActor?.(b.speaker_actor_id);if(!actor?.bound||b.actor_state_revision!==actor.actor_version)reasons.push('STALE_BINDING');
  // R04 content strings are not guessed from runtime integer persona versions.
  const mapping=now.persona_mapping;
  if(!mapping||mapping.ref!==b.persona_mapping_ref||mapping.actor_id!==b.speaker_actor_id||mapping.scene_instance_id!==b.scene_instance_id||mapping.persona_revision!==b.persona_revision||mapping.runtime_persona_version!==actor?.persona_version||mapping.runtime_actor_version!==actor?.actor_version||!mapping.source_sha256||!mapping.adoption_receipt)reasons.push('PERSONA_MAPPING_UNAVAILABLE');
  if(validUnicode(proposal?.original_text)&&await sha256(proposal.original_text)!==b.content_sha256)reasons.push('CONTENT_BINDING_MISMATCH');
  let provenance=false;try{provenance=verifyProposal(proposal)===true;}catch{}if(!provenance)reasons.push('SEMANTIC_CERTIFICATE_UNTRUSTED');
  reasons.push('SEMANTIC_POLICY_UNSELECTED','SEMANTIC_ISSUER_UNAVAILABLE');
  const result=refusal(id,reasons);if(typeof id==='string'&&id.length)proposals.set(id,{bytes,result});
  const handle=Object.freeze({proposal_id:id??null});handles.set(handle,{bytes,result,epoch:capabilityEpoch});return {...result,prepared_handle:handle};
 }
 function lateJoin(input){
  const key=input?.proposal_id+'|'+input?.source_event_id,bytes=canonical(input),prior=lateRequests.get(key);
  if(prior&&prior.bytes!==bytes)return refusal(input?.proposal_id,['SEMANTIC_ID_PAYLOAD_CONFLICT'],'CONFLICT');
  if(prior)return {...prior.result,duplicate:true};
  const snapshot=snapshots.get(input?.source_event_id);
  if(!snapshot)return refusal(input?.proposal_id,['HISTORICAL_READER_UNAVAILABLE','SEMANTIC_POLICY_UNSELECTED'],'OPEN_UNAVAILABLE');
  const original=resolveEvent?.(input.source_event_id),receipt=resolveReceipt?.(snapshot.value.receipt.id);
  if(!original||!receipt||canonical(original)!==canonical(snapshot.value.event)||canonical(receipt)!==canonical(snapshot.value.receipt))return refusal(input?.proposal_id,['EVENT_READER_UNTRUSTED','SEMANTIC_POLICY_UNSELECTED'],'OPEN_UNAVAILABLE');
  const result=refusal(input?.proposal_id,['SEMANTIC_POLICY_UNSELECTED','SEMANTIC_ISSUER_UNAVAILABLE']);lateRequests.set(key,{bytes,result});return result;
 }
 return Object.freeze({recordEvent,prepare,lateJoin,resolveTrustedRecord:()=>refusal(null,['TRUSTED_RECORD_READER_UNAVAILABLE'],'OPEN_UNAVAILABLE'),validateHandle:h=>handles.get(h)?.epoch===capabilityEpoch,status:()=>({selected_policy:'NONE',adopted:false,event_time_snapshots:snapshots.size,semantic_projection_revision:0,admitted_joins:0}),effectiveObservations:observations=>structuredClone(observations).map(r=>r.origin==='AUTHORED_LOCAL'?r:{...r,semantic:null,privacy_verified:false}),restore:()=>{capabilityEpoch++;snapshots.clear();return refusal(null,['UNKNOWN_RESTORE_AUTHORITY'],'UNKNOWN');}});
}
