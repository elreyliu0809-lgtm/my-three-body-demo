import * as T from 'three';
import {verifyLibrary,ThreeActionDriver} from '/my-three-body-demo/playtest-r02/source/action-driver.mjs';
export async function createAnimation({asset,jumpAsset,actorRoot,contract,sweep}){
 const verification=await verifyLibrary(asset,contract),mixer=new T.AnimationMixer(asset.scene),markers=[];
 const driver=new ThreeActionDriver({THREE:T,asset,actorRoot,contract,verification,mixer,authorize:()=>({ok:true}),sweep,emit:e=>markers.push(e)});
 const jump=jumpAsset.animations.find(c=>c.name==='jump_to_table');if(!jump)throw Error('EXTERNAL_JUMP_CLIP_REQUIRED');
 // Same reference skin identity was verified for the R02 library. External clip
 // bindings must additionally resolve every track on this actual instance.
 for(const track of jump.tracks){const name=track.name.slice(0,track.name.lastIndexOf('.'));if(!asset.scene.getObjectByName(name))throw Error('JUMP_TRACK_BINDING:'+name);}
 const jumpAction=mixer.clipAction(jump),walk=mixer.clipAction(asset.animations.find(c=>c.name==='walk_in_place'));
 const root=asset.scene.getObjectByName('root'),feet=['foot_L','foot_R'].map(n=>asset.scene.getObjectByName(n)),bind=root.position.clone();
 let jumpOwned=false,walkOwned=false;
 function feetY(){actorRoot.updateMatrixWorld(true);return Math.min(...feet.map(f=>f.getWorldPosition(new T.Vector3()).y-.1));}
 return {driver,mixer,markers,verification,jumpDuration:jump.duration,feetY,
  nativeSample(time,launch){if(!jumpOwned){mixer.stopAllAction();jumpAction.reset().setLoop(T.LoopOnce,1).play();jumpAction.clampWhenFinished=true;jumpOwned=true;walkOwned=false;}actorRoot.position.set(launch.x,launch.y,launch.z);actorRoot.rotation.y=0;jumpAction.time=Math.min(jump.duration,time);jumpAction.paused=true;mixer.update(0);actorRoot.updateMatrixWorld(true);const p=root.getWorldPosition(new T.Vector3());return {position:{x:p.x,y:p.y,z:p.z},feet_y:feetY(),phase:time<1.2?'approach':time<1.65?'crouch':time<1.85?'takeoff':time<2.6?'airborne':'landing'};},
  transferJump(position){actorRoot.position.set(position.x,position.y,position.z);mixer.stopAllAction();root.position.copy(bind);jumpOwned=false;walkOwned=false;actorRoot.updateMatrixWorld(true);},
  locomotion(dt,speed){if(speed>.01){if(!walkOwned){mixer.stopAllAction();walk.reset().setLoop(T.LoopRepeat,Infinity).play();walkOwned=true;}walk.paused=false;mixer.update(dt*speed/.76);}else if(walkOwned){mixer.stopAllAction();walkOwned=false;root.position.copy(bind);}},
  clip(step,ctx){walkOwned=false;jumpOwned=false;const clip=step.primitive_id==='dance.perform'?'dance_loop':step.primitive_id==='gesture.perform'?step.parameters.gesture_id:step.parameters.clip_id;driver.play({primitive:'play_clip',actor:'player',clip,targetId:step.target_id,params:{rate:step.parameters.tempo_scale??1,cycles:step.parameters.cycles??1}},{request_id:ctx.request.request_id,world_version:ctx.cursor});},
 };
}
