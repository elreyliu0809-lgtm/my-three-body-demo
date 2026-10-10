export function initialState(){return {schema_version:1,world_version:0,application:'not_submitted',screening:'not_started',admission:'not_decided',duty:'not_started',playerBenefits:false,companionBenefits:false,position:'floor',completedJumps:0,events:[]};}
export function commitEvent(before,event){
 if(event.request_id&&before.events.some(e=>e.request_id===event.request_id&&e.type===event.type))return structuredClone(before);
 if(event.source_world_version!==undefined&&event.source_world_version!==before.world_version)throw Error('Stale world proposal');
 const s=structuredClone(before);
 switch(event.type){
  case 'application_submitted':if(s.application==='submitted')return s;s.application='submitted';s.screening='pending';break;
  case 'counter_landing_stable':if(!event.proof?.stable||!Number.isFinite(event.proof.feet_y)||!Number.isFinite(event.proof.tabletop_y)||Math.abs(event.proof.feet_y-event.proof.tabletop_y)>.01)throw Error('Unproven landing');s.position='on_counter';s.completedJumps++;break;
  case 'body_settled':if(!event.proof?.stable)throw Error('Unproven body settlement');s.position=event.position;break;
  default:throw Error('No authorized state transition: '+event.type);
 }
 s.world_version++;s.events.push({...structuredClone(event),world_version:s.world_version});s.events=s.events.slice(-20);return s;
}
export function restoreState(value){
 const s=initialState();if(!value||value.schema_version!==1)return s;
 if(value.application==='submitted'){s.application='submitted';s.screening='pending';}
 return s; // Placement/action completion is never restored without physical revalidation.
}
