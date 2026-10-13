import {acceptWrapper,createRequest} from '/my-three-body-demo/playtest-r02/2026-10-11_all-assets-intake-r06/src/model-plan-adapter.mjs';
export class HostAdapter {
 constructor({executor,context,contract,registry}){Object.assign(this,{executor,context,contract,registry});this.draft='';this.draft_revision=0;this.request=null;this.plan=null;this.job_id=null;this.pending=false;this.cancelled=false;this.origin='UNAVAILABLE';this.wait_stage='JUDGING';this.composing=false;this.unresolved=false;this.text_focus=false;this.feedback='';this.model_calls=0;this.voice_calls=0;}
 edit(text){this.draft=text;this.draft_revision++;}
 send({origin='UNAVAILABLE',transform_revision=0,answer=false}={}){
  if(this.composing||this.pending||this.executor.active||this.unresolved)throw Error('SEND_BLOCKED');
  const prior=this.request,revision=answer&&prior?prior.request_revision+1:1;
  this.request=createRequest(this.draft,this.context,{request_id:answer?prior?.request_id:undefined,revision,transform_revision});
  if(answer&&prior)this.executor.invalidate(prior.request_id,prior.request_revision,prior.session_id);
  this.plan=null;this.job_id=null;this.cancelled=false;this.origin=origin;this.pending=origin==='AUTHORED_LOCAL';this.wait_stage='JUDGING';this.feedback=origin==='UNAVAILABLE'?'已保留表达；本包没有真实模型连接，没有发出调用。':'';
  return structuredClone(this.request);
 }
 receive(wrapper){if(!this.request||this.cancelled)return {ok:false,errors:['LATE_OR_CANCELLED_PLAN']};this.wait_stage='PLAN_CHECK';const accepted=acceptWrapper(wrapper,this);if(!accepted.ok){this.pending=false;this.feedback='计划未执行：'+accepted.errors.join(',');return accepted;}
  this.plan=accepted.plan;const result=this.executor.submit(accepted.request,accepted.plan);this.pending=false;if(result.ok){this.job_id=result.job_id;if(!accepted.plan.steps.length)this.wait_stage=accepted.plan.decision==='NEEDS_CLARIFICATION'?'CLARIFYING':'RESULT';}else this.feedback='计划未执行：'+result.errors.join(',');return result;
 }
 cancel(){this.cancelled=true;this.pending=false;if(this.request)this.executor.invalidate(this.request.request_id,this.request.request_revision,this.request.session_id);this.feedback='行动已取消；未执行后续步骤。';return this.job_id?this.executor.query(this.job_id):{state:'CANCELLED'};}
 query(){return this.job_id?this.executor.query(this.job_id):{state:'UNKNOWN',reason:'No dispatched host job; no replay'};}
 restoreUnverifiedJournal(journal){const r=this.executor.restoreUnverifiedJournal(journal);this.unresolved=r.restored>0||(journal?.records?.length??0)>0;if(this.unresolved){this.job_id=this.executor.archived.keys().next().value??null;this.feedback='刷新前同job为UNKNOWN；未恢复身体/世界，不重发。';}return r;}
}
