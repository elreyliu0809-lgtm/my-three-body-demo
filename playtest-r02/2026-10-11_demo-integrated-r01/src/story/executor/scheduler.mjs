import {validatePlan,validateTrustedResponsePlan,revisionKey} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story/executor/plan-validator.mjs';
import {createTrustedResponseEntry} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story/trusted-response-adapter.mjs';
import {Resources} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/resources.mjs';
import {EventStore,payloadHash,canonical} from '/my-three-body-demo/playtest-r02/2026-10-11_demo-integrated-r01/src/story/executor/event-store.mjs';
import {validateSchema} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/schema-validation.mjs';
export class Executor {
 #token=Symbol('private executor writer');#counter=0;#revisions=new Map();#responseEntryInstalled=false;
 constructor({contract,registry,context,adapter}){this.contract=contract;this.registry=registry;this.context=context;this.adapter=adapter;this.instanceId=crypto.randomUUID();this.resources=new Resources();this.jobs=new Map();this.context.cancelled=new Set();this.store=new EventStore({token:this.#token,schema:contract.schemas.trusted_event,context});this.active=null;}
 submit(request,plan){
  const wireErrors=[...validateSchema(request,this.contract.schemas.input_request,'request'),...validateSchema(plan,this.contract.schemas.model_plan,'plan')];if(wireErrors.length)return {ok:false,errors:wireErrors};
  const key=revisionKey(request??{});
  if(this.archivedRevisions?.has(key))return {ok:false,job_id:this.archivedRevisions.get(key),errors:['RECONCILE_EXISTING_JOB_NO_REPLAY']};
  if(this.#revisions.has(key)){const old=this.jobs.get(this.#revisions.get(key));if(canonical(old.request)!==canonical(request)||canonical(old.plan)!==canonical(plan))return {ok:false,errors:['REVISION_PAYLOAD_MISMATCH']};return {ok:true,job_id:old.id,duplicate:true};}
  if(this.active||this.recoveryBlocked)return {ok:false,errors:[this.recoveryBlocked?'UNRESOLVED_RECOVERY':'EXECUTOR_BUSY']};
  const latest=Math.max(0,...[...this.jobs.values()].filter(j=>j.request.session_id===request?.session_id&&j.request.request_id===request?.request_id).map(j=>j.request.request_revision));if(request?.request_revision<latest)return {ok:false,errors:['OLD_REVISION']};
  const result=validatePlan(plan,request,this.context,this.contract,this.registry);if(!result.ok)return result;
  const id='CM-C02-JOB-'+this.instanceId+'-'+(++this.#counter),job={id,request:structuredClone(request),plan:structuredClone(plan),state:plan.steps.length?'RUNNING':'NOT_EXECUTED',steps:new Map(plan.steps.map(s=>[s.id,{step:s,state:'PENDING',started:false,elapsed:0,handle:null}])),sequence:0,cursor:this.store.world_version,elapsed:0,cancelled:false,reason:null};
  this.jobs.set(id,job);this.#revisions.set(key,id);if(plan.steps.length){this.active=job;this.adapter.control?.(true);}return {ok:true,job_id:id};
 }
 installTrustedResponseEntry(resolvers){
  if(this.#responseEntryInstalled)throw Error('TRUSTED_ENTRY_ALREADY_PROVISIONED');
  const entry=createTrustedResponseEntry({...resolvers,context:this.context,registry:this.registry,resolveEvent:id=>this.store.snapshot().events.find(e=>e.event_id===id),enqueue:(...args)=>this.#enqueueTrusted(...args)});
  this.#responseEntryInstalled=true;return entry;
 }
 #enqueueTrusted(request,plan,guard,key,proposal){
  if(this.archivedRevisions?.has(revisionKey(request)))return {ok:false,job_id:this.archivedRevisions.get(revisionKey(request)),errors:['RECONCILE_EXISTING_JOB_NO_REPLAY']};
  if(this.#revisions.has(key)){
   const prior=this.jobs.get(this.#revisions.get(key));
   if(canonical(prior.trustedProposal)!==canonical(proposal))return {ok:false,errors:['REVISION_PAYLOAD_MISMATCH']};
   return {ok:true,job_id:prior.id,duplicate:true};
  }
  if(this.active||this.recoveryBlocked)return {ok:false,errors:[this.recoveryBlocked?'UNRESOLVED_RECOVERY':'EXECUTOR_BUSY']};
  const trusted=guard();if(!trusted.ok)return trusted;
  const validation=validateTrustedResponsePlan(plan,request,this.context,this.contract,this.registry);if(!validation.ok)return validation;
  const id='CM-C02-JOB-'+this.instanceId+'-'+(++this.#counter);
  const job={id,request:structuredClone(request),plan:structuredClone(plan),state:'RUNNING',steps:new Map(plan.steps.map(s=>[s.id,{step:s,state:'PENDING',started:false,elapsed:0,handle:null}])),sequence:0,cursor:this.store.world_version,elapsed:0,cancelled:false,reason:null,trustedGuard:guard,trustedProposal:structuredClone(proposal)};
  this.jobs.set(id,job);this.#revisions.set(key,id);this.active=job;this.adapter.control?.(true);return {ok:true,job_id:id};
 }
 query(id){const j=this.jobs.get(id);return j?{job_id:id,state:j.state,reason:j.reason,cursor:j.cursor,cancelled:j.cancelled,steps:[...j.steps.values()].map(s=>({id:s.step.id,state:s.state,started:s.started,elapsed:s.elapsed})),events:this.store.snapshot().events.filter(e=>e.execution_id===id)}:this.archived?.get(id)??{job_id:id,state:'UNKNOWN',reason:'No local execution record; reconcile same job with service; never replay'};}
 readEvents(options){return this.store.readEvents(options);}
 queryReceipt({job_id,step_id}){
  const j=this.jobs.get(job_id),s=j?.steps.get(step_id);if(!s)return {job_id,step_id,status:'UNKNOWN',reason:'Query original host execution; never resubmit'};
  const events=this.query(job_id).events.filter(e=>e.step_id===step_id&&['body_action_completed','counter_landing_stable','body_settled','dialogue_presented'].includes(e.type));
  return {job_id,step_id,request_id:j.request.request_id,request_revision:j.request.request_revision,session_id:j.request.session_id,status:events.length?'COMMITTED_LOCAL':['NOT_STARTED','NOT_EXECUTED','CANCELLED'].includes(s.state)&&!s.started?'NOT_STARTED':'UNKNOWN',events,external_receiver:'DISABLED',reason:events.length?'Local semantic events; no NPC observation or application receipt implied':'No verified semantic receipt; progress/timeout never proves a result'};
 }
 restoreUnverifiedJournal(journal){
  if(this.jobs.size||this.active)throw Error('RESTORE_BEFORE_EXECUTION_ONLY');this.archived=new Map();this.archivedRevisions=new Map();
  this.archivedRecords=[];if(journal?.candidate_id!==this.context.candidate_id||journal?.scene_fingerprint!==this.context.scene_fingerprint) return {restored:0,reason:'JOURNAL_BINDING_MISMATCH'};
  for(const record of journal.records??[]){if(!record?.job?.job_id||!record?.request)continue;const value={...structuredClone(record.job),previous_state:record.job.state,state:'UNKNOWN',reason:'Historical journal retained; actual body/support and host authority not reconciled after reload',historical_events_authoritative:false};this.archived.set(value.job_id,value);this.archivedRevisions.set(revisionKey(record.request),value.job_id);this.archivedRecords.push(structuredClone(record));}
  return {restored:this.archived.size,world_mutations:0,replayed_steps:0};
 }
 journal(){return {candidate_id:this.context.candidate_id,scene_fingerprint:this.context.scene_fingerprint,records:[...(this.archivedRecords??[]),...[...this.jobs.values()].map(j=>({request:structuredClone(j.request),job:this.query(j.id)}))]};}
 cancel(id,reason='USER_CANCEL'){
  const j=this.jobs.get(id);if(!j)return this.query(id);
  this.context.cancelled.add(revisionKey(j.request));
  if(['RUNNING','RECOVERING'].includes(j.state)){j.cancelled=true;j.reason=reason;j.state='RECOVERING';for(const s of j.steps.values()){if(s.state==='PENDING')s.state='CANCELLED';else if(s.state==='RUNNING'){this.adapter.cancel(s.handle);s.state='RECOVERING';}}this.finishIfSettled(j);}return this.query(id);
 }
 invalidate(request_id,revision,session_id=this.context.session_id??'OFFLINE-CM-C02'){
  const key=revisionKey({session_id,request_id,request_revision:revision});this.context.cancelled.add(key);const jobs=[...this.jobs.values()].filter(j=>revisionKey(j.request)===key);for(const j of jobs)this.cancel(j.id,'REVISION_INVALIDATED');return {invalidated:true,job_ids:jobs.map(j=>j.id),states:jobs.map(j=>this.query(j.id).state)};
 }
 #emit(j,s,type,proof){
  const semantic=['body_action_completed','counter_landing_stable','body_settled','dialogue_presented'].includes(type),sequence=j.sequence+1;
  const event={candidate_id:j.plan.candidate_id,design_contract_id:j.plan.design_contract_id,scene_binding_id:j.plan.scene_binding_id,scene_fingerprint:j.plan.scene_fingerprint,session_id:j.plan.session_id,request_id:j.plan.request_id,request_revision:j.plan.request_revision,execution_id:j.id,step_id:s.step.id,event_id:j.id+':'+sequence,event_sequence:sequence,type,actor_id:s.step.actor_id,target_id:s.step.target_id,source_world_version:j.cursor,result_world_version:j.cursor+Number(semantic),occurred_at:new Date().toISOString(),source_executor_id:'CM-C02-EXECUTOR-R02',payload_hash:payloadHash(proof),actual_transform_revision:this.adapter.transformRevision??0,proof,committed:false};
  const r=this.store.commit(this.#token,event);j.sequence=sequence;j.cursor=r.world_version;
 }
 fail(j,s,error){
  j.reason=String(error?.message??error);j.failed=true;s.state='RECOVERING';this.adapter.cancel(s.handle);
  this.#emit(j,s,'step_failed',{observed:true,adapter:'scene',reason:j.reason,phase:this.adapter.snapshot?.().phase??'start',position:this.adapter.snapshot?.().position??null});
  for(const x of j.steps.values()){if(x.state==='PENDING')x.state='NOT_EXECUTED';else if(x!==s&&x.state==='RUNNING'){this.adapter.cancel(x.handle);x.state='RECOVERING';}}
  j.state='RECOVERING';
 }
 rejectBeforeStart(j,s,error){
  j.reason=String(error?.message??error);j.notStarted=true;s.state='NOT_STARTED';this.resources.release(j.id+':'+s.step.id);
  for(const x of j.steps.values()){if(x.state==='PENDING')x.state='NOT_EXECUTED';else if(x.state==='RUNNING'){this.adapter.cancel(x.handle);x.state='RECOVERING';}}j.state='RECOVERING';
  // Atomic adapter rejection: no started/failed execution event is manufactured.
 }
 tick(dt){
  if(!Number.isFinite(dt)||dt<0||dt>.1)throw Error('INVALID_DT');const j=this.active;if(!j)return; j.elapsed+=dt;
  if(j.state==='RUNNING'&&this.context.cancelled.has(revisionKey(j.request)))this.cancel(j.id,'REVISION_INVALIDATED');
  if(j.state==='RUNNING'&&j.trustedGuard){const current=j.trustedGuard();if(!current.ok)this.cancel(j.id,'TRUSTED_RESPONSE_INVALIDATED:'+current.errors.join(','));}
  if(j.cursor!==this.store.world_version){this.cancel(j.id,'EXTERNAL_WORLD_CONFLICT');j.failed=true;j.cursor=this.store.world_version;/* external reconciliation permits recovery observations only */}
  if(j.state==='RUNNING'&&(['scene_binding_id','scene_fingerprint','capability_snapshot_id','policy_snapshot_id','knowledge_snapshot_id'].some(k=>j.plan[k]!==this.context[k])||[...j.steps.values()].filter(s=>['PENDING','RUNNING'].includes(s.state)).some(s=>!this.registry.get(s.step.primitive_id)?.enabled))){this.cancel(j.id,'LIVE_IDENTITY_OR_CAPABILITY_CONFLICT');j.failed=true;}
  if(j.elapsed>j.plan.horizon_s&&!j.cancelled)this.cancel(j.id,'HORIZON_EXPIRED');
  for(const s of j.steps.values()){
   if(s.state==='PENDING'&&j.state==='RUNNING'&&s.step.depends_on.every(id=>j.steps.get(id).state==='COMPLETED')){
    if(!this.resources.acquire(j.id+':'+s.step.id,s.step.resource_claims))continue;
    try{s.handle=this.adapter.start(s.step,{request:j.request,cursor:j.cursor,context:this.context});if(!s.handle)throw Error('ADAPTER_START_HANDLE_REQUIRED');s.started=true;s.state='RUNNING';this.#emit(j,s,'step_started',{observed:true,adapter:'scene',lease:s.step.resource_claims,position:this.adapter.snapshot?.().position??null});}catch(e){if(e.effect_status==='UNKNOWN'){j.reason='START_EFFECT_UNKNOWN:'+e.message;j.state='UNKNOWN';this.active=null;this.recoveryBlocked=true;return;}if(s.started)this.fail(j,s,e);else this.rejectBeforeStart(j,s,e);}
   }
   if(!['RUNNING','RECOVERING'].includes(s.state))continue;
   try {
    s.elapsed+=dt;if(s.elapsed>s.step.max_duration_s&&s.state==='RUNNING'){this.fail(j,s,Error('STEP_DEADLINE'));}
    const result=this.adapter.tick(s.handle,dt);if(!result?.done)continue;
    if(result.failed&&s.state==='RUNNING'){this.fail(j,s,Error(result.reason));continue;}
    const recovered=s.state==='RECOVERING';
    for(const e of result.events??[]){if(recovered&&!['body_settled','step_progress'].includes(e.type))throw Error('RECOVERY_SUCCESS_EVENT_FORBIDDEN');this.#emit(j,s,e.type,e.proof);}
    this.#emit(j,s,recovered?'step_cancelled':'step_completed',{observed:true,adapter:'scene',cancelled:j.cancelled,position:this.adapter.snapshot?.().position??null});
    s.state=recovered?(j.failed?'FAILED':'CANCELLED'):'COMPLETED';this.resources.release(j.id+':'+s.step.id);
   }catch(e){if(s.state==='RECOVERING'){j.reason='RECOVERY_ERROR:'+e.message;j.state='UNKNOWN';this.active=null;this.recoveryBlocked=true;/* retain locks and body owner: physical recovery unresolved */return;}this.fail(j,s,e);}
  }
  this.finishIfSettled(j);
 }
 finishIfSettled(j){if([...j.steps.values()].some(s=>['PENDING','RUNNING','RECOVERING'].includes(s.state)))return;const n=[...j.steps.values()].filter(s=>s.state==='COMPLETED').length;j.state=j.failed?'EXECUTION_FAILED':j.notStarted?([...j.steps.values()].some(s=>s.started)?'PARTIAL':'NOT_STARTED'):j.cancelled?(n?'PARTIAL':'CANCELLED'):'COMPLETED';this.resources.clear();this.adapter.control?.(false);this.active=null;}
 snapshot(){return {active:this.active?.id??null,jobs:[...this.jobs.keys()].map(id=>this.query(id)),archived_jobs:[...(this.archived?.values()??[])],locks:this.resources.snapshot(),...this.store.snapshot()};}
}
