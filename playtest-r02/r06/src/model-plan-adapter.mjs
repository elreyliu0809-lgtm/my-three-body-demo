import {validateSchema} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/schema-validation.mjs';
import {validatePlan} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/plan-validator.mjs';
import {canonical} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/event-store.mjs';
// Complete wire plans only. Never infer an action from text or synthesize missing fields.
export function acceptWrapper(wrapper,{request,context,contract,registry}) {
 const keys=Object.keys(wrapper??{}).sort().join(',');
 if(keys!=='kind,plan,request'||wrapper.kind!=='FP_COMPLETE_PLAN_R01')return {ok:false,errors:['STRICT_WRAPPER_REQUIRED']};
 if(canonical(wrapper.request)!==canonical(request))return {ok:false,errors:['IMMUTABLE_REQUEST_MISMATCH']};
 const errors=[...validateSchema(wrapper.request,contract.schemas.input_request),...validateSchema(wrapper.plan,contract.schemas.model_plan)];
 if(errors.length)return {ok:false,errors};
 const result=validatePlan(wrapper.plan,request,context,contract,registry);
 return result.ok?{ok:true,request:structuredClone(request),plan:structuredClone(wrapper.plan)}:result;
}
export function createRequest(text,context,{request_id,revision=1,transform_revision=0,consent=false}={}){
 if(typeof text!=='string'||![...text].length||[...text].length>500)throw Error('INPUT_LENGTH');
 return {design_contract_id:'FP-PERFORMANCE-R01',session_id:context.session_id,request_id:request_id??crypto.randomUUID(),request_revision:revision,actor_id:'player',raw_text:text,input_source:'TEXT',source_world_version:context.world_version,scene_binding_id:context.scene_binding_id,scene_fingerprint:context.scene_fingerprint,capability_snapshot_id:context.capability_snapshot_id,policy_snapshot_id:context.policy_snapshot_id,knowledge_snapshot_id:context.knowledge_snapshot_id,actor_transform_revision:transform_revision,target_hint_id:null,explicit_application_consent:consent};
}
