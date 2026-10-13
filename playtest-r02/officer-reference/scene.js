import * as THREE from 'three';
import {GLTFLoader} from '/my-three-body-demo/playtest-r02/project/delivery/2026-10-10_demo-update/site/vendor/GLTFLoader.js';
const base='/my-three-body-demo/playtest-r02/project/art/2026-10-11_officer-style-r03/';
const canvas=document.querySelector('canvas'),scene=new THREE.Scene();
scene.background=new THREE.Color('#303a40');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(1920,1080,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
scene.add(new THREE.HemisphereLight(0xd9e6eb,0x5b554b,1.6));
const lights=[{position:[-3,4,4],intensity:2,color:0xffeee0},{position:[3,3,2],intensity:1.2,color:0xd8e8ff},{position:[0,3,-3],intensity:1.5,color:0xe4efff}];
lights.forEach((p,i)=>{p.castShadow=i===0;p.shadowNormalBias=.012;const light=new THREE.DirectionalLight(p.color,p.intensity);light.position.fromArray(p.position);light.target.position.set(0,1,0);light.castShadow=p.castShadow;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:12});light.shadow.bias=-.0003;light.shadow.normalBias=p.shadowNormalBias;scene.add(light,light.target);});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({color:0x41494c,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(30,16/9,.01,40),loader=new GLTFLoader();
const presets={portrait:{position:[.49,1.79,1.55],target:[0,1.59,0],fov:30},before:{position:[.49,1.79,1.55],target:[0,1.59,0],fov:30},front:{position:[0,1.03,3.4],target:[0,.95,0],fov:38},side:{position:[3.4,1.03,0],target:[0,.95,0],fov:38},back:{position:[0,1.03,-3.4],target:[0,.95,0],fov:38},pair:{position:[.15,1.30,3.4],target:[0,1.06,0],fov:38}};
const loaded={};window.__errors=[];
function stats(g){const result={meshes:0,triangles:0,skinnedMeshes:0,materials:[],textures:[],sockets:{}};const mats=new Set(),textures=new Set();g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.name.startsWith('socket_'))result.sockets[o.name]=o.getWorldPosition(new THREE.Vector3()).toArray();if(o.isMesh){result.meshes++;result.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;result.skinnedMeshes+=Number(o.isSkinnedMesh===true);for(const m of (Array.isArray(o.material)?o.material:[o.material])){mats.add(m.name);for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])if(m[slot])textures.add(m[slot].name||slot);}o.castShadow=true;o.receiveShadow=true;}});result.materials=[...mats];result.textures=[...textures];result.clips=g.animations.map(a=>a.name);const b=new THREE.Box3().setFromObject(g.scene);result.boundsRuntimeWorld={min:b.min.toArray(),max:b.max.toArray()};return result;}
window.showShot=async name=>{const p=presets[name];if(!p)throw Error('Unknown shot');for(const asset of Object.values(loaded)){asset.scene.visible=false;asset.scene.position.set(0,0,0);}
  const g=name==='before'?loaded.old:loaded.officer;g.scene.visible=true;
  if(name==='pair'){g.scene.position.x=-.48;loaded.hero.scene.visible=true;loaded.hero.scene.position.x=.48;loaded.hero.scene.rotation.y=Math.PI;}
  camera.position.fromArray(p.position);camera.fov=p.fov;camera.lookAt(...p.target);camera.updateProjectionMatrix();renderer.render(scene,camera);
  window.__evidence={candidate:'MT_OFFICER_STYLE_R03',shot:name,renderer:'Three.js',revision:THREE.REVISION,browser:navigator.userAgent,canvas:[1920,1080],dpr:1,colorSpace:'SRGB',toneMapping:'ACESFilmic',exposure:1.12,shadow:'PCFSoftShadowMap 2048',hemisphere:{sky:0xd9e6eb,ground:0x5b554b,intensity:1.6},lights,camera:p,officer:stats(loaded.officer),old:stats(loaded.old),hero:stats(loaded.hero),modelTransforms:{officer:{position:g.scene.position.toArray(),rotation:g.scene.rotation.toArray()},hero:name==='pair'?{position:loaded.hero.scene.position.toArray(),rotation:loaded.hero.scene.rotation.toArray()}:null},webgl:renderer.getContext().getParameter(renderer.getContext().VERSION)};
  document.querySelector('#stats').textContent=JSON.stringify(window.__evidence,null,2);await new Promise(requestAnimationFrame);return window.__evidence;};
try{for(const [name,path] of Object.entries({officer:base+'runtime/officer.glb',old:'/my-three-body-demo/playtest-r02/project/art/2026-10-09_art-production-r02/runtime/officer-pilot.glb',hero:'/my-three-body-demo/playtest-r02/project/art/2026-10-11_character-stage-polish-r03/runtime/protagonist.glb'})){loaded[name]=await loader.loadAsync(path);stats(loaded[name]);loaded[name].scene.visible=false;scene.add(loaded[name].scene);}await window.showShot('portrait');window.__ready=true;}
catch(error){window.__errors.push(String(error));document.querySelector('#failure').textContent=String(error);}
document.querySelectorAll('[data-shot]').forEach(b=>b.onclick=()=>window.showShot(b.dataset.shot));
