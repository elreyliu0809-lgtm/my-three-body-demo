import {hostStage} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/host-adapter.mjs';
export const BRIDGE_VERSION='MT-STORY-UI-BRIDGE/0.1.0';
export function canCancelIntegrated(runtime,host){
 const stage=hostStage(host),active=host.executor.active;
 if(stage==='UNKNOWN'||host.unresolved||runtime?.unknown)return false;
 return active?active.id===host.job_id&&host.can_query===true:!!host.request&&(host.pending===true||stage==='CLARIFYING');
}
export function createStoryCommand(runtime,host,type,extra={}){return {...extra,version:BRIDGE_VERSION,type,candidate_id:host.context.candidate_id,session_id:host.context.session_id,scene_id:runtime.actors.scene_id,scene_binding_id:host.context.scene_binding_id,scene_fingerprint:host.context.scene_fingerprint,world_cursor:host.context.world_version,request_revision:runtime.actors.request_revision,request_id:host.request?.request_id??null,execution_id:host.job_id};}
export function dispatchIntegratedCommand(runtime,host,c){
 const identity=createStoryCommand(runtime,host,c?.type);
 for(const k of ['version','candidate_id','session_id','scene_id','scene_binding_id','scene_fingerprint','world_cursor','request_revision','request_id','execution_id'])if(c?.[k]!==identity[k])throw Error('BRIDGE_IDENTITY_MISMATCH');
 const stage=hostStage(host),active=host.executor.active;
 switch(c.type){
 case 'SUBMIT_PLAYER_INTENT':if(!host.commandAllowed()||active||runtime.unknown||['UNKNOWN','SETTLING','SUSPENDED','CLARIFYING','JUDGING'].includes(stage))throw Error('BRIDGE_SUBMIT_BLOCKED');host.edit(c.text);runtime.actors.edit(c.text);host.send({origin:'UNAVAILABLE',transform_revision:host.executor.adapter?.transformRevision??0});runtime.feedback='AI 暂不可用；草稿已保留';return {state:'UNAVAILABLE',model_calls:0};
 case 'CANCEL_EXECUTION':if(!canCancelIntegrated(runtime,host))throw Error('BRIDGE_CANCEL_TARGET');runtime.cancel();return host.cancel();
 case 'QUERY_EXECUTION':if(!host.can_query||c.execution_id!==host.job_id)throw Error('QUERY_SAME_EXECUTION_ONLY');return host.query();
 case 'END_DIALOGUE':if(!host.commandAllowed()||host.composing||active||runtime.unknown||['UNKNOWN','SETTLING','SUSPENDED'].includes(stage))throw Error('BRIDGE_END_BLOCKED');return runtime.invalidate('END_DIALOGUE');
 default:throw Error('ILLEGAL_COMMAND');
 }
}
