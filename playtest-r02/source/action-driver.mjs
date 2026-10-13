/* Narrow Three.js consumer. No LLM, gameplay rules, NPC retarget or damage logic.
 * Host supplies permission, world-version, whole-body sweep and support evidence.
 * Every event below is playback data; none commits game-world success.
 */
export async function verifyLibrary(asset, contract) {
  const names=asset.animations.map(c=>c.name);
  for(const c of contract.clips) {
    const clip=asset.animations.find(a=>a.name===c.name);
    if(!clip || Math.abs(clip.duration-c.duration_s)>.002)throw Error('CLIP_CONTRACT_MISMATCH:'+c.name);
  }
  const skin=asset.parser.json.skins?.[0];
  if(!skin)throw Error('SKIN_REQUIRED');
  const accessor=await asset.parser.getDependency('accessor',skin.inverseBindMatrices);
  const bytes=new Uint8Array(accessor.array.buffer,accessor.array.byteOffset,accessor.array.byteLength);
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(sha!==contract.skeleton.inverse_bind_sha256)throw Error('INVERSE_BIND_MISMATCH');
  for(const name of contract.skeleton.joints)if(!asset.scene.getObjectByName(name)?.isBone)throw Error('BONE_REQUIRED:'+name);
  return {asset,sha,names};
}

export class ThreeActionDriver {
  constructor({THREE:T,asset,actorRoot,contract,verification,mixer,authorize,sweep,emit=()=>{}}) {
    if(verification?.asset!==asset || verification.sha!==contract.skeleton.inverse_bind_sha256)throw Error('VERIFIED_LIBRARY_REQUIRED');
    if(typeof authorize!=='function'||typeof sweep!=='function')throw Error('HOST_PERMISSION_AND_SWEEP_REQUIRED');
    this.T=T;this.asset=asset;this.actorRoot=actorRoot;this.contract=contract;
    this.authorize=authorize;this.sweep=sweep;this.emit=emit;this.mixer=mixer??new T.AnimationMixer(asset.scene);
    this.root=asset.scene.getObjectByName(contract.skeleton.root);
    this.bones=contract.skeleton.joints.map(n=>asset.scene.getObjectByName(n));
    this.bind={position:this.root.position.clone(),quaternion:this.root.quaternion.clone(),scale:this.root.scale.clone()};
    this.actorRoot.updateWorldMatrix(true,true);
    this.relativeBind=this.actorRoot.matrixWorld.clone().invert().multiply(this.root.matrixWorld);
    this.active=null;this.posture='standing';this.held=null;this.events=[];
  }
  get state(){return this.active?.state??'IDLE';}
  refresh(){this.actorRoot.updateWorldMatrix(true,false);this.actorRoot.updateMatrixWorld(true);this.asset.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
  sampleRoot(){this.refresh();return {position:this.root.getWorldPosition(new this.T.Vector3()).toArray(),matrix:this.root.matrixWorld.clone()};}
  snapshot(){return this.bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));}
  restore(snapshot){for(const x of snapshot){x.b.position.copy(x.p);x.b.quaternion.copy(x.q);x.b.scale.copy(x.s);}this.refresh();}
  holdTerminal(action){const pose=this.snapshot();action.stop();this.restore(pose);this.held=null;}
  event(type,data={}){const value={type,request_id:this.context?.request_id,world_version:this.context?.world_version,actor:this.currentStep?.actor,target_id:this.currentStep?.targetId,sequence:this.events.length+1,...data};this.events.push(value);this.emit(value);}
  play(step,context) {
    if(this.active)throw Error('ACTOR_BUSY');
    if(typeof step.actor!=='string'||typeof context?.request_id!=='string'||context.world_version===undefined)throw Error('REQUEST_ACTOR_WORLD_CONTEXT_REQUIRED');
    if(step.primitive!=='play_clip')throw Error('ENGINE_UNSUPPORTED_PRIMITIVE');
    const allowedKeys=new Set(['rate','cycles']);
    if(Object.keys(step.params??{}).some(k=>!allowedKeys.has(k)))throw Error('UNKNOWN_PARAMETER');
    const c=this.contract.clips.find(c=>c.name===step.clip);if(!c)throw Error('ENGINE_UNSUPPORTED_CLIP');
    const rate=step.params?.rate??1,cycles=step.params?.cycles??1;
    if(!Number.isFinite(rate)||rate<c.parameters.playback_rate.min||rate>c.parameters.playback_rate.max)throw Error('RATE_OUT_OF_RANGE');
    if(!Number.isInteger(cycles)||cycles<1||cycles>4||(!c.loop&&cycles!==1))throw Error('INVALID_CYCLE_COUNT');
    if(this.posture!==c.posture_pre)throw Error('POSTURE_PRECONDITION');
    const permission=this.authorize({phase:'start',step,context,posture:this.posture});
    if(permission?.ok!==true)throw Error(permission?.reason??'HOST_PRECONDITION_FAILED');
    // Authorization already acquired this actor's exclusive ACTION lease.
    // The supplied shared mixer must belong to this actor only.
    this.mixer.stopAllAction();
    const clip=this.asset.animations.find(a=>a.name===step.clip),a=this.mixer.clipAction(clip);
    a.reset().setLoop(this.T.LoopOnce,1);a.clampWhenFinished=true;a.play();a.paused=true;a.time=0;this.mixer.update(0);
    this.context=context;this.currentStep=step;
    this.active={state:'PLAYING',step,context,c,a,rate,cycles,time:0,total:c.duration_s*cycles};this.held=a;
    this.event('playback_started',{actor:step.actor,clip:c.name});
    for(const m of c.events.filter(m=>m.time_s===0))this.event('clip_marker',{actor:step.actor,clip:c.name,marker:m,cycle:0});
    return {ok:true,clip:c.name};
  }
  tick(dt) {
    const x=this.active;if(!x||x.state!=='PLAYING')return;
    if(!Number.isFinite(dt)||dt<0)throw Error('INVALID_DT');
    const authorization=this.authorize({phase:'tick',step:x.step,context:x.context,posture:this.posture});
    if(authorization?.ok!==true){x.state='RECOVERY_REQUIRED';x.a.paused=true;this.event('execution_failed',{reason:authorization?.reason??'STALE_WORLD',actualPoseHeld:true});return;}
    const next=Math.min(x.total,x.time+Math.min(dt,.05)*x.rate),before=this.snapshot(),from=this.sampleRoot();
    const localTime=next===x.total?x.c.duration_s:next%x.c.duration_s;
    x.a.time=localTime;x.a.paused=true;this.mixer.update(0);const to=this.sampleRoot();
    const check=this.sweep({step:x.step,context:x.context,from,to,previousTime:x.time,nextTime:next,asset:this.asset});
    if(check?.ok!==true){this.restore(before);x.a.time=x.time%x.c.duration_s;x.state='RECOVERY_REQUIRED';this.event('execution_failed',{reason:check?.reason??'WORLD_SWEEP_BLOCKED',actualPoseHeld:true});return;}
    for(let cycle=0;cycle<x.cycles;cycle++)for(const marker of x.c.events){const at=cycle*x.c.duration_s+marker.time_s;if(at>x.time+1e-8&&at<=next+1e-8)this.event('clip_marker',{actor:x.step.actor,clip:x.c.name,marker,cycle});}
    x.time=next;
    if(next===x.total){
      if(x.c.root_mode==='embedded')this.transferRoot();
      this.holdTerminal(x.a);
      this.posture=x.c.posture_post;this.active=null;
      this.event('playback_completed',{actor:x.step.actor,clip:x.c.name,posture:this.posture,worldSuccess:false,requiresHostObservation:true});
    }
  }
  transferRoot() {
    // Wnew = actual animated bone world * inverse(bone bind relative to actor).
    // Preserve every vertex world pose while moving root displacement to actor.
    const world=this.sampleRoot().matrix.clone().multiply(this.relativeBind.clone().invert());
    const local=this.actorRoot.parent?this.actorRoot.parent.matrixWorld.clone().invert().multiply(world):world;
    local.decompose(this.actorRoot.position,this.actorRoot.quaternion,this.actorRoot.scale);
    this.root.position.copy(this.bind.position);this.root.quaternion.copy(this.bind.quaternion);this.root.scale.copy(this.bind.scale);
    this.refresh();
  }
  cancel() {
    if(!this.active)return {state:'IDLE'};
    this.active.state='CANCEL_PENDING';this.active.a.paused=true;
    this.event('cancel_requested',{actualPoseHeld:true,requiresSupportedRecovery:true});
    return {state:'CANCEL_PENDING'};
  }
  resolveRecovery({supported,settled,posture,reason}) {
    if(!this.active||!['CANCEL_PENDING','RECOVERY_REQUIRED'].includes(this.active.state))throw Error('NO_RECOVERY_PENDING');
    if(supported!==true||settled!==true||!['standing','crouched'].includes(posture))throw Error('SUPPORTED_RECOVERY_REQUIRED');
    const cancelled=this.active.state==='CANCEL_PENDING';this.transferRoot();this.holdTerminal(this.active.a);this.active=null;this.posture=posture;
    this.event(cancelled?'playback_cancelled':'execution_failed_settled',{reason,worldSuccess:false});
  }
}

