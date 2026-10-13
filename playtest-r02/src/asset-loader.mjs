import * as T from 'three';import {GLTFLoader} from '/my-three-body-demo/playtest-r02/baseline/vendor/GLTFLoader.js';
export function createAssetLoader(specs){
 const bytes=new Map(),reports=[];
 async function binary(id){if(!specs[id])throw Error('UNKNOWN_ASSET:'+id);if(!bytes.has(id))bytes.set(id,(async()=>{const response=await fetch(specs[id].url);if(!response.ok)throw Error('ASSET_HTTP:'+id);const b=await response.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');if(sha.toUpperCase()!==specs[id].sha256.toUpperCase()||b.byteLength!==specs[id].size_bytes)throw Error('ASSET_SHA_SIZE:'+id);return b;})());return bytes.get(id);}
 async function load(id){
  const failures=[],manager=new T.LoadingManager();manager.onError=url=>failures.push(url);const g=await new GLTFLoader(manager).parseAsync((await binary(id)).slice(0),'');
  const unsupported=(g.parser.json.extensionsRequired??[]).filter(x=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(x));if(unsupported.length)throw Error('UNSUPPORTED_EXTENSION:'+unsupported.join(','));
  const actual=[];g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){const slots={};for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap']){const t=m[key];slots[key]=t?{width:t.image?.width??0,height:t.image?.height??0,color_space:t.colorSpace,channel:t.channel}:null;}actual.push({asset:id,mesh:o.name,material:m.name,slots});}}if(o.isLight)o.castShadow=false;});
  for(const m of specs[id].materials)for(const [slot,e]of Object.entries(m.slots)){const matches=actual.filter(a=>a.material===m.name);if(!matches.length||matches.some(a=>!a.slots[slot]?.width||!a.slots[slot]?.height||a.slots[slot].color_space!==e.color_space))throw Error('EXPECTED_TEXTURE_SLOT:'+id+':'+m.name+':'+slot);}
  if(failures.length)throw Error('DEPENDENCY_LOAD:'+id+':'+failures.join(','));
  reports.push({asset:id,sha256:specs[id].sha256,mesh_count:actual.length,clips:g.animations.map(c=>c.name),textures:actual.filter(m=>Object.values(m.slots).some(Boolean))});g.userData={asset_id:id,verified:true};return g;
 }
 return {load,binary,reports};
}
