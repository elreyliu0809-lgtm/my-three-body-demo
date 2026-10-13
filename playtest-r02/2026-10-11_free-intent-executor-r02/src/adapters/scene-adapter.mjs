import * as T from 'three';
import {GLTFLoader} from '/my-three-body-demo/playtest-r02/baseline/vendor/GLTFLoader.js';
import {pathTo,move,canOccupy,advanceBody,clipCamera} from '/my-three-body-demo/playtest-r02/r03/navigation.mjs';
import {ActionDirector} from '/my-three-body-demo/playtest-r02/r03/director.mjs';
import {createAnimation} from '/my-three-body-demo/playtest-r02/2026-10-11_free-intent-executor-r02/src/adapters/animation-adapter.mjs';
export async function createScene(canvas,inputs){
 const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 const scene=new T.Scene();scene.background=new T.Color(0x6d8187);scene.add(new T.HemisphereLight(0xeaf4f3,0x394245,2.2));const sun=new T.DirectionalLight(0xffefd7,3);sun.position.set(-3,7,5);sun.castShadow=true;scene.add(sun);
 const loader=new GLTFLoader();async function load(id){const meta=inputs.assets[id],b=await(await fetch(meta.url)).arrayBuffer(),h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');if(h.toUpperCase()!==meta.sha256.toUpperCase())throw Error('ASSET_SHA:'+id);const g=await loader.parseAsync(b,'');g.scene.traverse(o=>{o.castShadow=true;o.receiveShadow=true;});return g;}
 const [stage,asset,jumpAsset,officer]=await Promise.all(['stage','actions','jump','officer'].map(load));scene.add(stage.scene);
 const player=new T.Group();player.add(asset.scene);scene.add(player);player.position.set(-.25,0,2.65);
 const npc=new T.Group();npc.add(officer.scene);npc.position.set(-.25,0,-1.18);scene.add(npc);
 const layout=inputs.contracts.layout,nav={bounds:layout.bounds,colliders:structuredClone(layout.colliders),radius:.28,height:1.84},table=nav.colliders.find(c=>c.name==='counter_proxy');
 const top=stage.scene.getObjectByName('counter_top_proxy');if(!top)throw Error('ACTUAL_SUPPORT_REQUIRED');scene.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(top);table.min[0]=bb.min.x;table.max[0]=bb.max.x;table.min[2]=bb.min.z;table.max[2]=bb.max.z;table.max[1]=bb.max.y;
 if(Math.abs(table.max[1]-1.04)>.005)throw Error('COUNTER_BINDING_HEIGHT');const npcBox=new T.Box3().setFromObject(npc);nav.colliders.push({name:'officer',min:npcBox.min.toArray(),max:npcBox.max.toArray(),character:true,camera:true});
 let position={x:player.position.x,y:0,z:player.position.z},transformRevision=0,owned=false,phase='idle',keys=new Set(),manualVerticalSpeed=0;
 const animation=await createAnimation({asset,jumpAsset,actorRoot:player,contract:inputs.contracts.actions,sweep:({to})=>({ok:canOccupy({x:to.position[0],y:to.position[1],z:to.position[2]},nav)})});
 const native={duration:animation.jumpDuration,walk_speed:.76,start_z:1.65,sample:(time,launch)=>animation.nativeSample(time,launch)},director=new ActionDirector(nav,table,native);
 const anchors={counter_full_clip_start:{x:-.25,y:0,z:1.65},dance_space:{x:-1.9,y:0,z:2.15},floor_start:{x:-.25,y:0,z:2.65}},entities={player,officer:npc,counter_top_proxy:top};
 const camera=new T.PerspectiveCamera(48,1,.05,50);let cameraProof={};
 function render(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();const pivot={x:position.x,y:position.y+1,z:position.z},wanted={x:position.x+4.0,y:position.y+3.0,z:position.z+5.4};const safe=clipCamera(pivot,wanted,nav.colliders,.2);camera.position.set(safe.x,safe.y,safe.z);camera.lookAt(pivot.x,pivot.y,pivot.z);cameraProof={position:camera.position.toArray(),pivot,fraction:safe.fraction,blocker:safe.blocker,root_unmodified:true};renderer.render(scene,camera);}
 function sync(next,dt=.05){const d=Math.hypot(next.x-position.x,next.y-position.y,next.z-position.z);if(d>1e-7)transformRevision++;position={...next};player.position.set(next.x,next.y,next.z);}
 function support(){scene.updateMatrixWorld(true);let height=0,id='floor';if(position.y>.5&&position.x>=table.min[0]-.01&&position.x<=table.max[0]+.01&&position.z>=table.min[2]-.01&&position.z<=table.max[2]+.01){height=table.max[1];id='counter_top_proxy';}const feet=animation.feetY();return {support_verified:Math.abs(feet-height)<=.005,foot_error_m:Math.abs(feet-height),feet_y:feet,support_y:height,support_id:id,binding_id:'STAGE_R01_COUNTER104_OFFICER118'};}
 function bonePose(){player.updateMatrixWorld(true);return Object.fromEntries(['pelvis','chest','head','hand_L','hand_R'].map(n=>{const b=asset.scene.getObjectByName(n);return [n,{world_position:b.getWorldPosition(new T.Vector3()).toArray(),local_quaternion:b.quaternion.toArray()}];}));}
 function proof(extra={}){return {observed:true,adapter:'native-scene-R03-R02',position:{...position},phase,...support(),bone_pose:bonePose(),...extra};}
 function settledEvent(cancelled=false){return {type:'body_settled',proof:proof({stable_s:.25,cancelled})};}
 function start(step,ctx){
  if(step.primitive_id!=='timing.wait'&&!support().support_verified)throw Error('HOST_REQUIRED_SUPPORT_CHECK');
  if(step.preconditions.some(p=>p.predicate_id==='supported'&&p.expected===true&&!support().support_verified))throw Error('PRECONDITION_SUPPORT');
  const h={step,ctx,time:0,stable:0,cancelled:false,done:false};phase=step.primitive_id;
  switch(step.primitive_id){
   case 'move.to':{if(position.y>.005||animation.driver.posture!=='standing')throw Error('MOVE_POSTURE_SUPPORT');let goal={...anchors[step.parameters.anchor_id]};if(!goal)throw Error('UNKNOWN_ANCHOR');if(step.parameters.standoff_m>0){const dx=position.x-goal.x,dz=position.z-goal.z,len=Math.hypot(dx,dz);if(len>0){goal.x+=dx/len*step.parameters.standoff_m;goal.z+=dz/len*step.parameters.standoff_m;}}h.path=pathTo(position,goal,nav);h.index=0;if(!h.path.length)throw Error('PATH_BLOCKED');break;}
   case 'face.target':{const target=entities[step.parameters.target_id];if(!target||position.y>.005)throw Error('FACE_TARGET_OR_SUPPORT');const p=target.getWorldPosition(new T.Vector3());h.yaw=Math.atan2(-(p.x-position.x),-(p.z-position.z));break;}
   case 'jump.surface':{if(animation.driver.posture!=='standing'||Math.hypot(position.x+.25,position.z-1.65)>.04)throw Error('FULL_CLIP_START_REQUIRED');const r=director.start(position,{kind:'jump_counter'});if(!r.ok)throw Error(r.reason);break;}
   case 'gesture.perform':case 'dance.perform':case 'body.pose':if(!support().support_verified||position.y>.005)throw Error('CLIP_SUPPORT_REQUIRED');animation.clip(step,ctx);break;
   case 'body.stop':if(!support().support_verified)throw Error('STOP_REQUIRES_SUPPORT');animation.locomotion(0,0);break;
   case 'timing.wait':break;
   default:throw Error('ADAPTER_DISABLED');
  }return h;
 }
 function tick(h,dt){
  if(!h)return {done:true,events:[]};h.time+=dt;const s=h.step,p=s.primitive_id;phase=p;
  if(p==='jump.surface'){
   const v=director.tick(dt,position);if(v.phase.startsWith('native_')){position={...v.position};transformRevision++;}else{const before=position;sync(v.position);if(v.phase==='approach')animation.locomotion(dt,Math.hypot(v.position.x-before.x,v.position.z-before.z)/dt);}
   phase=v.phase;if(v.phase==='stable'&&!h.transferred){animation.transferJump(position);h.transferred=true;}
   if(v.done){if(!h.transferred){animation.transferJump(position);h.transferred=true;}if(v.reason){phase='failed_jump_recovery';h.recoveryVelocity??=0;const body=advanceBody(position,{x:0,z:0},nav,dt,h.recoveryVelocity);h.recoveryVelocity=body.verticalSpeed;sync(body.position);h.stable=support().support_verified?h.stable+dt:0;if(h.stable<.25)return {done:false};return {done:true,failed:true,reason:v.reason,events:[settledEvent(true)]};}const sp=support();if(!sp.support_verified)return {done:true,failed:true,reason:'OBSERVED_FOOT_SUPPORT_MISMATCH'};if(h.cancelled){h.stable+=dt;if(h.stable<.25)return {done:false};return {done:true,events:[settledEvent(true)]};}return {done:true,events:[{type:'counter_landing_stable',proof:proof({stable_s:.25,cancelled:false})}]};}
  }else if(['gesture.perform','dance.perform','body.pose'].includes(p)){
   if(!h.cancelled)animation.driver.tick(dt);
   else if(h.cancelBoundary!==undefined&&animation.driver.active?.time<h.cancelBoundary){animation.driver.tick(Math.min(dt,(h.cancelBoundary-animation.driver.active.time)/animation.driver.active.rate));if(animation.driver.active?.time>=h.cancelBoundary)animation.driver.cancel();}
   else if(animation.driver.active){if(animation.driver.state==='PLAYING')animation.driver.cancel();animation.driver.resolveRecovery({supported:support().support_verified,settled:true,posture:animation.driver.posture,reason:'grounded cancellation at safe boundary'});}
   transformRevision++;if(animation.driver.state==='RECOVERY_REQUIRED'&&!h.cancelled)return {done:true,failed:true,reason:'NATIVE_SWEEP_FAILED'};
   if(animation.driver.state==='IDLE'){h.stable+=dt;if(h.stable>=.25){if(!support().support_verified)return {done:true,failed:true,reason:'CLIP_SUPPORT_MISMATCH'};return {done:true,events:h.cancelled?[settledEvent(true)]:[{type:'body_action_completed',proof:proof({stable_s:h.stable,clip:p==='dance.perform'?'dance_loop':s.parameters.gesture_id??s.parameters.clip_id,actual_pose:animation.driver.posture})}]};}}
  }else if(h.cancelled){animation.locomotion(0,0);h.stable+=dt;if(h.stable>=.25)return {done:true,events:p==='timing.wait'?[]:[settledEvent(true)]};
  }else if(p==='move.to'){
   const goal=h.path[h.index],dx=goal.x-position.x,dz=goal.z-position.z,d=Math.hypot(dx,dz),speed=s.parameters.speed_mps,amount=Math.min(d,speed*dt),before={...position};
   if(d<.025){h.index++;if(h.index>=h.path.length){animation.locomotion(0,0);return {done:true,events:[{type:'body_action_completed',proof:proof({anchor_id:s.parameters.anchor_id,standoff_m:s.parameters.standoff_m})}]};}}
   else{const next=move(position,{x:dx/d*amount,z:dz/d*amount},nav);if(Math.hypot(next.x-position.x,next.z-position.z)<1e-7)return {done:true,failed:true,reason:'LIVE_PATH_BLOCKED'};player.rotation.y=Math.atan2(-dx,-dz);sync(next);animation.locomotion(dt,Math.hypot(next.x-before.x,next.z-before.z)/dt);}
  }else if(p==='face.target'){
   let delta=Math.atan2(Math.sin(h.yaw-player.rotation.y),Math.cos(h.yaw-player.rotation.y)),rate=s.parameters.max_yaw_rate_deg_s*Math.PI/180;player.rotation.y+=Math.sign(delta)*Math.min(Math.abs(delta),rate*dt);transformRevision++;if(Math.abs(delta)<.01)return {done:true,events:[{type:'body_action_completed',proof:proof({yaw:player.rotation.y,target_id:s.parameters.target_id})}]};
  }else if(p==='timing.wait'&&h.time>=s.parameters.seconds)return {done:true,events:[]};
  else if(p==='body.stop'){h.stable+=dt;if(h.stable>=.25)return {done:true,events:[settledEvent(false)]};}
  return {done:false};
 }
 const adapter={start,tick,cancel(h){if(!h)return;h.cancelled=true;if(h.step.primitive_id==='jump.surface'){director.cancel();if(director.done){animation.transferJump(position);h.transferred=true;}}else if(['dance.perform','body.pose'].includes(h.step.primitive_id)&&animation.driver.active){const a=animation.driver.active;h.cancelBoundary=h.step.primitive_id==='body.pose'?a.total:Math.min(a.total,Math.ceil(a.time/a.c.duration_s)*a.c.duration_s);}else if(h.step.primitive_id==='gesture.perform')animation.driver.cancel();},control(value){owned=value;keys.clear();if(!value)phase='idle';},get transformRevision(){return transformRevision;},snapshot(){return {position:{...position},phase,owner:owned?'EXECUTOR':'EXPLORE',support:support(),posture:animation.driver.posture,bone_pose:bonePose(),transform_revision:transformRevision,camera:cameraProof,clips:asset.animations.map(c=>c.name),markers:[...animation.markers],tabletop_y:table.max[1],rig_verified:animation.verification.sha,renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}};},render,
  manual(dt){if(owned||animation.driver.posture!=='standing')return;const dx=Number(keys.has('d'))-Number(keys.has('a')),dz=Number(keys.has('s'))-Number(keys.has('w')),n=Math.hypot(dx,dz),before={...position};const v=advanceBody(position,{x:n?dx/n*1.2*dt:0,z:n?dz/n*1.2*dt:0},nav,dt,manualVerticalSpeed);manualVerticalSpeed=v.verticalSpeed;sync(v.position);if(n)player.rotation.y=Math.atan2(-dx,-dz);animation.locomotion(dt,dt?Math.hypot(position.x-before.x,position.z-before.z)/dt:0);},
  capabilityProof:{adapter:'R03 navigation + shared native R02 Mixer + R01 full jump',asset_verified:true,glb_sha256:inputs.assets.actions.sha256,inverse_bind_sha256:animation.verification.sha},anchors:Object.keys(anchors),entities:Object.keys(entities),gestures:['wave_right','point_forward','look_left','look_right'],
 };
 canvas.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(!owned&&['w','a','s','d'].includes(k)){keys.add(k);e.preventDefault();}});canvas.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));canvas.addEventListener('pointerdown',()=>canvas.focus());window.addEventListener('blur',()=>keys.clear());
 render();return adapter;
}
