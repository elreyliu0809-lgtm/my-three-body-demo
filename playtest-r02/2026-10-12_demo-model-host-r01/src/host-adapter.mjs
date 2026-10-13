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
function createRequest(text,context,{request_id,revision=1,transform_revision=0,consent=false}={}){
 if(typeof text!=='string'||![...text].length||[...text].length>500)throw Error('INPUT_LENGTH');
 return {design_contract_id:'FP-PERFORMANCE-R01',session_id:context.session_id,request_id:request_id??crypto.randomUUID(),request_revision:revision,actor_id:'player',raw_text:text,input_source:'TEXT',source_world_version:context.world_version,scene_binding_id:context.scene_binding_id,scene_fingerprint:context.scene_fingerprint,capability_snapshot_id:context.capability_snapshot_id,policy_snapshot_id:context.policy_snapshot_id,knowledge_snapshot_id:context.knowledge_snapshot_id,actor_transform_revision:transform_revision,target_hint_id:null,explicit_application_consent:consent};
}


const blockedStages=new Set(['JUDGING','PLAN_CHECK','EXECUTING','SETTLING','UNKNOWN','SUSPENDED']);
const immutable=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(immutable);Object.freeze(value);}return value;};
const clone=value=>immutable(structuredClone(value));
const same=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));};

// Availability is independent of the real executor state.
export function hostStage(host,job=host.job_id?host.executor.query(host.job_id):null){
 if(host.unresolved||host.executor.recoveryBlocked||job?.state==='UNKNOWN')return 'UNKNOWN';
 if(job?.state==='RECOVERING')return 'SETTLING';
 if(job?.state==='RUNNING')return job.steps?.some(s=>s.started)?'EXECUTING':'PLAN_CHECK';
 if(host.suspended||job?.state==='SUSPENDED')return 'SUSPENDED';
 if(host.plan?.decision==='NEEDS_CLARIFICATION'&&!host.cancelled)return 'CLARIFYING';
 if(job)return 'RESULT';
 return host.request?(host.cancelled?'RESULT':host.wait_stage):host.draft?'COMPOSE':'EXPLORE';
}

