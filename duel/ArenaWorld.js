import * as THREE from 'three';

// Entirely original arena geometry for a 1v1 build-and-shoot game.
// Uses the permissive MIT-licensed Voxel Royale movement/build engine.
const MAT={
 floor:new THREE.MeshStandardMaterial({color:'#899b9d',roughness:.94,metalness:.06}),
 floorDark:new THREE.MeshStandardMaterial({color:'#2f4149',roughness:.85,metalness:.11}),
 base:new THREE.MeshStandardMaterial({color:'#3c525f',roughness:.7,metalness:.28}),
 steel:new THREE.MeshStandardMaterial({color:'#45677c',roughness:.44,metalness:.62}),
 plate:new THREE.MeshStandardMaterial({color:'#829caa',roughness:.5,metalness:.43}),
 wall:new THREE.MeshStandardMaterial({color:'#263744',roughness:.8}),
 glass:new THREE.MeshStandardMaterial({color:'#75dbee',roughness:.16,metalness:.22,transparent:true,opacity:.67}),
 yellow:new THREE.MeshStandardMaterial({color:'#ffd174',emissive:'#a06817',emissiveIntensity:.27,roughness:.6}),
 cyan:new THREE.MeshStandardMaterial({color:'#75fce5',emissive:'#158d96',emissiveIntensity:.82,roughness:.38}),
 orange:new THREE.MeshStandardMaterial({color:'#ed8668',emissive:'#833920',emissiveIntensity:.52,roughness:.5}),
 crate:new THREE.MeshStandardMaterial({color:'#c69b63',roughness:.78}),
 foliage:new THREE.MeshStandardMaterial({color:'#3a9188',roughness:1})
};
export class ArenaWorld{
 constructor(scene){
  this.scene=scene;this.collidableMeshes=[];this.buildingBlocks=[];this.chests=new Map();
  this.stormRadius=55;this.stormCenterX=0;this.stormCenterZ=0;
  this.phase=0;this.parts=[];this.decor=[];
  this.group=new THREE.Group();scene.add(this.group);
  scene.background=new THREE.Color('#a2d4dc');scene.fog=new THREE.FogExp2('#a2d4dc',.006);
  this.buildArena();
 }
 mesh(geometry,material,pos,collider=false){
  const m=new THREE.Mesh(geometry,material);
  m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;
  this.group.add(m);this.parts.push(m);
  if(collider){m.name='arena_cover';this.collidableMeshes.push(m);}
  return m;
 }
 box(w,h,d,mat,x,y,z,collider=false){return this.mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],collider)}
 cylinder(rt,rb,h,mat,x,y,z,n=12,collider=false){return this.mesh(new THREE.CylinderGeometry(rt,rb,h,n),mat,[x,y,z],collider)}
 makeTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle='#667c81';ctx.fillRect(0,0,256,256);
  for(let x=0;x<256;x+=64)for(let y=0;y<256;y+=64){
   ctx.fillStyle=(x+y)%128===0?'#687d83':'#62767c';ctx.fillRect(x+2,y+2,60,60);
   ctx.strokeStyle='#90a5a642';ctx.lineWidth=1.5;ctx.strokeRect(x+5,y+5,54,54);
   for(let j=0;j<8;j++){
    const rx=x+7+(j*13)%49,ry=y+7+(j*19)%48;
    ctx.fillStyle='#ffffff12';ctx.fillRect(rx,ry,2,2);
   }
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(15,15);
  t.anisotropy=4;t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 buildArena(){
  const base=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({map:this.makeTexture(),roughness:.93,metalness:.04}));
  base.rotation.x=-Math.PI/2;base.position.y=-.12;base.receiveShadow=true;base.name='ground';this.group.add(base);this.collidableMeshes.push(base);
  this.box(140,3,140,MAT.wall,0,-1.8,0);
  // Arena boundary and accent strips.
  for(const sign of [-1,1]){
   this.box(145,12,1.8,MAT.wall,0,5.5,sign*73,true);
   this.box(1.8,12,145,MAT.wall,sign*73,5.5,0,true);
   this.box(145,.16,.24,MAT.cyan,0,10.7,sign*71.97);
   this.box(.24,.16,145,MAT.cyan,sign*71.97,10.7,0);
   for(const p of [-60,-40,-20,0,20,40,60]){
    this.box(.4,11,.4,MAT.steel,p,5.3,sign*72.2);
    this.box(.4,11,.4,MAT.steel,sign*72.2,5.3,p);
   }
  }
  // Two symmetrical spawn stations, away from the firefight core.
  for(const sign of [-1,1]){
   const z=sign*27;
   this.box(12,.55,10,MAT.base,0,.25,z);
   this.box(11.3,.06,9.4,sign>0?MAT.cyan:MAT.orange,0,.58,z);
   this.box(7,4,.8,MAT.steel,0,1.85,z+sign*4.85,true);
   this.box(8,.22,1.1,MAT.yellow,0,4,z+sign*4.9);
   const spawnLight=new THREE.PointLight(sign>0?'#57eee0':'#ffad75',1.45,21,2);
   spawnLight.position.set(0,6,z);this.group.add(spawnLight);
   // Thin barriers to create tactical peek angles.
   this.box(1.2,3,7,MAT.plate,sign*12,1.4,z+sign*5,true);
   this.box(6.2,3,.9,MAT.base,-sign*13,1.45,z-sign*2,true);
  }
  // Center platform, bridges, angles and low cover.
  this.cylinder(11,12,.7,MAT.base,0,.2,0,12);
  this.cylinder(9.6,10,.15,MAT.plate,0,.6,0,12);
  this.cylinder(5.6,5.9,.15,MAT.floorDark,0,.73,0,12);
  this.cylinder(3,3,.24,MAT.cyan,0,.88,0,12);
  for(const [x,z,rot] of [[-20,-11,0],[20,-11,0],[-20,11,0],[20,11,0]]){
   const m=this.box(7,2.2,2.2,MAT.base,x,1.1,z,true);m.rotation.y=rot;
   this.box(7.3,.1,2.35,MAT.yellow,x,2.23,z);
  }
  // Symmetric combat boxes and accessible hiding points.
  for(const x of [-34,34]){
   for(const z of [-26,26]){
    this.box(8,3,4.2,MAT.steel,x,1.48,z,true);
    this.box(8.3,.15,4.5,MAT.plate,x,3.04,z);
    for(let i=-2;i<=2;i++)this.box(.065,2.5,.1,MAT.yellow,x+i*1.55,1.48,z+2.15);
   }
  }
  for(const x of [-45,45]){
   this.box(10,8,.8,MAT.wall,x,3.95,0,true);
   this.box(11,.45,1.35,MAT.steel,x,8.12,0);
   for(const z of [-8,8])this.box(1.6,3.3,1.6,MAT.crate,x,1.6,z,true);
  }
  // Skyline: distant cranes, lit towers, angled sci-fi structures.
  for(let i=0;i<14;i++){
   const angle=i/14*Math.PI*2;
   const rr=58+(i%3)*3, x=Math.cos(angle)*rr,z=Math.sin(angle)*rr;
   const height=10+(i*7)%19;
   this.box(4.5,height,4.5,i%2?MAT.base:MAT.wall,x,height/2-.03,z);
   this.box(4.9,.3,4.9,MAT.plate,x,height,z);
   this.box(1,.23,4.2,i%3?MAT.cyan:MAT.yellow,x,height*.68,z+2.37);
   // Do not add city skyline to collision set — it is behind the duel area.
  }
  for(const x of [-52,52])for(const z of [-39,39]){
   const y=8;
   this.cylinder(.27,.33,16,MAT.steel,x,y,z);
   this.cylinder(1.15,1.15,.5,MAT.cyan,x,16.2,z);
   const glow=new THREE.PointLight('#72eaff',.65,26,2);glow.position.set(x,16.2,z);this.group.add(glow);
  }
  // Scenic ramps are non-collidable decoration; player builds actual ramps.
  for(const x of [-51,51]){
   const m=this.box(10,.3,1.7,MAT.steel,x,.3,-24);
   m.rotation.y=Math.PI/4;
  }
  this.stormRing=this.mesh(new THREE.RingGeometry(54.7,55.2,96),new THREE.MeshBasicMaterial({color:'#e971fb',transparent:true,opacity:.64,side:THREE.DoubleSide}),[0,.07,0]);
  this.stormRing.rotation.x=-Math.PI/2;
 }
 // Ramp surfaces are walkable rather than solid collision boxes.
 // Return a reachable support elevation for the character's feet.
 getWalkableHeight(x,z,feetY){
  let best=null;
  for(const mesh of this.buildingBlocks){
   const type=mesh.userData.buildType;
   if(type!=='ramp'&&type!=='floor')continue;
   mesh.updateMatrixWorld();
   const inv=mesh.matrixWorld.clone().invert();
   const local=new THREE.Vector3(x,mesh.position.y,z).applyMatrix4(inv);
   if(Math.abs(local.x)>2.07||Math.abs(local.z)>2.07)continue;
   const support=mesh.position.y+(type==='ramp'?-local.z:0.15);
   if(support>feetY+.9||support<feetY-.9)continue;
   if(best===null||support>best)best=support;
  }
  return best;
 }
 getCollidableMeshes(){return this.collidableMeshes}
 registerBuildingBlock(m){this.collidableMeshes.push(m);this.buildingBlocks.push(m)}
 unregisterBuildingBlock(m){this.collidableMeshes=this.collidableMeshes.filter(x=>x!==m);this.buildingBlocks=this.buildingBlocks.filter(x=>x!==m)}
 addBlock(x,y,z,color){return this.box(2,2,2,new THREE.MeshStandardMaterial({color}),x,y,z,true)}
 spawnChest(data){if(data?.id)this.chests.set(data.id,data)}
 removeChest(id){this.chests.delete(id)}
 getChests(){return this.chests}
 updateStorm(data){
  this.stormRadius=data.radius;this.stormCenterX=data.centerX;this.stormCenterZ=data.centerZ;
  const radius=Math.max(5,Number(data.radius)||55);
  this.stormRing.geometry.dispose();
  this.stormRing.geometry=new THREE.RingGeometry(radius-.4,radius+.3,96);
 }
 createHitEffect(scene,pos){
  const m=this.mesh(new THREE.SphereGeometry(.17,8,8),MAT.yellow,[pos.x,pos.y,pos.z]);
  setTimeout(()=>{this.group.remove(m);m.geometry.dispose()},150);
 }
 createShotTrail(scene,origin,direction){
  const end=new THREE.Vector3(origin.x,origin.y,origin.z).add(new THREE.Vector3(direction.x,direction.y,direction.z).multiplyScalar(20));
  const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(origin.x,origin.y,origin.z),end]);
  const m=new THREE.Line(g,new THREE.LineBasicMaterial({color:'#ffce76',transparent:true,opacity:.75}));
  this.group.add(m);setTimeout(()=>{this.group.remove(m);g.dispose();m.material.dispose()},130);
 }
 update(elapsed){this.phase=elapsed}
}
