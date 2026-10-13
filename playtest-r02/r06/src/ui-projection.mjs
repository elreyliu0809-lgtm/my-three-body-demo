export function projectUI({host,scene,world}){
 if(typeof host.context?.candidate_id!=='string'||!host.context.candidate_id.trim())throw Error('HOST_CANDIDATE_ID_REQUIRED');
 const job=host.job_id?host.executor.query(host.job_id):null,raw=job?.state??null;
 const active=!!host.executor.active,locked=scene.owner==='EXECUTOR'||host.unresolved,actor_safe=scene.support.support_verified===true;
 const mapping={RUNNING:job?.steps.some(s=>s.started)?'EXECUTING':'VALIDATING',RECOVERING:'SETTLING',NOT_EXECUTED:'NOT_STARTED'};
 const execution_status=mapping[raw]??raw;
 const stage=host.unresolved?'UNKNOWN':raw==='RECOVERING'?'SETTLING':raw==='RUNNING'?(execution_status==='VALIDATING'?'PLAN_CHECK':'EXECUTING'):host.plan?.decision==='NEEDS_CLARIFICATION'&&!host.cancelled?'CLARIFYING':job?'RESULT':host.request?(host.cancelled?'RESULT':host.wait_stage):host.draft?'COMPOSE':'EXPLORE';
 let reason=host.feedback||host.plan?.public_reason||'可探索大厅；明确发送后由模型判断。模型不可用时保留原文。';
 if(host.unresolved)reason='当前结果未知；旧记录不作为当前现场成功或取消的证明。只查询同一执行，不自动重发。';
 else if(job?.cancelled)reason=active?'已取消意图，身体正在恢复到真实支撑。':'行动已取消；已发生的身体事实保留，后续未执行。';
 else if(raw==='EXECUTION_FAILED')reason='行动开始后失败；已发生事实保留，后续未执行。';
 else if(raw==='NOT_STARTED')reason='行动尚未开始：'+(job.reason??'前置条件未满足');
 else if(raw==='COMPLETED')reason='计划的可执行步骤已完成；申请与NPC观察状态不变。';
 const statusFor=steps=>!steps.length?'NOT_STARTED':steps.some(s=>s.state==='RECOVERING')?'SETTLING':steps.some(s=>s.state==='RUNNING')?'EXECUTING':steps.every(s=>s.state==='COMPLETED')?'COMPLETED':steps.some(s=>s.state==='FAILED')?'EXECUTION_FAILED':steps.some(s=>s.state==='COMPLETED')?'PARTIAL':steps.some(s=>s.state==='CANCELLED')?'CANCELLED':'NOT_STARTED';
 return {contract_id:'FI-UI-PROJECTION-R01',runtime_candidate_id:host.context.candidate_id,parent_design_candidate_id:'MT_FREE_INTENT_PERFORMANCE_R01',session_id:host.context.session_id,request_id:host.request?.request_id??null,request_revision:host.request?.request_revision??null,draft_revision:host.draft_revision,plan_id:host.plan?.plan_id??null,execution_id:host.job_id,stage,origin:host.origin,semantic_decision:host.plan?.decision??null,execution_status:host.unresolved?'UNKNOWN':execution_status,world_version:world.world_version,last_event_sequence:job?.events.at(-1)?.event_sequence??0,actor_safe,root_lease_held:!!locked,camera_lease_held:false,can_send:!active&&!host.unresolved&&!host.composing&&!host.pending&&!!host.draft&&[...host.draft].length<=500,can_cancel:active||host.pending,can_query:!!host.job_id,can_manual_move:!active&&!locked&&actor_safe&&!host.text_focus,draft_dirty:host.draft!==host.request?.raw_text,public_reason:reason.slice(0,240),units:(host.plan?.intent_units??[]).map(u=>{const ids=host.plan.steps.filter(s=>s.intent_unit_id===u.id).map(s=>s.id),steps=job?.steps.filter(s=>ids.includes(s.id))??[];return {unit_id:u.id,semantic_decision:u.decision,execution_status:statusFor(steps),actor_id:u.actor_id,target_id:u.target_id,observed_summary:steps.map(s=>s.id+':'+s.state).join(' ').slice(0,240),prevention_execution_status:null};}),updated_at:new Date().toISOString()};
}
