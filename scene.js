import {PerformanceDirector} from './director.mjs';
const T=window.THREE,$=id=>document.getElementById(id),canvas=$('scene'),stage=$('stage');
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});}catch{$('graphicsError').hidden=false;throw Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const world=window.SceneAssets.build(T),{scene,camera,actors,paper}=world,director=new PerformanceDirector();
const ambience=new Audio('audio/ambience.wav'),paperSound=new Audio('audio/paper.wav');ambience.loop=true;ambience.volume=.20;paperSound.volume=.22;let audioOn=false,started=0,performing=false,lastCaption='',sample=null,testTime=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const targetPoint=id=>actors[id]?new T.Vector3(actors[id].root.position.x,1.7,actors[id].root.position.z):new T.Vector3(...({application:[-.3,1.06,.05],side_door:[-3.3,1.7,-2.4],queue:[3.3,1.5,-2],counter:[-.3,1.1,0]}[id]||[0,1.4,0]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));const normalize=a=>Math.atan2(Math.sin(a),Math.cos(a));
function poseFrame(value,clock){
  for(const [id,a] of Object.entries(actors)){
    const p=value.poses[id];a.root.position.set(p?p.root.x:a.base.x,0,p?p.root.z:a.base.z);a.root.rotation.y=p?p.root.yaw:a.base.yaw;a.body.rotation.set(0,0,0);a.body.position.y=reduced?0:Math.sin(clock*1.7+Object.keys(actors).indexOf(id))*.004;
    a.head.rotation.set(0,0,0);a.mouth.scale.y=.016;a.legs.forEach((leg,i)=>leg.rotation.x=p?(i===0?p.walk:-p.walk):0);
    a.arms.forEach((limb,i)=>{limb.arm.rotation.set(0,0,(i===0?-1:1)*.06);limb.forearm.rotation.x=-.10;});
    if(!p)continue;
    if(p.gaze){const target=targetPoint(p.gaze.target),angle=normalize(Math.atan2(target.x-p.root.x,target.z-p.root.z)-p.root.yaw);a.head.rotation.y=clamp(angle,-.9,.9)*p.gaze.weight;a.head.rotation.x=p.gaze.target==='application'?.18*p.gaze.weight:0;a.body.rotation.y=clamp(angle,-.30,.30)*p.gaze.weight;}
    a.head.rotation.x+=p.nod;
    if(p.talking){a.mouth.scale.y=.016*(1+Math.abs(Math.sin(clock*12))*2.0*p.talking);a.head.rotation.x+=Math.sin(clock*4)*.025*p.talking;a.arms[1].arm.rotation.x=-.20*p.talking;}
    if(p.push){a.arms[0].arm.rotation.x=-.6-.35*p.push;a.arms[0].forearm.rotation.x=-.2;}
  }
  const take=director.beats.find(b=>b.actor==='player'&&b.verb==='take_paper'),age=take?value.seconds-take.at:-1;
  const previousHolding=['taken','signed'].includes(director.previousApplication||value.state.application);
  let fraction=previousHolding?1:take?clamp(age/take.seconds,0,1):value.done&&['taken','signed'].includes(value.state.application)?1:0;
  if(value.state.application==='declined')fraction=0;
  const player=actors.player;if(fraction>0){player.arms[0].arm.rotation.x=-.88*fraction;player.arms[0].forearm.rotation.x=-.18*fraction;}
  scene.updateMatrixWorld(true);const hand=player.arms[0].forearm.localToWorld(new T.Vector3(0,-.29,.07));
  paper.position.set(-.30+(hand.x+.30)*fraction,1.057+(hand.y-1.057)*fraction,.05+(hand.z-.05)*fraction);paper.rotation.set(0,.02+(player.root.rotation.y-.02)*fraction,0);
  const pr=value.poses.player.root,focus=clamp((pr.x+.78)/4,0,1),mobile=stage.clientWidth<700,zoom=mobile?1.62:1;
  camera.fov=mobile?48:40;camera.position.set((3.75+focus*1.35)*zoom,2.45+(zoom-1)*.4,(4.90+focus*.35)*zoom);camera.lookAt(-.85+focus*2.6,1.52,.18);camera.updateProjectionMatrix();
  world.indicator.material.emissiveIntensity=reduced?.65:.65+Math.sin(clock*1.8)*.08;
  const caption=value.caption;if(caption){const tag=caption.speaker+caption.line;if(tag!==lastCaption){lastCaption=tag;$('speaker').textContent=caption.speaker==='officer'?'地球治安军征募官':'同行者';$('line').textContent=caption.line;}}
  renderer.render(scene,camera);
}
function resize(){const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);resize();
function tick(now){const seconds=testTime!==null?testTime:performing?Math.max(0,(now-started)/1000):director.duration;sample=director.sample(seconds);poseFrame(sample,now/1000);if(performing&&sample.done){performing=false;document.dispatchEvent(new CustomEvent('performance-ended'));}window.__ready=true;requestAnimationFrame(tick);}
function restore(state){performing=false;director.restore(state);director.previousApplication=state.application;lastCaption='';sample=director.sample(0);poseFrame(sample,performance.now()/1000);}
function perform(proposal,state){director.previousApplication=director.state.application;director.start(proposal,state);started=performance.now();performing=true;lastCaption='';if(audioOn&&proposal.performance.some(b=>b.verb==='take_paper'))paperSound.play().catch(()=>{});$('narration').textContent=proposal.narration;document.dispatchEvent(new CustomEvent('performance-started'));}
const ray=new T.Raycaster(),mouse=new T.Vector2();canvas.addEventListener('click',event=>{if(performing)return;const r=canvas.getBoundingClientRect();mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(scene.children,true)[0];if(!hit)return;let node=hit.object;while(node&&!node.userData.actorId&&node.parent)node=node.parent;const actor=node.userData.actorId;if(actor&&['officer','companion','contact'].includes(actor))document.dispatchEvent(new CustomEvent('scene-inspect',{detail:actor}));else if(hit.object.parent===paper)document.dispatchEvent(new CustomEvent('scene-inspect',{detail:'application'}));});
$('sound').addEventListener('click',()=>{audioOn=!audioOn;$('sound').textContent=audioOn?'关闭环境音':'开启环境音';$('sound').setAttribute('aria-pressed',String(audioOn));if(audioOn)ambience.play().catch(()=>{});else ambience.pause();});
window.GameView={restore,perform,exportJSON(){const fresh=window.SceneAssets.build(T);fresh.scene.updateMatrixWorld(true);return fresh.scene.toJSON();},debug(){return {performing,seconds:sample?.seconds,active:sample?.active,poses:sample?.poses,worldPositions:Object.fromEntries(['player','officer','companion'].map(id=>[id,{x:actors[id].root.position.x,z:actors[id].root.position.z,headY:actors[id].head.rotation.y,armX:actors[id].arms[0].arm.rotation.x,identity:actors[id].root.name}]))};},sampleAt(seconds){testTime=seconds;sample=director.sample(seconds);poseFrame(sample,performance.now()/1000);return this.debug();},resumeSampling(){testTime=null;}};
restore({position:'counter',application:'offered'});requestAnimationFrame(tick);document.dispatchEvent(new CustomEvent('scene-ready'));
