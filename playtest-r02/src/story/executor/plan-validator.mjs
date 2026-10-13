import {validateSchema} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/schema-validation.mjs';
export {validatePlan,revisionKey} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/plan-validator.mjs';

// Internal host plan only. Not a relaxed model_plan schema. There is no invented
// NPC raw_span: the parent input is retained and RESPONSE has no intent unit.
export function validateTrustedResponsePlan(plan, request, context, contract, registry) {
 const errors=validateSchema(request,contract.schemas.input_request,'parent');
 if(request.actor_id!=='player')errors.push('PARENT_PLAYER_REQUIRED');
 for(const key of ['candidate_id','session_id','scene_binding_id','scene_fingerprint','capability_snapshot_id','policy_snapshot_id','knowledge_snapshot_id'])if(plan[key]!==context[key])errors.push('STALE:'+key);
 for(const key of ['design_contract_id','session_id','request_id','request_revision'])if(plan[key]!==request[key])errors.push('PARENT_IDENTITY:'+key);
 if(plan.source_world_version!==context.world_version)errors.push('STALE:world_version');
 if(plan.intent_units.length!==0||plan.steps.length!==1)errors.push('INTERNAL_RESPONSE_ONLY');
 const step=plan.steps[0];
 if(!step)return {ok:false,errors:[...errors,'RESPONSE_STEP_REQUIRED']};
 errors.push(...validateSchema(step,contract.schemas.model_plan.properties.steps.items,'response_step'));
 if(step.kind!=='RESPONSE'||step.primitive_id!=='speech.say'||!['lin','officer'].includes(step.actor_id)||!context.actors.includes(step.actor_id))errors.push('TRUSTED_SPEECH_ONLY');
 const capability=registry.get('speech.say');
 if(!capability?.enabled||!capability.actors.includes(step.actor_id))errors.push('ENGINE_UNSUPPORTED:speech.say');
 if(capability)errors.push(...validateSchema(step.parameters,capability.parameters_schema,'speech'));
 if(!context.entities.includes(step.target_id)||step.parameters.audience_id!==step.target_id)errors.push('NAMED_RECEIVER_REQUIRED');
 const claims=registry.claims(step);
 if(claims.length!==step.resource_claims.length||new Set(step.resource_claims).size!==claims.length||claims.some(x=>!step.resource_claims.includes(x)))errors.push('RESOURCE_CLAIMS');
 if(step.depends_on.length||step.preconditions.length||plan.horizon_s<step.max_duration_s)errors.push('INTERNAL_STEP_SHAPE');
 return {ok:!errors.length,errors};
}