export class HostAdapter {
 #requestOrigin='UNAVAILABLE';#modelEntryInstalled=false;#gate=()=>true;#requestObserver=null;#cancelObserver=null;#clarification=null;#original=null;#history=[];#queryTarget=null;
 constructor({executor,context,contract,registry}){Object.assign(this,{executor,context,contract,registry});this.draft='';this.draft_revision=0;this.request=null;this.plan=null;this.job_id=null;this.pending=false;this.cancelled=false;this.origin='UNAVAILABLE';this.wait_stage='JUDGING';this.composing=false;this.unresolved=false;this.suspended=false;this.text_focus=false;this.feedback='';this.diagnostic_errors=clone([]);this.model_calls=0;this.voice_calls=0;}
 edit(text){this.draft=text;this.draft_revision++;}
 setRequestObserver(fn){if(typeof fn!=='function')throw Error('REQUEST_OBSERVER_REQUIRED');this.#requestObserver=fn;}
 setCancelObserver(fn){if(typeof fn!=='function')throw Error('CANCEL_OBSERVER_REQUIRED');this.#cancelObserver=fn;}
 setCommandGate(fn){if(typeof fn!=='function')throw Error('COMMAND_GATE_REQUIRED');this.#gate=fn;}
 commandAllowed(){try{const scene=this.executor.adapter?.snapshot?.();return this.#gate()===true&&scene?.support?.support_verified===true&&scene.owner!=='EXECUTOR'&&scene.root_lease_held!==true&&scene.camera_lease_held!==true&&scene.visual_review?.active!==true&&scene.art?.visual_review?.active!==true&&!this.unresolved&&!this.suspended&&!this.executor.recoveryBlocked;}catch{return false;}}
 #assertSend({clarifying=false}={}){if(!this.commandAllowed()||this.composing||this.pending||this.executor.active||blockedStages.has(hostStage(this))||(!clarifying&&hostStage(this)==='CLARIFYING'))throw Error('SEND_BLOCKED');}
 #capture(text,{origin,request_id,revision=1,transform_revision=0}){
  if(!['UNAVAILABLE','AUTHORED_LOCAL','OFFLINE_FAKE'].includes(origin))throw Error('ORIGIN_UNAVAILABLE');
  return clone(createRequest(text,this.context,{request_id,revision,transform_revision}));
 }
 #activate(request,origin){this.#requestOrigin=origin;this.request=request;this.plan=null;this.job_id=null;this.#queryTarget=null;this.cancelled=false;this.origin=origin;this.pending=origin!=='UNAVAILABLE';this.wait_stage=this.pending?'JUDGING':'RESULT';this.#clarification=null;this.diagnostic_errors=clone([]);this.feedback=origin==='UNAVAILABLE'?'已保留表达；本包没有真实模型连接，没有发出调用。':'';this.#requestObserver?.(structuredClone(request));}
 send({origin='UNAVAILABLE',transform_revision=0,answer=false}={}){
  if(answer)throw Error('EXPLICIT_CLARIFICATION_CONTEXT_REQUIRED');
  this.#assertSend();const request=this.#capture(this.draft,{origin,transform_revision});
  this.#original=request;this.#history=[];this.#activate(request,origin);return structuredClone(request);
 }
 get clarificationContext(){
  if(!this.#clarification)return null;
  const current=this.request&&this.plan&&same(this.request,this.#clarification.current_request)&&same(this.#link(this.plan,this.request),this.#clarification.link)&&['session_id','scene_binding_id','scene_fingerprint','capability_snapshot_id','policy_snapshot_id','knowledge_snapshot_id'].every(k=>this.request[k]===this.context[k])&&this.request.source_world_version===this.context.world_version&&this.plan.candidate_id===this.context.candidate_id&&!this.context.cancelled?.has(this.request.session_id+'|'+this.request.request_id+'|'+this.request.request_revision);
  return clone({...this.#clarification,can_answer:!!current&&this.commandAllowed()&&!this.composing&&!this.pending&&!this.executor.active&&!this.cancelled&&hostStage(this)==='CLARIFYING'});
 }
 get clarificationHistory(){return clone(this.#history);}
 answerClarification({raw_question,original_text,raw_answer,link}={}){
  this.#assertSend({clarifying:true});const c=this.#clarification;
  if(this.cancelled||!c||!this.request||!this.plan||hostStage(this)!=='CLARIFYING'||this.plan.decision!=='NEEDS_CLARIFICATION'||this.plan.steps.length)throw Error('CLARIFICATION_UNAVAILABLE');
  const current=this.#link(this.plan,this.request);
  if(!same(link,c.link)||!same(current,c.link)||!same(this.request,c.current_request)||raw_question!==c.raw_question||raw_question!==this.plan.clarification?.question||original_text!==c.original_text||original_text!==this.#original?.raw_text)throw Error('CLARIFICATION_CONTEXT_MISMATCH');
  if(this.context.cancelled?.has(this.request.session_id+'|'+this.request.request_id+'|'+this.request.request_revision))throw Error('CANCELLED_CLARIFICATION_REVISION');
  for(const key of ['session_id','scene_binding_id','scene_fingerprint','capability_snapshot_id','policy_snapshot_id','knowledge_snapshot_id'])if(this.request[key]!==this.context[key])throw Error('STALE_CLARIFICATION_CONTEXT');
  if(this.plan.candidate_id!==this.context.candidate_id||this.request.source_world_version!==this.context.world_version)throw Error('STALE_CLARIFICATION_CONTEXT');
  // Validate all answer and context fields before invalidating the prior revision.
  const prior=this.request,request=this.#capture(raw_answer,{origin:this.#requestOrigin,request_id:prior.request_id,revision:prior.request_revision+1,transform_revision:this.executor.adapter?.transformRevision??prior.actor_transform_revision});
  const entry=clone({original_request:this.#original,prior_request:prior,raw_question,raw_answer,link:c.link,target_id:c.link.target_id});
  this.executor.invalidate(prior.request_id,prior.request_revision,prior.session_id);
  this.#history.push(entry);this.#activate(request,this.#requestOrigin);return structuredClone(request);
 }
 #link(plan,request){const unit=plan.intent_units.find(u=>u.id===plan.clarification?.intent_unit_id);return {candidate_id:plan.candidate_id,session_id:request.session_id,request_id:request.request_id,request_revision:request.request_revision,plan_id:plan.plan_id,intent_unit_id:unit?.id??null,scene_binding_id:request.scene_binding_id,scene_fingerprint:request.scene_fingerprint,target_id:unit?.target_id??null};}
 receive(wrapper){
  if(this.#requestOrigin!=='AUTHORED_LOCAL')return {ok:false,errors:['AUTHORED_DEBUG_INTAKE_ONLY']};
  return this.#acceptPlan(wrapper);
 }
 installModelEntry(verifyGrant){
  if(this.#modelEntryInstalled||typeof verifyGrant!=='function')throw Error('MODEL_ENTRY_ALREADY_INSTALLED');
  this.#modelEntryInstalled=true;
  return grant=>{
   if(this.#requestOrigin!=='OFFLINE_FAKE'||verifyGrant(grant)!==true)return {ok:false,errors:['MODEL_CAPABILITY_REQUIRED']};
   return this.#acceptPlan(grant.wrapper);
  };
 }
 modelUnavailable(code='MODEL_HOST_UNAVAILABLE'){this.pending=false;this.wait_stage='RESULT';this.diagnostic_errors=clone([/^MODEL_HOST_[A-Z_]+$/.test(code)?code:'MODEL_HOST_FAILED']);this.feedback='AI 暂不可用；你的表达已保留，尚未执行。';}
 #acceptPlan(wrapper){
  if(!this.commandAllowed()||this.executor.active||this.unresolved||blockedStages.has(hostStage(this))&&hostStage(this)!=='JUDGING')return {ok:false,errors:['RECEIVE_BLOCKED']};
  if(!this.request||this.cancelled||this.plan)return {ok:false,errors:['LATE_OR_CANCELLED_OR_DUPLICATE_PLAN']};
  const accepted=acceptWrapper(wrapper,this);if(!accepted.ok){this.pending=false;this.wait_stage='RESULT';this.diagnostic_errors=clone(accepted.errors);this.feedback='行动方案未通过核对，尚未执行。你的表达已保留。';return accepted;}
  const plan=accepted.plan;
  if(plan.decision==='NEEDS_CLARIFICATION'&&(!plan.clarification?.question||!plan.intent_units.some(u=>u.id===plan.clarification.intent_unit_id&&u.decision==='NEEDS_CLARIFICATION')||plan.steps.length))return {ok:false,errors:['CLARIFICATION_CONTEXT_UNSUPPORTED']};
  this.wait_stage='PLAN_CHECK';const result=this.executor.submit(accepted.request,plan);this.pending=false;
  if(result.ok){this.plan=clone(plan);this.job_id=result.job_id;this.#queryTarget=clone(this.#target({request:this.request,job:{job_id:this.job_id}}));if(!plan.steps.length)this.wait_stage=plan.decision==='NEEDS_CLARIFICATION'?'CLARIFYING':'RESULT';if(plan.decision==='NEEDS_CLARIFICATION')this.#clarification=clone({raw_question:plan.clarification.question,original_text:this.#original.raw_text,original_request:this.#original,current_request:this.request,link:this.#link(plan,this.request),prior_answers:this.#history});}
  else {this.wait_stage='RESULT';this.diagnostic_errors=clone(result.errors);this.feedback='当前条件不允许开始这项行动，尚未执行。你的表达已保留。';}return result;
 }
 cancel(){this.cancelled=true;this.pending=false;this.#clarification=null;if(this.request)this.executor.invalidate(this.request.request_id,this.request.request_revision,this.request.session_id);this.feedback='行动已取消；未执行后续步骤。';this.#cancelObserver?.(this.request?structuredClone(this.request):null);return this.job_id?this.query():{state:'CANCELLED'};}
 #target(record){return {candidate_id:this.context.candidate_id,scene_fingerprint:this.context.scene_fingerprint,job_id:record.job.job_id,session_id:record.request.session_id,request_id:record.request.request_id,request_revision:record.request.request_revision};}
 #validJournal(journal){
  if(journal?.candidate_id!==this.context.candidate_id||journal.scene_fingerprint!==this.context.scene_fingerprint||!Array.isArray(journal.records))return false;
  const jobs=new Set(),revisions=new Map();
  return journal.records.every(record=>{
   const request=record?.request,job=record?.job;
   if(!request||!job||typeof job.job_id!=='string'||!job.job_id.trim()||validateSchema(request,this.contract.schemas.input_request).length||request.scene_fingerprint!==journal.scene_fingerprint||request.scene_binding_id!==this.context.scene_binding_id||request.session_id!==this.context.session_id||!Array.isArray(job.events))return false;
   const revision=request.session_id+'|'+request.request_id+'|'+request.request_revision;
   if(jobs.has(job.job_id)||revisions.has(revision)&&!same(revisions.get(revision),request))return false;jobs.add(job.job_id);revisions.set(revision,request);
   return job.events.every(event=>event&&event.candidate_id===journal.candidate_id&&event.scene_fingerprint===journal.scene_fingerprint&&event.scene_binding_id===request.scene_binding_id&&event.execution_id===job.job_id&&event.session_id===request.session_id&&event.request_id===request.request_id&&event.request_revision===request.request_revision);
  });
 }
 #selectedTarget(journal){
  if(!this.#queryTarget||!this.job_id||!this.#validJournal(journal))return null;
  const matches=journal.records.filter(record=>record.job.job_id===this.job_id);
  if(matches.length!==1)return null;const record=matches[0],target=this.#target(record);
  if(!same(target,this.#queryTarget)||this.request&&!same(this.request,record.request))return null;
  return target;
 }
 invalidateStoryParent(oldWire,reason){
 if(!oldWire)return {invalidated:false};
 this.executor.invalidate(oldWire.request_id,oldWire.request_revision,oldWire.session_id);
 if(this.request&&same(this.request,oldWire)){this.cancelled=true;this.pending=false;this.#clarification=null;this.feedback='对话已结束；已观察到的事实保留。';}
 return {invalidated:true};
 }
 adoptExecution(job_id){
 const live=this.executor.jobs?.get(job_id),r=live?.request,p=live?.plan;
 if(!live||live.id!==job_id||!this.request||!same(r,this.request)||this.cancelled||this.unresolved||this.suspended)throw Error('ADOPT_EXECUTION_IDENTITY');
 if(['session_id','scene_binding_id','scene_fingerprint'].some(k=>r[k]!==this.context[k])||p.candidate_id!==this.context.candidate_id||['session_id','request_id','request_revision','scene_binding_id','scene_fingerprint'].some(k=>p[k]!==r[k]))throw Error('ADOPT_EXECUTION_BINDING');
 const t=live.trustedProposal;
 if(!t||!['lin','officer'].includes(t.actor_id)||t.parent_request_id!==r.request_id||t.parent_request_revision!==r.request_revision||t.scene_id!==this.context.story_scene_id||p.steps.some(s=>s.actor_id!==t.actor_id||s.target_id!==t.audience_id))throw Error('ADOPT_TRUSTED_JOB_REQUIRED');
 this.job_id=job_id;this.#queryTarget=clone(this.#target({request:r,job:{job_id}}));this.pending=false;this.wait_stage='PLAN_CHECK';return {ok:true,job_id};
 }
 get can_query(){return !!this.#selectedTarget(this.executor.journal());}
 journal(){const journal=this.executor.journal();return {...journal,host_query_target:this.#selectedTarget(journal)};}
 query(){return this.can_query?this.executor.query(this.job_id):{state:'UNKNOWN',reason:'无法确认当前行动与历史记录的关联；查询不可用，未重新执行。'};}
 restoreUnverifiedJournal(journal){
  // Check the complete local record identities before choosing or restoring anything.
  const valid=this.#validJournal(journal),hasTarget=!!journal&&Object.hasOwn(journal,'host_query_target'),records=valid?journal.records:[];
  let selected=null;
  if(valid){
   if(hasTarget&&journal.host_query_target!==null){const matches=records.filter(record=>same(this.#target(record),journal.host_query_target));if(matches.length===1)selected=matches[0];}
   else if(!hasTarget&&records.length===1)selected=records[0];
  }
  const r=this.executor.restoreUnverifiedJournal({...journal,records});
  this.unresolved=records.length>0||hasTarget&&journal.host_query_target!==null||!valid||!!journal?.records?.length;
  this.request=null;this.plan=null;this.pending=false;this.cancelled=false;this.#original=null;this.#history=[];this.#clarification=null;
  this.job_id=selected?.job.job_id??null;this.#queryTarget=selected?clone(this.#target(selected)):null;
  this.diagnostic_errors=clone(!valid?['JOURNAL_RECORD_IDENTITY_INVALID']:this.unresolved&&!selected?['JOURNAL_CURRENT_JOB_UNLINKED']:[]);
  if(this.unresolved)this.feedback=selected?'刷新前的同一行动结果仍待核实；只查询该行动，未恢复身体与世界，也未重新执行。':'无法确认当前行动与历史记录的关联；结果仍待核实，查询不可用，未恢复身体与世界，也未重新执行。';
  return {...r,query_target_verified:!!selected,job_id:this.job_id};
 }
}
