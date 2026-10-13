import {revisionKey} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story/executor/plan-validator.mjs';
import {canonical} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story/executor/event-store.mjs';

// This function is provisioned once by the host. Its enqueue closure references
// a private scheduler method; JSON, sidecar conformance, and hashes cannot mint it.
export function createTrustedResponseEntry({context,registry,resolveParent,resolveObservation,resolveActor,resolveEvent,isCancelled,responseAllowed,enqueue}) {
 for(const fn of [resolveParent,resolveObservation,resolveActor,resolveEvent,isCancelled,responseAllowed,enqueue])if(typeof fn!=='function')throw Error('TRUSTED_HOST_RESOLVERS_REQUIRED');
 const issued=new Map();
 const check=proposal=>{
  const errors=[];
  if(!proposal||typeof proposal!=='object')return {ok:false,errors:['RESPONSE_PROPOSAL_REQUIRED']};
  if(responseAllowed(proposal)!==true)errors.push('RESPONSE_ADMISSION_BLOCKED');
  if(proposal.origin!=='AUTHORED_LOCAL')errors.push('ORIGIN_NOT_AUTHORED_LOCAL');
  if(typeof proposal.text!=='string'||![...proposal.text].length||[...proposal.text].length>500)errors.push('RESPONSE_TEXT_REQUIRED');
  const found=resolveParent(proposal.parent_request_id,proposal.parent_request_revision),parent=found?.request??found;
  const actor=resolveActor(proposal.actor_id);
  if(!parent||parent.actor_id!=='player'||parent.request_id!==proposal.parent_request_id||parent.request_revision!==proposal.parent_request_revision)errors.push('PARENT_NOT_OBSERVED');
  if(parent&&['session_id','scene_binding_id','scene_fingerprint'].some(key=>parent[key]!==context[key]))errors.push('PARENT_BINDING_MISMATCH');
  if(!['lin','officer'].includes(proposal.actor_id)||!context.actors.includes(proposal.actor_id)||!actor||actor.exists===false)errors.push('ACTOR_NOT_BOUND');
  if(proposal.scene_id!==(context.story_scene_id??context.scene_binding_id))errors.push('STALE:scene');
  if(proposal.source_world_version!==context.world_version)errors.push('STALE:world_version');
  if(!Number.isSafeInteger(proposal.actor_revision)||proposal.actor_revision!==actor?.actor_revision)errors.push('STALE:actor_revision');
  if(!Number.isSafeInteger(proposal.persona_revision)||proposal.persona_revision!==actor?.persona_revision)errors.push('STALE:persona_revision');
  const receiver=resolveActor(proposal.audience_id);
  if(!['player','lin','officer'].includes(proposal.audience_id)||!context.actors.includes(proposal.audience_id)||!receiver||receiver.exists===false)errors.push('RECEIVER_NOT_BOUND');
  if(parent&&(context.cancelled?.has(revisionKey(parent))||isCancelled(proposal,parent)))errors.push('CANCELLED_OR_SUPERSEDED_PARENT');
  if(!Array.isArray(proposal.observation_ids)||!proposal.observation_ids.length||new Set(proposal.observation_ids).size!==proposal.observation_ids.length)errors.push('OBSERVATION_REQUIRED');
  for(const id of Array.isArray(proposal.observation_ids)?proposal.observation_ids:[]){
   const receipt=resolveObservation(id),event=receipt?.source_event_id&&resolveEvent(receipt.source_event_id);
   if(receipt?.source_request_id!==proposal.parent_request_id||receipt?.source_step_id!==event?.step_id)errors.push('OBSERVATION_SOURCE_MISMATCH:'+id);
   if(!receipt||receipt.scene_id!==proposal.scene_id||receipt.complete!==true||typeof receipt.text!=='string'||!receipt.text.length||typeof receipt.channel_id!=='string'||!receipt.channel_id||!receipt.recipient_ids?.includes(proposal.actor_id)||receipt.range_start!==0||receipt.range_end!==[...(receipt.text??'')].length||!event||event.committed!==true||event.type!=='dialogue_presented'||event.actor_id!==receipt.speaker_id||event.target_id!==receipt.actor_id||event.scene_binding_id!==context.scene_binding_id||event.session_id!==context.session_id||event.proof.receipt_id!==id||event.proof.content_hash!==receipt.content_hash||event.proof.text!==receipt.text||event.proof.audience_id!==receipt.actor_id||event.proof.complete!==true||event.proof.range_start!==receipt.range_start||event.proof.range_end!==receipt.range_end||event.request_id!==proposal.parent_request_id||event.request_revision!==proposal.parent_request_revision)errors.push('OBSERVATION_NOT_TRUSTED:'+id);
   if(proposal.privacy_required===true&&(!receipt?.privacy_verified||receipt.recipient_ids.length!==1))errors.push('PRIVACY_NOT_VERIFIED:'+id);
  }
  if(typeof proposal.id!=='string'||!proposal.id.length||proposal.id.length>100)errors.push('PROPOSAL_ID');
  const capability=registry.get('speech.say');
  if(!capability?.enabled||!capability.actors.includes(proposal.actor_id))errors.push('ENGINE_UNSUPPORTED:speech.say');
  return {ok:!errors.length,errors,parent};
 };
 return Object.freeze({submit(proposal){
  const immutable=structuredClone(proposal),key=immutable?.actor_id+'|'+immutable?.id,serial=canonical(immutable),prior=issued.get(key);
  if(prior)return prior.serial===serial?{...prior.result,duplicate:true}:{ok:false,errors:['REVISION_PAYLOAD_MISMATCH']};
  const result=check(immutable);if(!result.ok)return result;
  const request=structuredClone(result.parent),plan={};
  for(const key of ['design_contract_id','session_id','request_id','request_revision'])plan[key]=request[key];
  for(const key of ['candidate_id','scene_binding_id','scene_fingerprint','capability_snapshot_id','policy_snapshot_id','knowledge_snapshot_id'])plan[key]=context[key];
  Object.assign(plan,{plan_id:'STORY-RESPONSE-'+immutable.id,source_world_version:immutable.source_world_version,decision:'ALLOW',public_reason:'AUTHORED_LOCAL NPC text response',intent_units:[],clarification:null,denial_response:[],horizon_s:30});
  const step={id:'response-'+immutable.id,intent_unit_id:'internal-parent-observation',kind:'RESPONSE',primitive_id:'speech.say',actor_id:immutable.actor_id,target_id:immutable.audience_id,parameters:{text:immutable.text,audience_id:immutable.audience_id,content_ref:immutable.content_ref??null},depends_on:[],resource_claims:[],preconditions:[],expected_events:['dialogue_presented'],max_duration_s:30,cancel_point:'BEFORE_START',camera_intent:'FP_READ'};
  step.resource_claims=registry.claims(step);plan.steps=[step];
  const submitted=enqueue(request,plan,()=>check(immutable),'trusted|'+revisionKey(request)+'|'+immutable.actor_id+'|'+immutable.id,immutable);
  if(submitted.ok)issued.set(key,{serial,result:submitted});return submitted;
 }});
}
