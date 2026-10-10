import {pathTo,move,canOccupy} from './navigation.mjs';
export class ActionDirector{
 constructor(nav,table,native=null){this.nav=nav;this.table=table;this.native=native;this.done=true;this.events=[];this.phase='idle';}
 start(position,intent){
  if(!this.done)return {ok:false,reason:'ACTION_BUSY'};
  if(intent.kind!=='jump_counter')return {ok:false,reason:'ENGINE_CAPABILITY_MISSING'};
  if(position.y>.2)return {ok:false,reason:'ALREADY_ABOVE_FLOOR'};
  const c=this.table,goal={x:(c.min[0]+c.max[0])/2,y:0,z:this.native?this.native.start_z:c.max[2]+.45};
  const path=pathTo(position,goal,this.nav);if(!path.length)return {ok:false,reason:'WORLD_PATH_BLOCKED'};
  this.path=path;this.index=0;this.phase='approach';this.elapsed=0;this.done=false;this.success=false;this.cancelRequested=false;this.events=[];this.phaseEvents=[];this.goal=goal;this.landing={x:goal.x,y:c.max[1],z:(c.min[2]+c.max[2])/2};this.last={...position};return {ok:true,plan:['approach','crouch','takeoff','airborne','landing','stable']};
 }
 cancel(){if(['takeoff','airborne','landing','native_airborne','native_landing','native_takeoff'].includes(this.phase)){this.cancelRequested=true;return 'SAFE_LANDING_PENDING';}this.done=true;this.success=false;this.phase='cancelled';return 'CANCELLED';}
 tick(dt,position){
  let p={...position};dt=Math.min(dt,.05);if(this.done)return {position:p,phase:this.phase,done:true};
  if(this.phase==='approach'){
   const goal=this.path[this.index],dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),step=Math.min(d,(this.native?.walk_speed??1.65)*dt);if(d<.035){p={...goal};this.index++;if(this.index>=this.path.length){this.phase=this.native?'native_approach':'crouch';this.elapsed=0;this.launch={...p};}}else{const next=move(p,{x:dx/d*step,z:dz/d*step},this.nav);if(Math.hypot(next.x-p.x,next.z-p.z)<1e-6){this.done=true;this.phase='failed';this.reason='WORLD_PATH_BLOCKED';}p=next;}
  }else if(this.phase.startsWith('native_')){
   this.elapsed=Math.min(this.native.duration,this.elapsed+dt);const value=this.native.sample(this.elapsed,this.launch),next=value.position;
   if(!canOccupy(next,this.nav)){this.native.sample(Math.max(0,this.elapsed-dt),this.launch);this.done=true;this.phase='failed';this.reason='WORLD_NATIVE_SWEEP_BLOCKED';}else{p=next;this.phase='native_'+value.phase;if(this.elapsed===this.native.duration){if(Math.abs(value.feet_y-this.table.max[1])>.005){this.done=true;this.phase='failed';this.reason='NATIVE_CONTACT_MISMATCH';}else{this.nativeFeetY=value.feet_y;this.phase='stable';this.elapsed=0;}}}
  }else if(this.phase==='crouch'){
   this.elapsed+=dt;if(this.elapsed>=.25){this.phase='takeoff';this.elapsed=0;this.launch={...p};}
  }else if(['takeoff','airborne','landing'].includes(this.phase)){
   this.elapsed+=dt;const t=Math.min(1,this.elapsed/.96),u=Math.max(0,(t-.35)/.65),next={x:this.launch.x+(this.landing.x-this.launch.x)*u,z:this.launch.z+(this.landing.z-this.launch.z)*u,y:this.landing.y*t+4*.9*t*(1-t)};
   if(!canOccupy(next,this.nav)){this.done=true;this.phase='failed';this.reason='WORLD_SWEEP_BLOCKED';}else{p=next;this.phase=t<.12?'takeoff':t<.87?'airborne':'landing';if(t===1){p={...this.landing};this.phase='stable';this.elapsed=0;}}
  }else if(this.phase==='stable'){
   this.elapsed+=dt;if(this.elapsed>=.25){this.done=true;this.success=!this.cancelRequested;const proof={stable:true,feet_y:this.nativeFeetY??p.y,tabletop_y:this.table.max[1]};this.events.push(this.cancelRequested?{type:'body_settled',position:'on_counter',proof,cancelled:true}:{type:'counter_landing_stable',proof});}
  }
  if(this.phaseEvents.at(-1)?.phase!==this.phase)this.phaseEvents.push({phase:this.phase,position:{...p}});this.last=p;return {position:p,phase:this.phase,done:this.done,success:this.success,reason:this.reason,cancelRequested:this.cancelRequested};
 }
}
