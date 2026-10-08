import * as THREE from 'three';
import {groundHeight} from './world.js';

// Four hand-authored procedural locations. No copyrighted map geometry or assets.
export function upgradeIsland(world){
 if(world.skyforgeExtended)return;
 world.skyforgeExtended=true;
 const w=world, m=(c,metalness=0,emissive=null)=>new THREE.MeshStandardMaterial({color:c,roughness:.73,metalness,flatShading:true,...(emissive?{emissive,emissiveIntensity:.55}:{})});
 const asphalt=m('#374e58'),stone=m('#a3a49b'),light=m('#ffe2a1',.1,'#b87524');
 const teal=m('#66e4dd',.4,'#158e91'),rust=m('#b7684b'),blue=m('#3e7994'),coal=m('#263c48'),wood=m('#a97b52'),sand=m('#cead76');
 const base=(x,z)=>groundHeight(x,z), box=(a,b,c,mat,x,y,z)=>w.box(a,b,c,mat,x,y,z,false);
 const pillar=(x,z,height=4,mat=stone,width=.9)=>{
  const y=base(x,z);w.cyl(width*.48,width*.58,height,mat,x,y+height*.5,z,8);
  w.colliders.push({x,z,w:width,d:width,type:'pillar'});
 };
 w.landmarks=[
  {name:'НЕБЕСНЫЙ АЭРОДРОМ',x:58,z:-62,color:'#ffd68e'},
  {name:'ДРЕВНИЙ БАСТИОН',x:-62,z:-57,color:'#e9c9ff'},
  {name:'ПОРТ СЕВЕРНОЙ БУХТЫ',x:78,z:66,color:'#74f8e3'},
  {name:'РАДАРНАЯ СТАНЦИЯ',x:-75,z:60,color:'#ccff94'}
 ];
 // Abandoned runway, aircraft wreck, control tower, runway lights.
 for(let j=-7;j<=7;j++){
  const x=58+j*2.8,z=-61,y=base(x,z);
  box(2.75,.09,10.5,asphalt,x,y+.04,z);
  if(j%2===0)box(.65,.05,.32,light,x,y+.1,z);
  for(const side of [-1,1])if(j%2===0)
   w.cyl(.16,.18,.7,teal,x,y+.35,z+side*5.2,6);
 }
 const tx=76,tz=-75,ty=base(tx,tz);
 box(3.3,7,3.3,stone,tx,ty+3.5,tz);
 box(5,2.2,5,blue,tx,ty+8.1,tz);box(5.9,.25,5.9,coal,tx,ty+9.25,tz);
 w.colliders.push({x:tx,z:tz,w:3.5,d:3.5,type:'tower'});
 const plane=w.cyl(.9,1.4,10,blue,48,base(48,-70)+1.5,-70,10);
 plane.rotation.z=1.38;plane.rotation.x=.2;
 const wing=box(8,.19,2.2,stone,48,base(48,-70)+1.7,-70);wing.rotation.y=.4;
 for(const [x,z] of [[63,-76],[67,-76],[63,-72]]){
  const y=base(x,z);box(2,1.8,2,wood,x,y+.9,z);
  w.colliders.push({x,z,w:2,d:2,type:'crate'});
 }
 // Ruined circular fort with cover, crystal and twelve stone arches.
 const cx=-62,cz=-57,cy=base(cx,cz);
 w.cyl(13,13,.3,stone,cx,cy-.05,cz,16);
 for(let k=0;k<12;k++){
  const a=k*Math.PI/6,x=cx+Math.cos(a)*12,z=cz+Math.sin(a)*12;
  pillar(x,z,k%3===0?5.8:4.3,stone,1.0);
  if(k%3===0)box(1.5,.25,1.5,sand,x,base(x,z)+5.9,z);
 }
 box(6,.6,2.5,rust,cx,cy+.5,cz);
 for(const x of [cx-2.6,cx+2.6])pillar(x,cz,3.5,stone,.7);
 box(6,.3,.5,light,cx,cy+3.6,cz);
 const crystal=w.geo(new THREE.OctahedronGeometry(1.35),teal,cx,cy+5.4,cz);
 // Container harbor and a glowing coastal beacon.
 for(const z of [62,66,70,74])box(22,.28,2.9,wood,78,base(78,z)+.14,z);
 for(const [x,z,mat] of [[67,63,blue],[67,72,rust],[87,62,coal],[87,73,sand]]){
  const h=base(x,z);box(4.9,2.8,3,mat,x,h+1.4,z);
  w.colliders.push({x,z,w:5.3,d:3.5,type:'container'});
  for(let j=-2;j<=2;j++)box(.065,2.6,.06,stone,x+j*.9,h+1.4,z+1.52);
 }
 pillar(92,77,11,stone,1.25);
 w.cyl(1.6,1.6,.45,teal,92,base(92,77)+11.2,77,12);
 // Communications outpost with dish, cover and generator shelters.
 const rx=-75,rz=60,ry=base(rx,rz);
 box(12,.45,10,stone,rx,ry+.22,rz);
 box(2.1,7.5,2.1,coal,rx,ry+3.8,rz);
 w.colliders.push({x:rx,z:rz,w:2.1,d:2.1,type:'antenna'});
 const dish=w.geo(new THREE.SphereGeometry(4,16,10,0,Math.PI*2,0,Math.PI*.46),stone,rx,ry+8,rz);
 dish.rotation.x=.5;
 w.cyl(.65,.65,2,teal,rx,ry+9.5,rz,8);
 for(const [x,z] of [[-88,52],[-87,67],[-61,66]]){
  const h=base(x,z);box(3.6,2.3,2,coal,x,h+1.15,z);
  box(4,.25,2.5,light,x,h+2.45,z);
  w.colliders.push({x,z,w:3.6,d:2,type:'generator'});
 }
 for(const point of w.landmarks){
  for(const [dx,dz,kind] of [[6,8,'shield'],[-6,-7,'ammo'],[1,10,'heal']]){
   const x=point.x+dx,z=point.z+dz;
   if(Math.hypot(x,z)<104)w.spawnLoot(x,z,kind,true);
  }
 }
 // Small rotating landmark props are separate from the original cloud system.
 const oldUpdate=w.update.bind(w);
 w.update=(dt,time)=>{
  oldUpdate(dt,time);
  crystal.rotation.y+=dt*.6;crystal.position.y=cy+5.4+Math.sin(time*1.6)*.18;
  dish.rotation.y=Math.sin(time*.23)*.16;
 };
 return w.landmarks;
}
