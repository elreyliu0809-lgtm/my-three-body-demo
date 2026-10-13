import {hostStage} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/host-adapter.mjs';
import {canCancelIntegrated} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story-command-adapter.mjs';

export function projectUI({host,scene,world}){
 if(typeof host.context?.candidate_id!=='string'||!host.context.candidate_id.trim())throw Error('HOST_CANDIDATE_ID_REQUIRED');
 const can_query=host.can_query,job=can_query?host.executor.query(host.job_id):null,raw=job?.state??null;
 const active=!!host.executor.active,inspection=scene.visual_review?.active===true||scene.art?.visual_review?.active===true;
 const stage=hostStage(host,job),unknown=stage==='UNKNOWN',suspended=stage==='SUSPENDED';
 const locked=scene.owner==='EXECUTOR'||host.unresolved||host.executor.recoveryBlocked===true||scene.root_lease_held===true;
 const cameraLocked=scene.camera_lease_held===true,actor_safe=scene.support?.support_verified===true;
 const mapping={RUNNING:job?.steps?.some(s=>s.started)?'EXECUTING':'VALIDATING',RECOVERING:'SETTLING',NOT_EXECUTED:'NOT_STARTED'};
 const execution_status=unknown?'UNKNOWN':suspended?'SUSPENDED':mapping[raw]??raw;
 let reason=host.feedback||'可探索大厅；明确发送后由模型判断。模型不可用时保留原文。';
 if(unknown)reason=can_query?'当前结果未知；旧记录不作为当前现场成功或取消的证明。只查询同一执行，不自动重发。':'无法确认当前行动与历史记录的关联；结果仍待核实，查询不可用，未自动重发。';
 else if(stage==='SETTLING')reason=job?.cancelled?'已取消意图，身体正在恢复到真实支撑。':'身体正在恢复到真实支撑；等待实际安全停稳。';
 else if(suspended)reason='当前操作已挂起；保留表达与已发生事实，等待明确恢复。';
 else if(job?.cancelled)reason='行动已取消；已发生的身体事实保留，后续未执行。';
 else if(raw==='EXECUTION_FAILED')reason='行动开始后失败；已发生事实保留，后续未执行。';
 else if(raw==='NOT_STARTED')reason='行动尚未开始：当前条件不满足，已保留你的表达。';
 else if(raw==='COMPLETED')reason='计划的可执行步骤已完成；已观察到的内容见对话记录。';
 const statusFor=steps=>!steps.length?'NOT_STARTED':steps.some(s=>s.state==='RECOVERING')?'SETTLING':steps.some(s=>s.state==='RUNNING')?'EXECUTING':steps.every(s=>s.state==='COMPLETED')?'COMPLETED':steps.some(s=>s.state==='FAILED')?'EXECUTION_FAILED':steps.some(s=>s.state==='COMPLETED')?'PARTIAL':steps.some(s=>s.state==='CANCELLED')?'CANCELLED':'NOT_STARTED';
 const commandSafe=host.commandAllowed()&&!inspection&&actor_safe&&!locked&&!cameraLocked&&!active&&!host.composing&&!host.pending;
 const can_send=commandSafe&&!!host.draft&&[...host.draft].length<=500&&!['JUDGING','CLARIFYING','PLAN_CHECK','EXECUTING','SETTLING','UNKNOWN','SUSPENDED'].includes(stage);
 // These additional fields are local UI information, never parent request/plan fields.
 return {contract_id:'FI-UI-PROJECTION-R01',runtime_candidate_id:host.context.candidate_id,parent_design_candidate_id:'MT_FREE_INTENT_PERFORMANCE_R01',session_id:host.context.session_id,request_id:host.request?.request_id??null,request_revision:host.request?.request_revision??null,draft_revision:host.draft_revision,plan_id:host.plan?.plan_id??null,execution_id:host.job_id,stage,origin:host.origin,availability:['UNAVAILABLE','AUTHORED_LOCAL'].includes(host.origin)?host.origin:'UNAVAILABLE',availability_reason:'真实模型未连接；模型与语音调用均为0。',inspection,can_camera:!inspection&&!unknown&&!suspended&&!cameraLocked,can_edit_draft:true,can_answer_clarification:commandSafe&&stage==='CLARIFYING'&&host.clarificationContext?.can_answer===true,semantic_decision:host.plan?.decision??null,execution_status,world_version:world.world_version,last_event_sequence:job?.events?.at(-1)?.event_sequence??0,actor_safe,root_lease_held:!!locked,camera_lease_held:cameraLocked,can_send,cancel_requested:host.cancelled===true||job?.cancelled===true,can_cancel:canCancelIntegrated(null,host),can_query:host.can_query,can_manual_move:!active&&!locked&&actor_safe&&!host.text_focus&&!host.composing&&!inspection&&!unknown&&!suspended,draft_dirty:host.draft!==host.request?.raw_text,public_reason:reason.slice(0,240),units:(host.plan?.intent_units??[]).map(u=>{const ids=host.plan.steps.filter(s=>s.intent_unit_id===u.id).map(s=>s.id),steps=job?.steps?.filter(s=>ids.includes(s.id))??[];return {unit_id:u.id,semantic_decision:u.decision,execution_status:unknown?'UNKNOWN':statusFor(steps),actor_id:u.actor_id,target_id:u.target_id,observed_summary:steps.map(s=>s.id+':'+s.state).join(' ').slice(0,240),prevention_execution_status:null};}),updated_at:new Date().toISOString()};
}
