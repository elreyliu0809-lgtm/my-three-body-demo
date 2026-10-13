import {validateSchema} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/schema-validation.mjs';
import {overlaps} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/resources.mjs';
export const revisionKey=r=>r.session_id+'|'+r.request_id+'|'+r.request_revision;
export function validatePlan(plan,request,context,contract,registry){
 const errors=[...validateSchema(request,contract.schemas.input_request,'request'),...validateSchema(plan,contract.schemas.model_plan,'plan')];
 if(errors.length)return {ok:false,errors};
 for(const key of ['design_contract_id','session_id','request_id','request_revision','source_world_version','scene_binding_id','scene_fingerprint','capability_snapshot_id','policy_snapshot_id','knowledge_snapshot_id'])if(plan[key]!==request[key])errors.push('IDENTITY:'+key);
 if(plan.candidate_id!==context.candidate_id)errors.push('IDENTITY:candidate_id');
 if(context.session_id&&request.session_id!==context.session_id)errors.push('IDENTITY:bound_session');
 for(const key of ['scene_binding_id','scene_fingerprint','capability_snapshot_id','policy_snapshot_id','knowledge_snapshot_id'])if(plan[key]!==context[key])errors.push('STALE:'+key);
 if(plan.source_world_version!==context.world_version)errors.push('STALE:world_version');
 if(context.cancelled?.has(revisionKey(plan)))errors.push('CANCELLED_REVISION');
 if(request.actor_id!=='player'||!context.actors.includes(request.actor_id))errors.push('REQUEST_ACTOR');
 const units=new Map(),steps=new Map();
 for(const u of plan.intent_units){if(units.has(u.id))errors.push('DUPLICATE_UNIT');units.set(u.id,u);if(u.raw_span.end_codepoint>[...request.raw_text].length||u.raw_span.start_codepoint>=u.raw_span.end_codepoint)errors.push('RAW_SPAN');if(!context.actors.includes(u.actor_id)||u.actor_id!==request.actor_id)errors.push('UNIT_ACTOR');if(u.target_id!==null&&!context.entities.includes(u.target_id))errors.push('UNIT_TARGET');if(u.world.status==='DENY'&&(!u.world.rule_refs.length||u.world.rule_refs.some(r=>!context.adopted_rules.includes(r))))errors.push('UNADOPTED_RULE');}
 for(const s of plan.steps){if(steps.has(s.id))errors.push('DUPLICATE_STEP');steps.set(s.id,s);const u=units.get(s.intent_unit_id),p=registry.get(s.primitive_id);
  if(!u)errors.push('UNKNOWN_UNIT');
  else if(s.kind==='ACTION'&&(u.decision!=='ALLOW'||u.world.status!=='ALLOW'||u.capability.status!=='READY'||u.polarity!=='AFFIRMATIVE'||u.tense!=='PRESENT'||['HYPOTHESIS','REPORTED_SPEECH'].includes(u.kind)||u.conditions.some(c=>c.satisfied!==true||!c.evidence_ref||!context.evidence_refs.includes(c.evidence_ref))))errors.push('GUARDED_UNIT:'+u.id);
  if(s.kind==='RESPONSE')errors.push('RESPONSE_ADAPTER_DISABLED');
  if(!p?.enabled||!p.actors.includes(s.actor_id))errors.push('ENGINE_UNSUPPORTED:'+s.primitive_id);
  if(p)errors.push(...validateSchema(s.parameters,p.parameters_schema,'parameters:'+s.id));
  if(s.actor_id!==u?.actor_id||!context.actors.includes(s.actor_id))errors.push('STEP_ACTOR');
  if(s.kind==='ACTION'&&s.target_id!==u?.target_id)errors.push('INTENT_TARGET_MISMATCH');
  if(['face.target','gesture.perform','contact.attempt'].includes(s.primitive_id)&&s.parameters.target_id!==s.target_id)errors.push('PARAMETER_TARGET_MISMATCH');
  if(s.target_id!==null&&!context.entities.includes(s.target_id))errors.push('STEP_TARGET');
  for(const [k,v]of Object.entries(s.parameters))if(k.endsWith('_id')&&['target_id','heading_target_id','surface_id'].includes(k)&&v!==null&&!context.entities.includes(v))errors.push('PARAMETER_ENTITY:'+k);
  const required=registry.claims(s);if(required.length!==s.resource_claims.length||new Set(s.resource_claims).size!==s.resource_claims.length||required.some(c=>!s.resource_claims.includes(c)))errors.push('RESOURCE_CLAIMS:'+s.id);
  if(s.preconditions.some(p=>!context.predicates.includes(p.predicate_id)))errors.push('UNKNOWN_PRECONDITION');
  if(s.parameters.anchor_id&&!context.anchors.includes(s.parameters.anchor_id))errors.push('UNKNOWN_ANCHOR');
  if(s.primitive_id==='gesture.perform'&&(!context.gestures.includes(s.parameters.gesture_id)||s.parameters.intensity!==1))errors.push('GESTURE_PARAMETER_UNSUPPORTED');
  if(s.primitive_id==='dance.perform'&&(s.parameters.phrase_id!=='dance_loop'||s.parameters.tempo_scale!==1||s.parameters.heading_target_id!==null))errors.push('DANCE_PARAMETER_UNSUPPORTED');
 }
 function dag(map,label){const visiting=new Set(),done=new Set();function visit(id){if(visiting.has(id)){errors.push('DAG_CYCLE:'+label);return;}if(done.has(id))return;const x=map.get(id);if(!x){errors.push('MISSING_DEPENDENCY:'+label);return;}visiting.add(id);for(const d of x.depends_on)visit(d);visiting.delete(id);done.add(id);}for(const id of map.keys())visit(id);}
 dag(units,'units');dag(steps,'steps');
 function ancestor(a,b,seen=new Set()){if(seen.has(b))return false;seen.add(b);const deps=steps.get(b)?.depends_on??[];return deps.includes(a)||deps.some(d=>ancestor(a,d,seen));}
 for(const s of plan.steps){for(const ud of units.get(s.intent_unit_id)?.depends_on??[]){const predecessors=plan.steps.filter(x=>x.intent_unit_id===ud);if(!predecessors.length||predecessors.some(x=>!ancestor(x.id,s.id)))errors.push('UNIT_ORDER:'+s.id);}}
 for(let i=0;i<plan.steps.length;i++)for(let k=i+1;k<plan.steps.length;k++){const a=plan.steps[i],b=plan.steps[k];if(!ancestor(a.id,b.id)&&!ancestor(b.id,a.id)&&a.resource_claims.some(x=>b.resource_claims.some(y=>overlaps(x,y))))errors.push('UNORDERED_RESOURCE_CONFLICT:'+a.id+':'+b.id);}
 if(plan.decision==='NEEDS_CLARIFICATION'&&(!plan.clarification||plan.steps.length))errors.push('CLARIFICATION_MOTION');
 if(plan.decision!=='MIXED'&&plan.intent_units.some(u=>u.decision!==plan.decision))errors.push('DECISION_AXIS');
 if(plan.decision==='ALLOW'&&!plan.steps.length)errors.push('EMPTY_ALLOW');
 for(const u of plan.intent_units)if(u.decision==='WORLD_DENIED'&&u.world.status!=='DENY'||u.decision==='ALLOW'&&(u.world.status!=='ALLOW'||u.capability.status!=='READY'))errors.push('OUTCOME_AXES');
 const duration=new Map();function span(id,seen=new Set()){if(seen.has(id))return Infinity;seen.add(id);const s=steps.get(id);if(!s)return 0;return s.max_duration_s+Math.max(0,...s.depends_on.map(d=>span(d,new Set(seen))));}
 for(const s of plan.steps)duration.set(s.id,span(s.id));if(Math.max(0,...duration.values())>plan.horizon_s)errors.push('HORIZON_TOO_SHORT');
 return {ok:errors.length===0,errors};
}
