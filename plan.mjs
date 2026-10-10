export const capability={schema:'scene-plan-v1',primitives:['move_to','face','say','read_notice','wait','jump_counter','leave_counter'],actors:['player','officer','companion'],limits:{steps:8,seconds:6,bounds:[-6,6,-6,8]},unsupported:['pickup','hand_over','combat','fly','new_animation','application_receipt','admission']};
export function validatePlan(p){
 p=structuredClone(p);if(Array.isArray(p?.steps))for(const s of p.steps){if(s?.op===undefined&&typeof s?.action==='string')s.op=s.action;else if(s?.action!==undefined&&s.action!==s.op)throw Error('AMBIGUOUS_OPERATION');}
 if(!p||p.schema!==capability.schema||!['allowed','world_forbidden','capability_missing'].includes(p.decision)||typeof p.explanation!=='string'||p.explanation.length>500||!Array.isArray(p.steps)||p.steps.length>8)throw Error('PLAN_SCHEMA_INVALID');
 if(p.decision!=='allowed'&&p.steps.length)throw Error('REFUSAL_HAS_ACTIONS');
 for(const s of p.steps){if(!s||!capability.primitives.includes(s.op))throw Error('ENGINE_CAPABILITY_MISSING');
  if(s.op==='move_to'&&(s.actor!=='player'||!Number.isFinite(s.x)||!Number.isFinite(s.z)||s.x<-6||s.x>6||s.z<-6||s.z>8))throw Error('WORLD_TARGET_INVALID');
  if(s.op==='face'&&(!capability.actors.includes(s.actor)||!capability.actors.includes(s.target)||s.actor===s.target))throw Error('ACTOR_INVALID');
  if(s.op==='say'&&(!capability.actors.includes(s.actor)||typeof s.text!=='string'||!s.text.trim()||s.text.length>200))throw Error('DIALOGUE_INVALID');
  if(s.op==='wait'&&(!Number.isFinite(s.seconds)||s.seconds<0||s.seconds>6))throw Error('WAIT_INVALID');
 }
 return structuredClone(p);
}
