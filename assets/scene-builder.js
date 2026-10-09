(function(){
window.SceneAssets={build(T){
const scene=new T.Scene();scene.background=new T.Color(0x7c939f);scene.fog=new T.FogExp2(0x657b87,.027);const camera=new T.PerspectiveCamera(40,2,.05,70);
const cube=new T.BoxGeometry(1,1,1);const mats={};
function mat(color,roughness=.76,metalness=.0){const key=color+':'+roughness+':'+metalness;return mats[key]||(mats[key]=new T.MeshStandardMaterial({color,roughness,metalness}));}
function box(parent,w,h,d,x,y,z,material){const mesh=new T.Mesh(cube,typeof material==='number'?mat(material):material);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function grainTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const image=ctx.createImageData(128,128);let seed=913;for(let i=0;i<image.data.length;i+=4){seed=(seed*16807)%2147483647;const v=210+(seed%36);image.data.set([v,v,v,255],i);}ctx.putImageData(image,0,0);const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(5,5);return tex;}
const concrete=new T.MeshStandardMaterial({color:0x849292,map:grainTexture(),roughness:.91});const steel=mat(0x455255,.48,.5);const floorMat=new T.MeshStandardMaterial({color:0x8e9998,map:grainTexture(),roughness:.63,metalness:.13});
box(scene,18,.22,17,0,-.16,-3,floorMat);box(scene,18,5,.25,0,2.5,-9,concrete);
for(let x=-9;x<=9;x+=1.5)box(scene,.013,.004,16,x,-.045,-3,0x5b6868);for(let z=-10;z<=5;z+=1.5)box(scene,18,.004,.012,0,-.04,z,0x5b6868);
for(const x of [-6,-3,3.8,7]){box(scene,.34,5.8,.4,x,2.9,-4,concrete);box(scene,.42,.13,.5,x,.15,-4,steel);box(scene,.42,.12,.5,x,4.8,-4,steel);}
for(let x=-8;x<=8;x+=2){box(scene,.05,4.8,.07,x,3,-8.78,steel);box(scene,1.97,.035,.09,x+.95,2.6,-8.77,steel);}
for(let x=-7;x<=7;x+=2){box(scene,.12,.15,14,x,5.1,-3,steel);for(let z=-8;z<=2;z+=3)box(scene,1.45,.022,.07,x,5.03,z,new T.MeshStandardMaterial({color:0xd1dccf,emissive:0xbacdc0,emissiveIntensity:1.4}));}
const glass=new T.MeshPhysicalMaterial({color:0xa1b8c1,transparent:true,opacity:.14,roughness:.09,metalness:.1,depthWrite:false});
box(scene,17,4.4,.02,0,3,-8.73,glass);
for(let i=0;i<16;i++){const x=-10+i*1.25,h=2.3+(i%5)*.7;box(scene,.9,h,1.1,x,h/2,-12-(i%3),0x718b97);for(let y=.4;y<h;y+=.45)box(scene,.92,.025,1.12,x,y,-12-(i%3),0x849eaa);}
function sign(text,width,height,x,y,z,small='',color='#d8e0d3',bg='#1d3339'){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#758982';ctx.lineWidth=2;ctx.strokeRect(20,20,984,216);ctx.textAlign='center';ctx.fillStyle=color;ctx.font='500 66px Microsoft YaHei, sans-serif';ctx.fillText(text,512,small?115:150);if(small){ctx.fillStyle='#95aaa3';ctx.font='28px Microsoft YaHei, sans-serif';ctx.fillText(small,512,185);}const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map:texture});const mesh=new T.Mesh(new T.PlaneGeometry(width,height),m);mesh.position.set(x,y,z);scene.add(mesh);return mesh;
}
sign('澳大利亚 · 强制转运',4.7,1.14,3.55,3.4,-5.0,'服从迁徙令  /  按名单通过检查点','#dbc7a3','#1b2e34');
sign('地球治安军',2.75,.64,-1.9,2.75,-2.9,'征募登记  /  执行迁徙秩序','#cbd7c5','#243a38');
sign('前往澳大利亚',1.75,.44,3.6,1.75,-3.9,'', '#bac9bf','#24363c');
const table=new T.Group();scene.add(table);box(table,2.15,.98,.88,-.32,.49,0,mat(0x485654,.66,.25));box(table,2.32,.065,1.02,-.32,1.015,0,mat(0x97a49b,.33,.35));box(table,2.03,.015,.03,-.32,.83,.45,0x9db19d);box(table,.035,1.03,.63,-1.46,1.52,-.17,glass);box(table,.045,1.05,.05,-1.46,1.53,.17,steel);
box(table,.46,.07,.30,-1.01,1.08,-.26,0x232e32);const terminal=box(table,.43,.30,.045,-1.01,1.23,-.20,mat(0x233237,.4,.3));terminal.rotation.x=-.25;box(table,.36,.2,.005,-1.01,1.23,-.169,new T.MeshBasicMaterial({color:0x526d6b}));
const paper=new T.Group();box(paper,.39,.006,.3,0,0,0,mat(0xe4dec9,.9));for(let i=0;i<5;i++)box(paper,.27-i*.018,.002,.005,0,.005,-.075+i*.031,0x8d9485);box(paper,.043,.002,.04,-.134,.005,-.106,0x3e5651);scene.add(paper);paper.position.set(-.30,1.06,-.27);
const pen=box(scene,.012,.012,.18,-.55,1.07,.16,0x24363a);pen.rotation.y=.55;
function barrier(x,z){box(scene,.075,.9,.075,x,.45,z,steel);box(scene,.18,.06,.18,x,.03,z,steel);box(scene,.05,.05,1.05,x,.73,z-.5,0x354842);}
for(let z=-4.1;z<=.1;z+=1.05){barrier(2.30,z);barrier(4.80,z);}box(scene,.16,2.12,.3,2.6,1.06,-4.3,0x394d51);box(scene,.16,2.12,.3,4.6,1.06,-4.3,0x394d51);box(scene,2.16,.15,.3,3.6,2.14,-4.3,0x394d51);
const gateArm=box(scene,1.90,.06,.065,3.59,.95,-4.27,0xb0b5a1);const indicator=box(scene,.07,.12,.015,2.6,1.48,-4.12,new T.MeshStandardMaterial({color:0x78999d,emissive:0x366264,emissiveIntensity:.6}));
// Every actor owns a fixed world root. All shots reuse these roots; no image-plane identity substitution.
const actors={};
function actor(id,x,z,yaw,coatColor,skinColor,kind){
  const root=new T.Group();root.position.set(x,0,z);root.rotation.y=yaw;root.name=id;root.userData.actorId=id;scene.add(root);const body=new T.Group();root.add(body);const skin=mat(skinColor,.9);const coat=mat(coatColor,.89);const pants=mat(kind==='officer'?0x313b3c:0x354148,.93);const torso=box(body,.43,.57,.245,0,1.15,0,coat);box(body,.14,.34,.016,0,1.28,.132,mat(kind==='officer'?0xb5bbb0:0xab9e86));box(body,.42,.04,.25,0,.84,0,0x20282d);box(body,.072,.044,.023,0,.84,.143,steel);
  const legs=[];for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.11,.84,0);body.add(leg);box(leg,.174,.43,.188,0,-.21,0,pants);box(leg,.166,.35,.175,0,-.59,.003,pants);box(leg,.18,.095,.29,0,-.79,.045,mat(0x263036,.72));legs.push(leg);}
  const arms=[];for(const side of [-1,1]){const arm=new T.Group();arm.position.set(side*.285,1.38,0);arm.rotation.z=side*.06;body.add(arm);box(arm,.155,.34,.17,0,-.14,0,coat);const forearm=new T.Group();forearm.position.set(0,-.31,0);arm.add(forearm);box(forearm,.145,.26,.155,0,-.12,0,coat);box(forearm,.12,.12,.105,0,-.29,.008,skin);for(let finger=0;finger<3;finger++)box(forearm,.028,.07,.067,-.037+finger*.033,-.355,.012,skin);arms.push({arm,forearm});}
  box(body,.13,.13,.13,0,1.48,0,skin);const head=new T.Group();head.position.set(0,1.69,0);body.add(head);box(head,.405,.382,.342,0,0,0,skin);box(head,.05,.075,.1,-.223,-.018,.00,skin);box(head,.05,.075,.1,.223,-.018,.00,skin);
  const dark=mat(0x272725,.87);const eyeWhite=mat(0xd9d5bf,.93);for(const side of [-1,1]){box(head,.073,.097,.007,side*.095,-.018,.177,eyeWhite);box(head,.042,.091,.009,side*.104,-.018,.183,dark);const brow=box(head,.10,.016,.013,side*.095,.057,.182,dark);brow.rotation.z=side*-.07;}
  const mouth=box(head,.048,.016,.013,0,-.116,.182,mat(0x705548));box(head,.030,.06,.016,.007,-.055,.184,skin);
  const hairColor=kind==='companion'?0x423b32:0x292b2b;box(head,.421,.079,.354,0,.201,-.002,hairColor);box(head,.419,.20,.052,0,.105,-.182,hairColor);box(head,.055,.23,.315,-.191,.09,-.01,hairColor);box(head,.037,.20,.31,.199,.102,-.01,hairColor);
  for(let i=0;i<6;i++){const fringe=box(head,.083,.047,.13,-.161+i*.062,.174+(i%2)*.012,.125,hairColor);fringe.rotation.z=-.12;fringe.rotation.x=.1;}
  if(kind==='player'){box(body,.38,.057,.30,0,1.455,0,mat(0x975e3d));const scarfTail=box(body,.089,.265,.038,-.065,1.32,.159,0x975e3d);scarfTail.rotation.z=.06;const strap=box(body,.048,.64,.02,.055,1.17,.143,mat(0x8a8470));strap.rotation.z=-.31;box(body,.28,.31,.15,.295,.83,.075,mat(0x827b63));box(body,.28,.035,.165,.295,.98,.075,0x676b5b);}
  if(kind==='officer'){for(const side of [-1,1]){box(body,.16,.028,.13,side*.2,1.445,.009,0x273c38);box(body,.027,.012,.09,side*.2,1.463,.016,0x879a81);}box(body,.062,.085,.015,-.122,1.288,.143,0x435c56);for(let i=0;i<3;i++)box(body,.016,.016,.016,0,1.22-i*.075,.148,0x515e56);}
  if(kind==='companion'){box(body,.24,.32,.17,-.3,.81,0,0x626752);box(body,.055,.6,.025,-.08,1.2,.15,0x6d7460);}
  actors[id]={id,root,body,head,mouth,arms,legs,base:{x,z,yaw},kind};return actors[id];
}
const player=actor('player',-.78,1.13,Math.PI,0x354655,0xcda681,'player');const officer=actor('officer',-.25,-.70,.12,0x81938a,0xc1a487,'officer');const companion=actor('companion',-1.62,1.30,1.8,0x5d6c68,0xd0b297,'companion');
for(let i=0;i<7;i++){actor('queue-'+i,3.15+(i%2)*.73,-3.05+(Math.floor(i/2)*.85),Math.PI, [0x4d5a5c,0x69706c,0x556165][i%3],0xad9880,'queue');box(scene,.25,.33,.15,3.4+(i%2)*.73,.17,-2.98+Math.floor(i/2)*.85,mat(0x484e49));}
const contact=actor('contact',-3.1,-2.05,.95,0x454f4c,0xbaa68a,'contact');box(scene,.3,2.7,.25,-3.35,1.35,-1.75,concrete);box(scene,1.10,2.8,.16,-3.75,1.4,-2.8,0x3b4c51);
scene.add(new T.HemisphereLight(0xc4d1d3,0x4b5044,2.0));const key=new T.DirectionalLight(0xe3d7bf,3.2);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-9;key.shadow.camera.right=9;key.shadow.camera.top=9;key.shadow.camera.bottom=-9;key.shadow.normalBias=.035;key.shadow.bias=-.0005;scene.add(key);
const fill=new T.DirectionalLight(0xa6c6dc,1.8);fill.position.set(2,4,-8);scene.add(fill);const deskLight=new T.PointLight(0xc5dbc5,12,8,2);deskLight.position.set(-.8,3.8,.5);scene.add(deskLight);

scene.name="occupation_checkpoint";paper.name="application";table.name="counter";pen.name="pen";contact.root.name="contact";return {scene,camera,actors,paper,table,pen,gateArm,indicator};
}};
})();
