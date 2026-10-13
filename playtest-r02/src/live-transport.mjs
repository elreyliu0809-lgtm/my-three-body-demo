import {acceptWrapper} from '/my-three-body-demo/playtest-r02/src/host-adapter.mjs';
const canonical=v=>JSON.stringify(order(v));
function order(v){return Array.isArray(v)?v.map(order):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])])):v;}
const enabled=mode=>['OFFLINE_FAKE','MODEL_TEXT'].includes(mode);
// Generated plans enter only through a private service-bound capability.
export function createLiveTransport({runtime,host,service}={}){
 if(!runtime||host!==runtime.host||host.executor!==runtime.executor||host.context!==runtime.context)throw Error('SHARED_RUNTIME_REQUIRED');
 const grants=new WeakMap(),proposals=new WeakMap(),controllers=new Set();let epoch=0;
 function status(){const s=service?.status?.()??{mode:'UNAVAILABLE',model_calls:0,fake_calls:0,in_flight:0};const mode=enabled(s.mode)?s.mode:'UNAVAILABLE';host.modelAvailability=mode;host.model_calls=Number.isSafeInteger(s.model_calls)&&s.model_calls>=0?s.model_calls:0;host.fake_calls=Number.isSafeInteger(s.fake_calls)&&s.fake_calls>=0?s.fake_calls:0;return {...s,mode,model_calls:host.model_calls,fake_calls:host.fake_calls};}
 function valid(sealed){return !!sealed&&sealed.epoch===epoch&&sealed.origin===status().mode&&enabled(sealed.origin)&&service?.validate?.(sealed.result)===true;}
 const admit=host.installModelEntry(grant=>{const sealed=grants.get(grant);return valid(sealed)&&grant.origin===sealed.origin&&canonical(grant)===sealed.bytes;});
 runtime.installGeneratedResponseSource((proposal,immutable)=>{const sealed=proposals.get(proposal);return valid(sealed)&&proposal.origin===sealed.origin&&canonical(immutable??proposal)===sealed.bytes;});
 function cancel(){epoch++;for(const controller of controllers)controller.abort();controllers.clear();}
 function errorCode(error,fallback='MODEL_HOST_FAILED'){return /^MODEL_HOST_[A-Z_]+$/.test(error?.code??'')?error.code:fallback;}
 async function invokePlayer(request,origin){
  if(!enabled(origin)||status().mode!==origin)return {state:'UNAVAILABLE',model_calls:status().model_calls};
  const controller=new AbortController(),generation=epoch;controllers.add(controller);
  try{
   const result=await service.request({kind:'PLAYER',actor_id:'player',signal:controller.signal}),sealed={result,epoch:generation,origin};
   if(controller.signal.aborted||!valid(sealed))throw Object.assign(Error(),{code:'MODEL_HOST_STALE'});
   const consumed=service.consume(result);if(consumed?.origin!==origin||canonical(consumed.request)!==canonical(request))throw Object.assign(Error(),{code:'MODEL_HOST_SOURCE_BINDING'});
   const accepted=acceptWrapper(consumed.wrapper,host);if(!accepted.ok){host.modelUnavailable('MODEL_HOST_PLAN_INVALID');return accepted;}
   await runtime.registerModelPlan(consumed);if(controller.signal.aborted||!valid(sealed))throw Object.assign(Error(),{code:'MODEL_HOST_STALE'});
   const grant=Object.freeze({wrapper:consumed.wrapper,origin});grants.set(grant,{...sealed,bytes:canonical(grant)});const outcome=admit(grant);grants.delete(grant);
   return {...outcome,origin,model_calls:status().model_calls};
  }catch(error){if(generation===epoch&&!host.cancelled)host.modelUnavailable(errorCode(error));return {ok:false,errors:[errorCode(error)],model_calls:status().model_calls};}
  finally{controllers.delete(controller);status();}
 }
 async function submitPlayerIntent(text){if(runtime.unknown||runtime.executor.recoveryBlocked||!host.commandAllowed())throw Error('BRIDGE_SUBMIT_BLOCKED');const origin=status().mode;host.edit(text);runtime.actors.edit(text);const request=host.send({origin,transform_revision:runtime.scene.transformRevision??0});return invokePlayer(request,origin);}
 async function answerClarification(answer){if(runtime.unknown||runtime.executor.recoveryBlocked||!host.commandAllowed())throw Error('BRIDGE_SUBMIT_BLOCKED');const origin=host.origin;if(status().mode!==origin)throw Error('MODEL_HOST_UNAVAILABLE');const request=host.answerClarification(answer);return invokePlayer(request,origin);}
 async function requestNPC(actor_id){
  const origin=status().mode;if(!enabled(origin)||runtime.unknown||runtime.executor.recoveryBlocked||!runtime.responseAllowed({}))return {ok:false,errors:['MODEL_HOST_UNAVAILABLE']};
  const controller=new AbortController(),generation=epoch;controllers.add(controller);
  try{
   const result=await service.request({kind:'NPC',actor_id,signal:controller.signal}),sealed={result,epoch:generation,origin};if(controller.signal.aborted||!valid(sealed))throw Object.assign(Error(),{code:'MODEL_HOST_STALE'});
   const consumed=service.consume(result);if(consumed.origin!==origin)throw Object.assign(Error(),{code:'MODEL_HOST_SOURCE_BINDING'});const {proposal,response}=runtime.makeModelNPCProposal(consumed);
   proposals.set(proposal,{...sealed,bytes:canonical(proposal)});const outcome=await runtime.submitResponse(proposal,response);if(!outcome.ok)proposals.delete(proposal);return {...outcome,origin,model_calls:status().model_calls};
  }catch(error){return {ok:false,errors:[errorCode(error,'MODEL_HOST_RESPONSE_REFUSED')],model_calls:status().model_calls};}
  finally{controllers.delete(controller);status();}
 }
 status();return Object.freeze({host,runtime,get availability(){return status().mode;},submitPlayerIntent,answerClarification,requestNPC,cancel,status});
}
