import * as THREE from 'three';

const C = (hex,roughness=.83,metalness=0) => new THREE.MeshStandardMaterial({color:hex,roughness,metalness,flatShading:true});
const MAT={
 grass:C('#72b991'),leaf:C('#24796e'),leaf2:C('#31957e'),leaf3:C('#4da787'),
 bark:C('#75563f'),stone:C('#8ea09c'),stoneB:C('#6f8687'),iron:C('#748c94',.34,.65),
 sand:C('#e0ce9e'),roof:C('#a06b56'),trim:C('#f8e7c7'),building:C('#ecd9b7'),building2:C('#c9d8c8'),
 glass:new THREE.MeshStandardMaterial({color:'#70dae3',metalness:.54,roughness:.18,emissive:'#15464e',emissiveIntensity:.35}),
 dark:C('#29454b'),water:new THREE.MeshStandardMaterial({color:'#3eccc2',transparent:true,opacity:.81,roughness:.28,metalness:.28,side:THREE.DoubleSide}),
 crate:C('#e5a95b'),wood:C('#a77a4e'),blue:C('#4d91a6'),red:C('#bd7256')
};
const RNG=(seed)=>()=>{let t=seed+=0x6d2b79f5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
const r=(rand,a,b)=>a+(b-a)*rand();
export function groundHeight(x,z){
 return Math.sin(x*.059+1.6)*.75+Math.sin(z*.049-2)*.62+
 Math.sin((x+z)*.105)*.22+Math.cos(x*.2-z*.09)*.17+
 Math.max(0,Math.hypot(x,z)-78)*.015;
}
export const BOUNDS=112;
export class IslandWorld{
 constructor(scene){
  this.scene=scene;this.rand=RNG(691104);
  this.blockers=[];this.colliders=[];this.harvestables=[];this.loot=[];this.builds=[];this.decor=[];
  this.root=new THREE.Group();scene.add(this.root);
  this.time=0;this.wind=0;
  this._buildEnvironment();
  this._makeVillage();
  this._growForest();
  this._placeRocksAndLoot();
  this.stormLine=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:128},()=>new THREE.Vector3())),new THREE.LineBasicMaterial({color:'#6dd9f1',transparent:true,opacity:.82}));
  this.root.add(this.stormLine);this.setStorm(92);
 }
 addMesh(mesh,block=false){this.root.add(mesh);if(block)this.blockers.push(mesh);return mesh;}
 box(w,h,d,material,x,y,z,block=false,rot=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z);m.rotation.y=rot;m.castShadow=block;m.receiveShadow=true;
  return this.addMesh(m,block);
 }
 cyl(rt,rb,height,material,x,y,z,sides=9,block=false){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,height,sides),material);
  m.position.set(x,y,z);m.castShadow=block;m.receiveShadow=true;return this.addMesh(m,block);
 }
 geo(geometry,material,x,y,z,block=false){
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=block;m.receiveShadow=true;return this.addMesh(m,block);
 }
 _buildEnvironment(){
  const scene=this.scene;
  scene.background=new THREE.Color('#9bd7db');
  scene.fog=new THREE.FogExp2('#9bd7db',.0085);
  scene.add(new THREE.HemisphereLight('#ddfff2','#817d69',2.15));
  const sun=new THREE.DirectionalLight('#ffe4af',3.35);
  sun.position.set(-50,75,35);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-92;sun.shadow.camera.right=92;sun.shadow.camera.top=92;sun.shadow.camera.bottom=-92;
  sun.shadow.normalBias=.034;sun.shadow.bias=-.00007;scene.add(sun);this.sun=sun;
  this.geo(new THREE.SphereGeometry(10,16,12),new THREE.MeshBasicMaterial({color:'#fff6c1',fog:false}),-105,108,-152);

  const geom=new THREE.PlaneGeometry(260,260,110,110);
  geom.rotateX(-Math.PI/2);
  const vertices=geom.attributes.position;
  const colors=[];
  const grassA=new THREE.Color('#579e7b'),grassB=new THREE.Color('#b4cd8b'),sand=new THREE.Color('#dbcda5');
  for(let i=0;i<vertices.count;i++){
   const x=vertices.getX(i),z=vertices.getZ(i),h=groundHeight(x,z);
   vertices.setY(i,h);
   const color=grassA.clone().lerp(grassB,Math.max(0,Math.min(1,.25+.48*Math.sin(x*.13+z*.17)+.16*Math.cos(z*.49))));
   if(Math.hypot(x,z)>89)color.lerp(sand,.45);
   if(h>1.15)color.lerp(sand,.26);
   colors.push(color.r,color.g,color.b);
  }
  geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geom.computeVertexNormals();
  const ground=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
  ground.receiveShadow=true;this.root.add(ground);
  // Peripheral sea, lower than the traversable island.
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.MeshStandardMaterial({color:'#62bdc4',metalness:.2,roughness:.34,transparent:true,opacity:.86}));
  sea.rotation.x=-Math.PI/2;sea.position.y=-4.3;this.root.add(sea);
  const coast=new THREE.Mesh(new THREE.RingGeometry(105,128,96),new THREE.MeshStandardMaterial({color:'#e3c69b',roughness:1,side:THREE.DoubleSide}));
  coast.rotation.x=-Math.PI/2;coast.position.y=-2.3;this.root.add(coast);
  // Thin stylized path-network gives the village a recognisable map layout.
  const pathMat=new THREE.MeshStandardMaterial({color:'#e0c997',roughness:1,transparent:true,opacity:.75,depthWrite:false});
  for(const [x,z,rot,len] of [[0,0,0,120],[0,0,Math.PI/2,105],[-39,-8,-.22,65],[25,24,.65,50]]){
   for(let i=-len/2;i<len/2;i+=2.4){
    const px=x+Math.sin(rot)*i,pz=z+Math.cos(rot)*i;
    const m=this.box(3.8,.04,2.6,pathMat,px,groundHeight(px,pz)+.035,pz,false,rot);
    m.castShadow=false;
   }
  }
  // Airborne islands and clouds give the environment depth without assets.
  const cloudMat=new THREE.MeshBasicMaterial({color:'#f8fff0',transparent:true,opacity:.36,depthWrite:false,fog:false});
  for(let i=0;i<22;i++){
   const x=r(this.rand,-150,150),z=r(this.rand,-155,155),y=r(this.rand,49,91);
   const m=this.geo(new THREE.SphereGeometry(1,7,5),cloudMat,x,y,z);
   m.scale.set(r(this.rand,6,19),r(this.rand,1.8,4),r(this.rand,4,9));m.castShadow=false;this.decor.push({m,originX:x,speed:r(this.rand,.08,.24)});
  }
 }
 _makeVillage(){
  const locations=[
   {x:0,z:-19,angle:0,size:1.1,mat:MAT.building},
   {x:-34,z:12,angle:Math.PI/2,size:1,mat:MAT.building2},
   {x:29,z:22,angle:Math.PI/2,size:1.1,mat:MAT.building},
   {x:39,z:-32,angle:.32,size:.88,mat:MAT.building2},
   {x:-22,z:-45,angle:-.34,size:.98,mat:MAT.building},
   {x:62,z:34,angle:1.8,size:.94,mat:MAT.building}
  ];
  for(let id=0;id<locations.length;id++){
   const {x,z,angle,size,mat}=locations[id],base=groundHeight(x,z);
   const group=new THREE.Group();group.position.set(x,base,z);group.rotation.y=angle;this.root.add(group);
   const add=(w,h,d,m,px,py,pz)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w*size,h*size,d*size),m);
    mesh.position.set(px*size,py*size,pz*size);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);this.blockers.push(mesh);return mesh;
   };
   add(9.7,.7,9.5,MAT.stone,0,.25,0);
   add(8.8,5.1,8.8,mat,0,2.9,0);
   const roof=new THREE.Mesh(new THREE.ConeGeometry(7.3*size,4*size,4,1),id%2?MAT.red:MAT.roof);
   roof.position.y=7.35*size;roof.rotation.y=Math.PI/4;roof.castShadow=true;group.add(roof);this.blockers.push(roof);
   for(const side of [-1,1]){
    add(.36,2.05,1.65,MAT.glass,side*4.45,3.15,-1.7);
    add(1.65,2.05,.36,MAT.glass,-2.15,3.1,side*4.45);
   }
   add(2.45,3,.12,MAT.dark,1,1.85,4.46);
   add(2.6,.18,.3,MAT.trim,1,3.38,4.6);
   // Porch, chimney, lanterns and signage.
   add(3,.28,2.1,MAT.wood,1,.27,5.4);
   add(1.2,2,1.15,MAT.stoneB,-2.6,7.6,-1.6);
   for(const dx of [-4.8,4.8]){
    add(.2,2,.3,MAT.trim,dx,2,4.3);
   }
   // Broad blocking proxy. House is not explorable but players can go around it.
   this.colliders.push({x,z,w:9.8*size,d:9.8*size,angle,type:'house'});
  }
  // Watchtower on a hill.
  const x=3,z=53,y=groundHeight(x,z);
  for(const dx of [-3,3])for(const dz of [-3,3])this.box(.75,11,.75,MAT.wood,x+dx,y+5.5,z+dz,true);
  this.box(8,.4,8,MAT.wood,x,y+10.8,z,true);
  for(const dx of [-3.8,3.8])this.box(.3,1.2,7.8,MAT.trim,x+dx,y+11.6,z);
  for(const dz of [-3.8,3.8])this.box(7.8,1.2,.3,MAT.trim,x,y+11.6,z+dz);
  this.colliders.push({x,z,w:7,d:7,type:'tower'});
  for(let i=0;i<35;i++){
   const x=r(this.rand,-87,87),z=r(this.rand,-87,87);
   if(Math.hypot(x,z)<13||this.colliders.some(c=>Math.hypot(x-c.x,z-c.z)<11))continue;
   this.box(r(this.rand,1.1,2.2),r(this.rand,1,2.2),r(this.rand,1.1,2.2),i%3?MAT.crate:MAT.blue,x,groundHeight(x,z)+.6,z,true,r(this.rand,-.5,.5));
  }
 }
 _growForest(){
  for(let i=0;i<120;i++){
   const x=r(this.rand,-97,97),z=r(this.rand,-97,97);
   if(Math.hypot(x,z)>104||this.colliders.some(c=>Math.hypot(x-c.x,z-c.z)<10)||Math.hypot(x,z)<14)continue;
   const h=groundHeight(x,z),scale=r(this.rand,.72,1.7);
   const pine=this.rand()<.65;
   this.cyl(.3*scale,.51*scale,3*scale,MAT.bark,x,h+1.5*scale,z,7,true);
   if(pine){
    for(let k=0;k<3;k++)this.geo(new THREE.ConeGeometry((2.15-k*.35)*scale,3.9*scale,7),k%2?MAT.leaf2:MAT.leaf,x,h+(3+k*1.1)*scale,z);
   }else{
    for(const [dx,dy,dz] of [[0,4,0],[-.95,3.5,.3],[.8,3.8,-.1]]){
     const m=this.geo(new THREE.IcosahedronGeometry(1.9*scale,0),MAT.leaf3,x+dx*scale,h+dy*scale,z+dz*scale);m.rotation.y=r(this.rand,-1,1);
    }
   }
   this.colliders.push({x,z,w:.85*scale,d:.85*scale,type:'tree'});
   if(this.rand()<.73)this.harvestables.push({kind:'wood',x,z,health:3,maxHealth:3,alive:true,nodeY:h+2*scale});
  }
 }
 _placeRocksAndLoot(){
  for(let i=0;i<42;i++){
   const x=r(this.rand,-93,93),z=r(this.rand,-93,93),s=r(this.rand,.65,2.1);
   if(Math.hypot(x,z)>105||this.colliders.some(c=>Math.hypot(x-c.x,z-c.z)<6))continue;
   const kind=i%6===0?'metal':'stone';
   const m=this.geo(new THREE.DodecahedronGeometry(s,0),kind==='metal'?MAT.iron:MAT.stone,x,groundHeight(x,z)+s*.55,z,true);
   m.scale.set(1,.65,1.1);m.rotation.y=this.rand()*3;
   this.harvestables.push({kind,x,z,health:4,maxHealth:4,alive:true,mesh:m,nodeY:groundHeight(x,z)+s*.55});
   this.colliders.push({x,z,w:s*1.25,d:s*1.25,type:'rock'});
  }
  for(let i=0;i<28;i++){
   const x=r(this.rand,-86,86),z=r(this.rand,-86,86);
   if(this.colliders.some(c=>Math.hypot(x-c.x,z-c.z)<5))continue;
   this.spawnLoot(x,z, i%5===0?'heal':i%3===0?'ammo':'shield',true);
  }
 }
 spawnLoot(x,z,kind='ammo',initial=false){
  const mat=kind==='heal'?new THREE.MeshStandardMaterial({color:'#ff8da3',emissive:'#851d46',emissiveIntensity:.25}):
    kind==='shield'?new THREE.MeshStandardMaterial({color:'#71def6',emissive:'#1885b3',emissiveIntensity:.32}):
    new THREE.MeshStandardMaterial({color:'#ffc06f',emissive:'#af6827',emissiveIntensity:.2});
  const group=new THREE.Group();group.position.set(x,groundHeight(x,z)+.85,z);
  const mesh=new THREE.Mesh(kind==='ammo'?new THREE.BoxGeometry(.7,.66,.65):new THREE.OctahedronGeometry(.7),mat);
  mesh.castShadow=true;group.add(mesh);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.075,6,30),new THREE.MeshBasicMaterial({color:kind==='heal'?'#ff9ba9':kind==='shield'?'#7af9fc':'#ffe5a4'}));
  ring.rotation.x=Math.PI/2;ring.position.y=-.52;group.add(ring);this.root.add(group);
  const obj={kind,x,z,group,baseY:group.position.y,phase:this.rand()*8,alive:true};
  this.loot.push(obj);return obj;
 }
 collectLoot(obj){obj.alive=false;this.root.remove(obj.group);}
 harvest(node){if(!node.alive)return false;node.health--;if(node.health<=0){node.alive=false;if(node.mesh)this.root.remove(node.mesh);}return true;}
 isBlocked(x,z,radius=.5){
  if(Math.abs(x)>104||Math.abs(z)>104||Math.hypot(x,z)>108)return true;
  for(const c of this.colliders){
   if(c.type==='house'){
    // conservative round collision for rotated houses
    if(Math.abs(x-c.x)<c.w*.52+radius && Math.abs(z-c.z)<c.d*.52+radius)return true;
   }else if(Math.abs(x-c.x)<c.w*.5+radius && Math.abs(z-c.z)<c.d*.5+radius)return true;
  }
  for(const b of this.builds){
   if(b.hp<=0)continue;
   if(b.type==='floor'||b.type==='roof')continue;
   const dx=x-b.x,dz=z-b.z;
   if(b.type==='wall'){
    const along=Math.abs(dx*Math.cos(b.angle)+dz*-Math.sin(b.angle));
    const across=Math.abs(dx*Math.sin(b.angle)+dz*Math.cos(b.angle));
    if(along<2.1+radius&&across<.27+radius)return true;
   }else if(Math.hypot(dx,dz)<1.3+radius)return true;
  }
  return false;
 }
 resolveXZ(position,nextX,nextZ,radius=.48){
  let x=position.x,z=position.z;
  if(!this.isBlocked(nextX,z,radius))x=nextX;
  if(!this.isBlocked(x,nextZ,radius))z=nextZ;
  position.x=x;position.z=z;
 }
 // Building meshes and transparent preview are separate to keep collision correct.
 buildPart(type,x,z,angle=0,material='wood',ghost=false){
  const root=new THREE.Group();
  const materials={
   wood:{solid:C('#b18d5f'),trim:C('#e2ba7c')},
   stone:{solid:C('#94a39d'),trim:C('#c5cbc2')},
   metal:{solid:C('#577d8b',.38,.64),trim:C('#9cc7d1',.35,.54)}
  };
  const m=materials[material]||materials.wood;
  const ghostMat=new THREE.MeshStandardMaterial({color:'#72ffbc',emissive:'#4affbc',emissiveIntensity:.24,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false});
  const add=(geo,mat,px,py,pz,rx=0)=>{
   const mesh=new THREE.Mesh(geo,ghost?ghostMat:mat);mesh.position.set(px,py,pz);mesh.rotation.x=rx;mesh.castShadow=!ghost;mesh.receiveShadow=!ghost;root.add(mesh);return mesh;
  };
  if(type==='wall'){
   add(new THREE.BoxGeometry(4,3,.2),m.solid,0,1.5,0);
   for(const px of [-1.98,-1.32,-.66,0,.66,1.32,1.98])add(new THREE.BoxGeometry(.085,3.1,.29),m.trim,px,1.5,0);
   for(const py of [.12,2.9])add(new THREE.BoxGeometry(4.1,.13,.29),m.trim,0,py,0);
  }else if(type==='floor'){
   add(new THREE.BoxGeometry(4,.24,4),m.solid,0,.13,0);
   for(const p of [-1.9,-.95,0,.95,1.9])add(new THREE.BoxGeometry(.09,.3,4.05),m.trim,p,.13,0);
  }else if(type==='ramp'){
   add(new THREE.BoxGeometry(4,.25,5.05),m.solid,0,1.45,0,-.51);
   for(const p of [-1.92,1.92])add(new THREE.BoxGeometry(.15,.38,5.08),m.trim,p,1.47,0,-.51);
   for(let p=-1.9;p<=2;p+=.82)add(new THREE.BoxGeometry(4,.32,.10),m.trim,0,1.45+p*.244,p,-.51);
  }else{
   add(new THREE.ConeGeometry(3.22,2.6,4),m.solid,0,1.37,0);
   for(const p of [-2,2])add(new THREE.BoxGeometry(4,.12,.12),m.trim,0,.25,p);
  }
  const gy=groundHeight(x,z);
  root.position.set(x,gy,z);root.rotation.y=angle;
  if(ghost)root.traverse(o=>{if(o.isMesh)o.renderOrder=3});
  return root;
 }
 addBuild(type,x,z,angle,mat){
  const root=this.buildPart(type,x,z,angle,mat);
  this.root.add(root);
  const obj={type,x,z,angle,mat,root,hp:mat==='metal'?290:mat==='stone'?220:150,maxHp:mat==='metal'?290:mat==='stone'?220:150};
  this.builds.push(obj);
  return obj;
 }
 damageBuild(obj,damage){
  obj.hp-=damage;
  if(obj.hp<=0){
   this.root.remove(obj.root);
   const idx=this.builds.indexOf(obj);
   if(idx>=0)this.builds.splice(idx,1);
  }
 }
 setStorm(radius){
  this.stormRadius=radius;
  const attr=this.stormLine.geometry.attributes.position;
  for(let i=0;i<attr.count;i++){
   const angle=(i/attr.count)*Math.PI*2,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
   attr.setXYZ(i,x,groundHeight(x,z)+.37,z);
  }
  attr.needsUpdate=true;this.stormLine.geometry.computeBoundingSphere();
 }
 update(dt,time){
  this.time+=dt;
  for(const item of this.loot){
   if(!item.alive)continue;
   item.group.rotation.y=this.time*.9+item.phase;
   item.group.position.y=item.baseY+Math.sin(this.time*2+item.phase)*.14;
  }
  for(const c of this.decor)c.m.position.x=c.originX+Math.sin(this.time*c.speed)*9;
 }
 raycast(origin,direction,distance=100){
  const caster=new THREE.Raycaster(origin,direction,0,distance);
  return caster.intersectObjects([...this.blockers,...this.builds.map(x=>x.root)],true)[0]||null;
 }
}
