export function canOccupy(p,n){
 const [xmin,xmax,zmin,zmax]=n.bounds,r=n.radius??.27,h=n.height??1.9;
 if(p.x-r<xmin||p.x+r>xmax||p.z-r<zmin||p.z+r>zmax)return false;
 return !n.colliders.some(c=>c.character!==false&&p.y<c.max[1]-.001&&p.y+h>c.min[1]+.001&&p.x+r>c.min[0]&&p.x-r<c.max[0]&&p.z+r>c.min[2]&&p.z-r<c.max[2]);
}
export function move(p,delta,n){
 const result={...p},steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.04));
 for(let i=0;i<steps;i++){let a={...result,x:result.x+delta.x/steps};if(canOccupy(a,n))result.x=a.x;a={...result,z:result.z+delta.z/steps};if(canOccupy(a,n))result.z=a.z;}
 return result;
}
// A capsule can traverse a support surface, then fall once its footprint clears it.
// Small vertical steps prevent crossing a wall/table side during descent.
export function advanceBody(p,delta,n,dt,verticalSpeed=0){
 const next=move(p,delta,n),r=n.radius??.28;
 let support=0;
 for(const c of n.colliders){if(c.character===false||c.max[1]>next.y+.005)continue;if(next.x+r>c.min[0]&&next.x-r<c.max[0]&&next.z+r>c.min[2]&&next.z-r<c.max[2])support=Math.max(support,c.max[1]);}
 let vy=verticalSpeed,grounded=false;
 if(next.y<=support+.005){next.y=support;vy=0;grounded=true;}
 else{vy-=9.81*dt;const target=Math.max(support,next.y+vy*dt),steps=Math.max(1,Math.ceil((next.y-target)/.02));for(let i=0;i<steps;i++){const candidate={...next,y:Math.max(target,next.y-(p.y-target)/steps)};if(canOccupy(candidate,n))next.y=candidate.y;else{vy=0;break;}}if(next.y<=support+.005){next.y=support;vy=0;grounded=true;}}
 return {position:next,verticalSpeed:vy,grounded,support};
}
export function recoverCamera(pivot,target,previous,colliders,padding,dt,reducedMotion=false){
 const safe=clipCamera(pivot,target,colliders,padding);
 if(!previous||reducedMotion)return safe;
 const distance=p=>Math.hypot(p.x-pivot.x,p.y-pivot.y,p.z-pivot.z);
 if(distance(safe)<distance(previous))return safe; // immediate contraction protects geometry
 const alpha=1-Math.exp(-Math.max(0,dt)/.12);
 const desired=Object.fromEntries(['x','y','z'].map(k=>[k,previous[k]+(safe[k]-previous[k])*alpha]));
 return {...clipCamera(pivot,desired,colliders,padding),target_fraction:safe.fraction};
}
export function pathTo(start,goal,n){
 const step=.2,[xmin,,zmin]=n.bounds,key=(x,z)=>x+','+z,toNode=p=>[Math.round((p.x-xmin)/step),Math.round((p.z-zmin)/step)],point=(x,z)=>({x:xmin+x*step,y:start.y,z:zmin+z*step});
 const s=toNode(start),g=toNode(goal),queue=[s],seen=new Set([key(...s)]),parents=new Map();let end;
 if(!canOccupy(goal,n))return [];
 for(let index=0;index<queue.length&&index<20000;index++){const a=queue[index];if(a[0]===g[0]&&a[1]===g[1]){end=a;break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const b=[a[0]+dx,a[1]+dz],k=key(...b);if(seen.has(k)||!canOccupy(point(...b),n))continue;seen.add(k);parents.set(k,a);queue.push(b);}}
 if(!end)return [];const path=[];while(key(...end)!==key(...s)){path.push(point(...end));end=parents.get(key(...end));}path.reverse();path.push({...goal});return path;
}
export function clipCamera(a,b,colliders,padding=.18){
 let limit=1,blocker=null;const delta={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
 for(const c of colliders){if(c.camera===false)continue;let enter=0,leave=1;for(const [i,k]of ['x','y','z'].entries()){const min=c.min[i]-padding,max=c.max[i]+padding,d=delta[k];if(Math.abs(d)<1e-8){if(a[k]<min||a[k]>max){enter=2;break;}continue;}let lo=(min-a[k])/d,hi=(max-a[k])/d;if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);leave=Math.min(leave,hi);}if(enter<=leave&&enter>=0&&enter<limit){limit=Math.max(0,enter-.015);blocker=c.name;}}
 return {x:a.x+delta.x*limit,y:a.y+delta.y*limit,z:a.z+delta.z*limit,fraction:limit,blocker};
}
