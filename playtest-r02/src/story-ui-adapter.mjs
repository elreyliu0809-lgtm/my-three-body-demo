import {projectUI} from '/my-three-body-demo/playtest-r02/src/ui-projection.mjs';
import {BRIDGE_VERSION,canCancelIntegrated} from '/my-three-body-demo/playtest-r02/src/story-command-adapter.mjs';
export {BRIDGE_VERSION};
export function projectIntegratedUI({runtime,host,scene,world}){
 const ui=projectUI({host,scene,world});ui.can_cancel=canCancelIntegrated(runtime,host);const events=runtime.executor.store.snapshot().events;
 const known_text=runtime.actors.context('player').observations.flatMap(r=>{
 const verified=runtime.text.resolveReceipt(r.id);if(!verified||JSON.stringify(verified)!==JSON.stringify(r))return [];
 const e=events.find(e=>e.event_id===r.source_event_id),p=e?.proof;
 if(!e||e.committed!==true||e.candidate_id!==host.context.candidate_id||e.scene_binding_id!==host.context.scene_binding_id||e.scene_fingerprint!==host.context.scene_fingerprint||e.session_id!==host.context.session_id||!['dialogue_presented','step_progress'].includes(e.type)||e.request_id!==r.source_request_id||e.step_id!==r.source_step_id||e.actor_id!==r.speaker_id||e.target_id!==r.actor_id||r.scene_id!==runtime.actors.scene_id||!r.recipient_ids?.includes('player')||p?.receipt_id!==r.id||p.content_hash!==r.content_hash||p.text!==r.text||p.complete!==r.complete||p.range_start!==r.range_start||p.range_end!==r.range_end||r.range_start!==0||r.range_end!==[...r.text].length||r.range_end>r.full_range_end||r.complete&&r.range_end!==r.full_range_end||r.source_request_revision!==undefined&&r.source_request_revision!==e.request_revision||r.source_execution_id!==undefined&&r.source_execution_id!==e.execution_id)return [];
 return [{receipt_id:r.id,speaker_id:r.speaker_id,text:r.text,complete:r.complete,source_request_id:e.request_id,source_request_revision:e.request_revision,source_step_id:e.step_id,source_event_id:e.event_id,execution_id:e.execution_id,scene_id:r.scene_id,channel_id:r.channel_id,recipient_ids:[...r.recipient_ids],content_hash:r.content_hash,range_start:r.range_start,range_end:r.range_end,full_range_end:r.full_range_end,origin:r.origin}];
 });
 const outcome=runtime.outcome?.snapshot?.()??runtime.outcomes?.snapshot?.();
 const observedSemantic=semantic=>known_text.some(k=>k.complete&&runtime.text.resolveReceipt(k.receipt_id)?.semantic===semantic);
 const public_outcome_text=runtime.unknown||ui.stage==='UNKNOWN'?'':[
 outcome?.axes?.LIN==='L2'&&observedSemantic('E04')?'林对公开转述划清边界。':outcome?.axes?.LIN==='L1'&&observedSemantic('E02')?'林选择向你透露她已申请，但尚未录取。':'',
 outcome?.axes?.OFFICER==='O2'&&observedSemantic('E08')?'征募官已说明申请只进入筛选，同行者须独立决定。':''
 ].filter(Boolean).join(' ');
 return {...ui,story:{version:BRIDGE_VERSION,candidate_id:host.context.candidate_id,session_id:host.context.session_id,scene_id:runtime.actors.scene_id,world_cursor:host.context.world_version,request_revision:runtime.actors.request_revision,execution_id:host.job_id,origin:ui.origin,stage:ui.stage,reason:ui.public_reason,can_submit:ui.can_send,can_cancel:ui.can_cancel,can_query:ui.can_query,public_outcome_text,known_text,legal_commands:['SUBMIT_PLAYER_INTENT','CANCEL_EXECUTION','QUERY_EXECUTION','END_DIALOGUE']}};
}
