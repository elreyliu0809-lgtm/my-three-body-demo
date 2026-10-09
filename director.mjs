import {validatePerformance,ACTORS} from './protocol.mjs';
const home={player:{x:-.78,z:1.13,yaw:Math.PI},officer:{x:-.25,z:-.70,yaw:.12},companion:{x:-1.62,z:1.30,yaw:1.8}};
const endpoint=(position,id)=>position==='queue'&&id!=='officer'?(id==='player'?{x:3.15,z:.22,yaw:Math.PI}:{x:3.71,z:1.10,yaw:Math.PI}):position==='side_passage'&&id==='player'?{x:-2.25,z:-1.04,yaw:4.4}:home[id];
const smooth=n=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:a.yaw+(b.yaw-a.yaw)*t});
export class PerformanceDirector{
  constructor(){this.restore({position:'counter',application:'offered'});}
  restore(state){this.state=structuredClone(state);this.roots=Object.fromEntries(ACTORS.map(id=>[id,{...endpoint(state.position,id)}]));this.from=structuredClone(this.roots);this.to=structuredClone(this.roots);this.beats=[];this.proposal=null;this.duration=0;this.moving=false;}
  start(proposal,state){const beats=validatePerformance(proposal.performance,proposal.action);this.from=structuredClone(this.roots);this.state=structuredClone(state);this.to=Object.fromEntries(ACTORS.map(id=>[id,{...endpoint(state.position,id)}]));this.moving=ACTORS.some(id=>Math.hypot(this.from[id].x-this.to[id].x,this.from[id].z-this.to[id].z)>.05);this.beats=beats;this.proposal=proposal;this.duration=Math.max(...beats.map(b=>b.at+b.seconds),this.moving?5:0);return this.duration;}
  sample(seconds){const t=Math.max(0,seconds),done=t>=this.duration;const poses=Object.fromEntries(ACTORS.map(id=>[id,{root:{...this.to[id]},gaze:null,nod:0,talking:0,take:0,push:0,hold:0,walk:0}]));
    for(const id of ACTORS){const a=this.from[id],b=this.to[id];if(this.moving&&id!=='officer'&&Math.hypot(a.x-b.x,a.z-b.z)>.05){const u=smooth(t/5);let via;
      if(this.state.position==='side_passage')via={x:-1.97,z:Math.max(a.z,1.13),yaw:4.4};
      else if(this.state.position==='queue')via={x:1.45,z:id==='player'?1.13:1.75,yaw:Math.PI/2};
      else via={x:1.45,z:id==='player'?1.13:1.75,yaw:Math.PI};
      poses[id].root=u<.48?mix(a,via,u/.48):mix(via,b,(u-.48)/.52);poses[id].walk=t<5?Math.sin(t*7)*.16:0;
    }}
    let caption=null;const active=[];
    for(const b of this.beats){const age=t-b.at;if(age<0)continue;const p=poses[b.actor],inside=age<b.seconds,blend=Math.sin(Math.PI*Math.min(1,age/b.seconds));
      if(inside)active.push({...b,age});
      if(b.verb==='look_at'&&inside)p.gaze={target:b.target,weight:Math.min(1,blend*2)};
      if(b.verb==='nod'&&inside)p.nod=Math.sin(age*5)*.075*blend;
      if(b.verb==='take_paper'&&inside)p.take=smooth(age/b.seconds);
      if(b.verb==='hold_paper'&&inside)p.hold=blend;
      if(b.verb==='push_paper'&&inside)p.push=blend;
      if(b.verb==='talk'&&inside){p.talking=blend;caption={speaker:b.actor,line:b.actor==='officer'?this.proposal.npc:this.proposal.companion};}
    }
    if(done)this.roots=structuredClone(this.to);
    return {poses,active,caption,done,duration:this.duration,state:this.state,seconds:t};
  }
}
