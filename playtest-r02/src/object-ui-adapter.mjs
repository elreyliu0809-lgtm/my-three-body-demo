// Geometry/navigation only. Does not generate observations, story facts or receipt success.
export function createObjectUI({THREE:T,scene,camera,canvas,player,entities,canInteract}){
 const ray=new T.Raycaster(),v=new T.Vector3(),eye=new T.Vector3(),head=new T.Vector3();
 let permission=()=>true;
 const ids=['counter_top_proxy','officer','companion','application'];
 const labels={counter_top_proxy:'征募柜台',officer:'征募官',companion:'同行者',application:'柜台纸张'};
 const owns=(root,o)=>{for(let a=o;a;a=a.parent)if(a===root)return true;return false;};
 const isVisible=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
 function snapshot(){
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);eye.copy(camera.position);head.copy(player.position);head.y+=1.42;
  const choices=[];
  for(const id of ids){const root=entities[id];if(!root||!isVisible(root))continue;
   const box=new T.Box3().setFromObject(root);if(box.isEmpty())continue;box.getCenter(v);
   const dist=head.distanceTo(v);const world=v.clone(),ndc=v.clone().project(camera),visible=ndc.z>=-1&&ndc.z<=1&&Math.abs(ndc.x)<=.97&&Math.abs(ndc.y)<=.95;
   const maxDistance=id==='counter_top_proxy'?2.2:id==='application'?1.9:2.7;
   ray.set(eye,world.clone().sub(eye).normalize());ray.far=eye.distanceTo(world)+.05;
   const hits=ray.intersectObjects(scene.children,true).filter(h=>isVisible(h.object)&&!owns(player,h.object)&&!h.object.material?.transparent);
   const occluded=!!hits.length&&!owns(root,hits[0].object);
   if(!visible||dist>maxDistance||occluded)continue;
   const rect=canvas.getBoundingClientRect();choices.push({target_id:id,label:labels[id],screen:{x:(ndc.x+1)*rect.width/2,y:(1-ndc.y)*rect.height/2},distance_m:dist,visible,occluded,can_interact:canInteract()&&permission(),actions:[{id:'compose',label:'自由表达'}],reason:'真实几何导航；NPC实时回应、收件与感知未接入',source:'BOUND_NATIVE_GEOMETRY_ONLY',score:Math.hypot(ndc.x,ndc.y)+dist*.08});
  }
  choices.sort((a,b)=>a.score-b.score);return choices[0]??{target_id:null,visible:false,occluded:false,can_interact:false,actions:[],reason:'当前没有可交互的可见近处对象'};
 }
 return {snapshot,setPermission(fn){if(typeof fn!=='function')throw Error('OBJECT_PERMISSION_REQUIRED');permission=fn;}};
}
