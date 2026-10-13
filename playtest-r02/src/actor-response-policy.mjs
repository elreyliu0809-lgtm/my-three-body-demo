const PHRASES={ACKNOWLEDGE:'我听到了你刚才说的话。',CLARIFY_REQUEST:'你希望我怎样回应刚才的话？',EXPLAIN_SELECTION_LIMITS:'选拔仍有明确的程序和限制，这段对话不代表获得录取。',DISCLOSE_APPLICATION_STATUS:'我曾申请过一次，目前没有被录取。',SET_PUBLIC_BOUNDARY:'请遵守这里的公开交流边界，这段对话不会改变申请或录取状态。'};
export function resolveActorResponse(consumed,{actor_id,reads,facts}){
 const fail=()=>{throw Error('ACTOR_RESPONSE_POLICY_REJECTED');};
 const d=consumed?.decision;
 if(consumed?.kind!=='NPC'||consumed.actor_id!==actor_id||!['lin','officer'].includes(actor_id)||!d||Object.keys(d).sort().join()!=='fact_refs,speech_act'||!Object.hasOwn(PHRASES,d.speech_act)||!Array.isArray(d.fact_refs)||d.fact_refs.length>16||new Set(d.fact_refs).size!==d.fact_refs.length||d.fact_refs.some(x=>typeof x!=='string'||!x.length||x.length>160))fail();
 const trusted=(reads??[]).filter(({receipt:r,event:e})=>r&&e&&r.complete===true&&r.recipient_ids?.includes(actor_id)&&r.source_event_id===e.event_id&&r.source_request_id===consumed.request?.request_id&&r.source_step_id===e.step_id&&e.request_revision===consumed.request?.request_revision&&e.session_id===consumed.request?.session_id&&e.committed===true&&e.type==='dialogue_presented'&&e.proof?.receipt_id===r.id&&e.proof.content_hash===r.content_hash&&e.proof.text===r.text&&e.proof.complete===true&&r.range_start===0&&r.range_end===[...r.text].length&&e.proof.range_start===r.range_start&&e.proof.range_end===r.range_end&&e.actor_id===r.speaker_id&&e.target_id===r.actor_id&&e.proof.audience_id===r.actor_id&&typeof r.channel_id==='string'&&r.channel_id.length);
 if(!trusted.length)fail();
 const permitted=new Set([...trusted.map(x=>x.receipt.id),...(facts??[])]);
 if(d.fact_refs.some(x=>!permitted.has(x)))fail();
 if(d.speech_act==='DISCLOSE_APPLICATION_STATUS'&&(actor_id!=='lin'||!consumed.actor?.private_facts?.includes('APPLIED_ONCE_NOT_ADMITTED')||!d.fact_refs.includes('E01')||!facts.includes('E01')))fail();
 if(d.speech_act==='EXPLAIN_SELECTION_LIMITS'&&(actor_id!=='officer'||consumed.actor?.baseline_receipt?.source_hash!=='A84F6E24FA7C6D398FF81F0284EA1584AE91A82147F9DD866382D78EB79C661F'))fail();
 if(d.speech_act==='SET_PUBLIC_BOUNDARY'&&(actor_id!=='lin'||!d.fact_refs.includes('E03')||!facts.includes('E03')||!facts.includes('E02')))fail();
 return {text:PHRASES[d.speech_act],audience_id:'player',recipient_ids:['player'],channel_id:'named:player',semantic:null,private_range_verified:false,observation_ids:trusted.map(x=>x.receipt.id)};
}
