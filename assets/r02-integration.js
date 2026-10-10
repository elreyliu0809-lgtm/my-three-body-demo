export async function integrateR02(T,loader,world){
 const expected={officer:['officer-pilot.glb','67ad337222b3018439aead6cb3c2720f86b798742f5080e9c473e44893967020'],counter:['counter-pilot.glb','bfbc370305b708ab66d1b114a80a4596968c906d7de90326a1e0faadeaa9725d'],application:['paper-pilot.glb','f073065bf3280909f04394c1a31fe747d35129325b1cfc1cf5bdf757cc948597']};
 const loaded={};
 for(const [id,[name,sha]]of Object.entries(expected)){const response=await fetch('assets/r02/'+name);if(!response.ok)throw Error('R02 asset unavailable '+id);const bytes=await response.arrayBuffer();const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==sha)throw Error('R02 SHA mismatch '+id);const gltf=await loader.parseAsync(bytes,'');gltf.scene.traverse(o=>{o.castShadow=true;o.receiveShadow=true;});loaded[id]={root:gltf.scene,sha256:actual,clips:gltf.animations.length};}
 // Preserve stable actor root, world placement and business identity; no fake skeletal adaptation.
 const a=world.actors.officer;a.body.visible=false;a.root.rotation.y=0;a.base.yaw=0;a.root.add(loaded.officer.root);a.staticCandidate=true;
 world.table.visible=false;const counter=loaded.counter.root;counter.name='counter';counter.userData.actorId='counter';counter.position.set(a.base.x,0,a.base.z+.49);world.scene.add(counter);
 world.paper.clear();world.paper.add(loaded.application.root);world.paper.userData.actorId='application';world.paper.position.set(a.base.x+.10,1.019,a.base.z+.56);world.paper.userData.rest=world.paper.position.clone();world.paper.userData.owner='counter';world.paper.userData.binding='Static R02 rest; existing player proxy motion only, no officer hand animation';
 world.scene.updateMatrixWorld(true);const grip=world.paper.getObjectByName('grip_r');world.paper.userData.gripLocal=grip?world.paper.worldToLocal(grip.getWorldPosition(new T.Vector3())):new T.Vector3();
 world.pen.visible=false;
 world.r02={version:'R02_STATIC_PILOT_01',assets:Object.fromEntries(Object.entries(loaded).map(([id,v])=>[id,{sha256:v.sha256,clips:v.clips}])),static_officer:true,art_acceptance:false};
}
