import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const loader=new GLTFLoader();
let templatesPromise=null;
const baseMat=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:metalness?.42:.92,metalness,flatShading:true});
const mat={
 light:baseMat('#e3fff1'),black:baseMat('#1c3a40'),dark:baseMat('#20343e'),
 metal:baseMat('#61777c',.65),skin:baseMat('#e3ae85'),visor:baseMat('#62d9e4',.42),
 straps:baseMat('#293d3e'),gold:baseMat('#f3c67e',.22)
};
const teamMat={
 ct:{coat:baseMat('#2f9d8a'),pants:baseMat('#3e646d'),accent:baseMat('#bdf4bc')},
 t:{coat:baseMat('#c56b53'),pants:baseMat('#74605c'),accent:baseMat('#f4b981')}
};
const assetInfo={ct:['./assets/soldier_ct.glb',2.2699],t:['./assets/soldier_t.glb',2.1358]};
export async function loadActors(){
 if(templatesPromise)return templatesPromise;
 templatesPromise=Promise.all(['ct','t'].map(async team=>{
  try{
   const gltf=await loader.loadAsync(assetInfo[team][0]);
   return [team,{scene:gltf.scene,clips:gltf.animations,height:assetInfo[team][1]}];
  }catch(error){console.warn('Animated actor unavailable, using fallback:',team,error);return [team,null]}
 })).then(x=>Object.fromEntries(x));
 return templatesPromise;
}
const geo=(g,m,x,y,z)=>{
 const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
};
export class GameActor{
 constructor(scene,team='ct',player=false){
  this.scene=scene;this.team=team;this.player=player;
  this.group=new THREE.Group();this.group.name=player?'Skyforge Player':'Skyforge Bot';
  scene.add(this.group);
  this.visual=new THREE.Group();this.group.add(this.visual);
  this.hp=100;this.alive=true;this.speed=0;this.aim=0;this.firing=0;this.mixer=null;this.actions={};this.activeAction='';
  this.weaponId='rifle';this.state='idle';this.pose={x:0,y:0,z:0,yaw:0,pitch:0,speed:0,crouch:false};
  this._buildFallback();
  this._ensureModel();
 }
 _buildFallback(){
  const t=teamMat[this.team];
  const b=new THREE.Group();this.fallback=b;this.visual.add(b);
  const mesh=(g,m,x,y,z)=>{const child=geo(g,m,x,y,z);b.add(child);return child;};
  // Character silhouette: sculpted pads, sleeves, utility harness, gloves,
  // boots, segmented chest-plate and backpack; visible from behind.
  mesh(new THREE.BoxGeometry(.54,.74,.32),t.coat,0,1.2,0);
  mesh(new THREE.BoxGeometry(.59,.25,.43),t.accent,0,1.46,.025);
  mesh(new THREE.BoxGeometry(.32,.45,.19),mat.black,0,1.19,-.22);
  mesh(new THREE.BoxGeometry(.11,.43,.21),mat.gold,-.19,1.17,-.23);
  mesh(new THREE.BoxGeometry(.11,.43,.21),mat.gold,.19,1.17,-.23);
  mesh(new THREE.BoxGeometry(.41,.41,.26),mat.dark,0,1.26,.25);
  mesh(new THREE.BoxGeometry(.49,.1,.39),mat.straps,0,.86,0);
  // Armor backpack with a neon core and straps
  mesh(new THREE.BoxGeometry(.43,.6,.2),mat.dark,0,1.23,.26);
  mesh(new THREE.BoxGeometry(.20,.37,.06),t.accent,0,1.2,.38);
  const head=mesh(new THREE.SphereGeometry(.22,10,8),mat.skin,0,1.84,0);
  mesh(new THREE.SphereGeometry(.248,10,8),mat.black,0,1.96,.01);
  mesh(new THREE.BoxGeometry(.47,.11,.2),t.accent,0,1.92,-.16);
  mesh(new THREE.BoxGeometry(.37,.105,.07),mat.visor,0,1.83,-.195);
  for(const sign of [-1,1])mesh(new THREE.BoxGeometry(.07,.1,.11),t.accent,sign*.22,1.88,0);
  this.legs=[];
  for(const side of [-1,1]){
   const leg=new THREE.Group();leg.position.set(side*.16,.83,0);b.add(leg);
   leg.add(geo(new THREE.BoxGeometry(.23,.47,.25),t.pants,0,-.24,0));
   leg.add(geo(new THREE.BoxGeometry(.235,.16,.26),mat.dark,0,-.52,-.02));
   leg.add(geo(new THREE.BoxGeometry(.255,.19,.37),mat.black,0,-.70,-.075));
   leg.add(geo(new THREE.BoxGeometry(.18,.16,.31),t.accent,0,-.46,0));
   this.legs.push(leg);
  }
  this.arms=[];
  for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.36,1.49,0);b.add(arm);
   arm.add(geo(new THREE.BoxGeometry(.24,.3,.27),t.accent,0,-.13,0));
   arm.add(geo(new THREE.BoxGeometry(.175,.41,.2),t.coat,0,-.37,-.04));
   arm.add(geo(new THREE.BoxGeometry(.18,.14,.19),mat.black,0,-.61,-.09));
   this.arms.push(arm);
  }
  this._makeWeapon(b);
 }
 _makeWeapon(root){
  const weapon=new THREE.Group();root.add(weapon);
  weapon.position.set(.23,1.19,-.32);
  const metal=mat.dark;
  weapon.add(geo(new THREE.BoxGeometry(.17,.18,.79),metal,0,-.01,-.21));
  weapon.add(geo(new THREE.BoxGeometry(.115,.11,.55),mat.metal,0,.025,-.71));
  weapon.add(geo(new THREE.CylinderGeometry(.048,.048,.35,8),mat.black,0,.025,-1.08));
  weapon.children[2].rotation.x=Math.PI/2;
  weapon.add(geo(new THREE.BoxGeometry(.18,.22,.28),mat.black,0,-.19,-.07));
  weapon.add(geo(new THREE.BoxGeometry(.10,.1,.27),mat.gold,0,.15,-.35));
  weapon.add(geo(new THREE.BoxGeometry(.28,.1,.28),mat.dark,0,-.04,.3));
  this.weapon=weapon;
 }
 async _ensureModel(){
  const templates=await loadActors();
  if(!this.group.parent)return;
  const info=templates[this.team];
  if(!info)return;
  try{
   const model=cloneSkeleton(info.scene);
   model.scale.setScalar(1.86/info.height);
   model.rotation.y=Math.PI;
   model.traverse(o=>{
    if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}
    // Hold a single authored weapon. Unused prefabs on index fingers remain
    // hidden, so the model has a clear silhouette.
    if(['SMG','Sniper','Pistol'].includes(o.name))o.visible=false;
   });
   this.rig=model;
   this.visual.add(model);
   this.fallback.visible=false;
   this.mixer=new THREE.AnimationMixer(model);
   const animations=info.clips||[];
   for(const clip of animations){
    const name=clip.name.split('|').pop().toLowerCase();
    this.actions[name]=this.mixer.clipAction(clip);
   }
   this.setAction('Idle',true);
  }catch(error){console.warn('Could not attach animated actor',error);}
 }
 setAction(name,instant=false){
  if(!this.mixer)return;
  const names=[name,'Idle'].map(x=>x.toLowerCase());
  const key=names.find(n=>this.actions[n]);
  if(!key||this.activeAction===key)return;
  const action=this.actions[key];action.reset().fadeIn(instant?0:.16).play();
  if(this.activeAction)this.actions[this.activeAction]?.fadeOut(instant?0:.16);
  this.activeAction=key;
 }
 setPose(pose,dt){
  this.pose={...this.pose,...pose};
  const p=this.pose;
  this.group.position.set(p.x,p.y,p.z);
  this.group.rotation.y=p.yaw||0;
  this.speed=p.speed||0;this.aim=p.pitch||0;this.firing=Math.max(0,this.firing-dt*4);
  if(this.mixer){
   const sprint=this.speed>5.3,walking=this.speed>.3;
   this.setAction(p.crouch?'Duck':sprint?(this.firing>0?'Run_Shoot':'Run_Gun'):walking?(this.firing>0?'Walk_Shoot':'Walk'):(this.firing>0?'Idle_Shoot':'Idle'));
   this.mixer.update(dt);
  }else{
   const motion=Math.min(1,this.speed/6);
   const cyc=Math.sin(performance.now()*.012)*motion;
   if(this.legs){this.legs[0].rotation.x=cyc*.6;this.legs[1].rotation.x=-cyc*.6;}
   if(this.arms){this.arms[0].rotation.x=-.45-cyc*.22;this.arms[1].rotation.x=-.40+cyc*.22;}
   this.fallback.position.y=motion*Math.abs(Math.sin(performance.now()*.012))*.07;
   this.fallback.scale.y=p.crouch?.81:1;
  }
 }
 shoot(){this.firing=1;}
 kill(){
  this.alive=false;
  if(this.mixer&&this.actions.death){
   this.setAction('Death',true);
   this.actions.death.setLoop(THREE.LoopOnce,1);this.actions.death.clampWhenFinished=true;
  }else this.visual.rotation.z=1.4;
 }
 dispose(){this.group.removeFromParent();this.mixer?.stopAllAction();}
}