export class PerformanceRunner {
  constructor(drivers){this.drivers=drivers;this.plan=null;this.beat=0;this.state='IDLE';}
  start(plan,context) {
    if(this.state==='RUNNING')throw Error('PLAN_BUSY');
    if(!Array.isArray(plan.beats)||!plan.beats.length||plan.beats.length>12)throw Error('INVALID_PLAN');
    for(const beat of plan.beats){if(!Array.isArray(beat.parallel)||!beat.parallel.length||beat.parallel.length>4)throw Error('INVALID_BEAT');const actors=new Set();for(const step of beat.parallel){if(!this.drivers[step.actor]||actors.has(step.actor))throw Error('UNKNOWN_OR_DUPLICATE_ACTOR');actors.add(step.actor);}}
    this.plan=plan;this.context=context;this.beat=0;this.state='RUNNING';this.beginBeat();
  }
  beginBeat() {
    const begun=[];
    try {for(const s of this.plan.beats[this.beat].parallel){this.drivers[s.actor].play(s,this.context);begun.push(this.drivers[s.actor]);}}
    catch(error){for(const d of begun)d.cancel();this.state='RECOVERY_REQUIRED';throw error;}
  }
  tick(dt) {
    if(this.state!=='RUNNING')return;
    const steps=this.plan.beats[this.beat].parallel;
    for(const s of steps)this.drivers[s.actor].tick(dt);
    if(steps.some(s=>['RECOVERY_REQUIRED','CANCEL_PENDING'].includes(this.drivers[s.actor].state))){for(const s of steps)if(this.drivers[s.actor].state==='PLAYING')this.drivers[s.actor].cancel();this.state='RECOVERY_REQUIRED';return;}
    if(steps.every(s=>this.drivers[s.actor].state==='IDLE')){this.beat++;if(this.beat===this.plan.beats.length)this.state='PLAYBACK_COMPLETED';else this.beginBeat();}
  }
  cancel(){if(this.state!=='RUNNING')return;for(const s of this.plan.beats[this.beat].parallel)this.drivers[s.actor].cancel();this.state='RECOVERY_REQUIRED';}
}
