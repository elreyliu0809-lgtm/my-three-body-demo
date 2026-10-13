import {recoverCamera} from '/my-three-body-demo/playtest-r02/r03/navigation.mjs';
export function createCameraRig({THREE:T,camera,canvas,colliders,canControl=()=>true}){
 let azimuth=0,pitch=.10,distance=3.5,previous=null,drag=null,mode='shoulder',proof={};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 canvas.addEventListener('pointerdown',e=>{if(!canControl()||e.button!==0&&e.button!==2)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!canControl()){drag=null;return;}if(!drag||drag.id!==e.pointerId)return;azimuth-=(e.clientX-drag.x)*.006;pitch=clamp(pitch+(e.clientY-drag.y)*.004,-.18,.9);drag.x=e.clientX;drag.y=e.clientY;mode='shoulder';});
 const release=()=>drag=null;canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('wheel',e=>{if(!canControl())return;e.preventDefault();distance=clamp(distance+e.deltaY*.002,1.1,4.8);mode='shoulder';},{passive:false});
 canvas.addEventListener('keydown',e=>{if(canControl()&&e.key==='Escape'){mode='shoulder';azimuth=0;pitch=.10;distance=3.5;}});
 function update(position,_actorYaw,dt){
  // World-space orbit heading is controlled only by pointer/reset, never actor yaw or WASD.
  const angle=azimuth,dist=mode==='dialogue'?1.65:distance,side=mode==='dialogue'?.85:.48;
  const pivot={x:position.x,y:position.y+1.42,z:position.z};
  const wanted={x:position.x+Math.sin(angle)*dist+Math.cos(angle)*side,y:pivot.y+Math.sin(pitch)*dist,z:position.z+Math.cos(angle)*dist-Math.sin(angle)*side};
  const safe=recoverCamera(pivot,wanted,previous,colliders,.22,dt,false);previous={x:safe.x,y:safe.y,z:safe.z};
  camera.position.set(safe.x,safe.y,safe.z);camera.fov=mode==='dialogue'?42:60;camera.updateProjectionMatrix();camera.lookAt(pivot.x,pivot.y,pivot.z);
  const clearance=!colliders.some(c=>c.camera!==false&&['x','y','z'].every((k,i)=>safe[k]>c.min[i]-.19&&safe[k]<c.max[i]+.19));
  proof={mode,heading_source:'POINTER_WORLD_SPACE',azimuth,pitch,requested_distance:dist,actual_distance:Math.hypot(safe.x-pivot.x,safe.y-pivot.y,safe.z-pivot.z),position:camera.position.toArray(),pivot,wanted,fraction:safe.fraction,target_fraction:safe.target_fraction??safe.fraction,blocker:safe.blocker,clearance,root_unmodified:true};return proof;
 }
 return {update,dialogue:()=>mode='dialogue',configure(p){if(p.azimuth!==undefined)azimuth=p.azimuth;if(p.pitch!==undefined)pitch=clamp(p.pitch,-.18,.9);if(p.distance!==undefined)distance=clamp(p.distance,1.1,4.8);mode=p.mode??'shoulder';previous=null;},snapshot:()=>structuredClone(proof)};
}
