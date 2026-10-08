import * as THREE from 'three';
import { IslandWorld,groundHeight } from './world.js';
import { GameActor,loadActors } from './actor.js';

const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ui=['kills','remaining','stormTime','hpFill','shFill','hpText','shText','woodText','stoneText','metalText','ammoText','actionText','weaponLabel','mode','toast','quick','crosshair','minimap'].reduce((o,k)=>(o[k]=$(k),o),{});
const stats={rifle:{name:'RANGER AR',mag:30,damage:31,fireRate:.104,spread:.020,reserve:180},shotgun:{name:'BREAKER SG',mag:6,damage:16,fireRate:.85,spread:.095,reserve:42}};
const camera=new THREE.PerspectiveCamera(73,innerWidth/innerHeight,.08,350);
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({antialias:!matchMedia('(pointer:coarse)').matches,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.1:1.45));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.domElement.className='game';
$('app').appendChild(renderer.domElement);
const world=new IslandWorld(scene);
const playerActor=new GameActor(scene,'ct',true);
const clock=new THREE.Clock();
const keys=new Set();
const ctrls={mouseX:0,mouseY:0,fire:false,alt:false,stickX:0,stickY:0,jump:false};
const state={
 running:false,paused:false,ended:false,
 x:-6,y:groundHeight(-6,8),z:8,vertical:0,grounded:true,
 yaw:.15,pitch:.04,hp:100,shield:50,
 maxHP:100,kills:0,remaining:8,
 wood:150,stone:80,metal:40,medkit:2,
 ammo:{rifle:30,shotgun:6},reserve:{rifle:180,shotgun:42},slot:1,
 buildMode:false,piece:1,buildRotation:0,buildLevel:0,material:'wood',buildCount:0,
 elapsed:0,stormRadius:92,stormTick:0,
 reload:0,lastShot:-10,fireCooldown:0,
 jumpVel:0,animTime:0,stepSpeed:0,
 toastUntil:0,highScore:Number(localStorage.getItem('skyforge-best')||0)
};
const bots=[];
const events=[];
const camSmooth=new THREE.Vector3(-6,4,12);
const tmpV=new THREE.Vector3(),tmpB=new THREE.Vector3(),tmpC=new THREE.Vector3();
const shotOrigin=new THREE.Vector3(),shotDirection=new THREE.Vector3();
const aimPoint=new THREE.Vector3();
const proj=new THREE.Vector3();
const dir=new THREE.Vector3();
const blue=new THREE.Color('#78e3ee');
const orange=new THREE.Color('#fbb870');
const mini=ui.minimap.getContext('2d');
const buildGhost=new THREE.Group();scene.add(buildGhost);
const isTouch=matchMedia('(pointer:coarse)').matches;

const safeToast=(text,duration=2)=>{
 ui.toast.textContent=text;ui.toast.classList.add('show');
 state.toastUntil=state.elapsed+duration;
};
function createTrace(a,b,color='#f6d795',size=.045,duration=.13){
 const len=a.distanceTo(b);
 if(!len||len>160)return;
 const m=new THREE.Mesh(new THREE.CylinderGeometry(size,size,len,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false}));
 m.position.copy(a).add(b).multiplyScalar(.5);
 m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tmpV.subVectors(b,a).normalize());
 scene.add(m);events.push({mesh:m,time:duration,max:duration});
}
function burst(pos,color='#ffb681',count=9){
 const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false});
 for(let i=0;i<count;i++){
  const m=new THREE.Mesh(new THREE.BoxGeometry(.065,.065,.065),mat.clone());
  m.position.copy(pos);scene.add(m);
  events.push({mesh:m,time:rand(.22,.48),max:.48,vel:new THREE.Vector3(rand(-2.5,2.5),rand(.2,2.8),rand(-2.5,2.5))});
 }
}
function spawnBots(){
 for(const bot of bots)bot.actor.dispose();
 bots.length=0;
 for(let i=0;i<8;i++){
  let x,z;
  for(let tries=0;tries<70;tries++){
   const a=rand(0,Math.PI*2),d=rand(31,76);
   x=clamp(state.x+Math.cos(a)*d,-88,88);
   z=clamp(state.z+Math.sin(a)*d,-88,88);
   if(!world.isBlocked(x,z,1))break;
  }
  const actor=new GameActor(scene,'t',false),hp=i<2?85:100;
  const bot={x,y:groundHeight(x,z),z,hp,maxHp:hp,actor,yaw:rand(0,Math.PI*2),pitch:0,
   cooldown:rand(.5,2),strafe:Math.random()<.5?-1:1,mood:rand(-10,10),speed:0,alive:true,goal:rand(0,6),wander:rand(0,8)};
  actor.setPose({x,y:bot.y,z,yaw:bot.yaw},.016);bots.push(bot);
 }
 state.remaining=bots.length;
}
spawnBots();
function playerEye(){return new THREE.Vector3(state.x,state.y+1.52,state.z)}
function forward(out=new THREE.Vector3()){
 const c=Math.cos(state.pitch);
 return out.set(-Math.sin(state.yaw)*c,Math.sin(state.pitch),-Math.cos(state.yaw)*c).normalize();
}
function flatForward(){return new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));}
function right(){return new THREE.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw));}
function selectWeapon(slot){
 if(state.buildMode){state.piece=clamp(slot,1,4);setGhost();safeToast(['','СТЕНА','ПОЛ','ЛЕСТНИЦА','КРЫША'][state.piece],.8);}
 else {state.slot=clamp(slot,1,4);if(slot===4)tryMedkit();}
 updateQuick();
}
function tryMedkit(){
 if(state.hp>=100){safeToast('ЗДОРОВЬЕ УЖЕ ПОЛНОЕ');return}
 if(state.medkit<=0){safeToast('НЕТ АПТЕЧЕК');return}
 state.medkit--;state.hp=Math.min(100,state.hp+65);
 safeToast('+65 ЗДОРОВЬЯ');
 state.slot=1;
}
function toggleBuild(force){
 state.buildMode=typeof force==='boolean'?force:!state.buildMode;
 state.buildRotation=Math.round(state.yaw/(Math.PI/2))*(Math.PI/2);
 state.fireCooldown=.15;
 setGhost();updateQuick();
 safeToast(state.buildMode?'🏗 РЕЖИМ СТРОИТЕЛЬСТВА: 1–4 / E ПОВОРОТ':'⚔ РЕЖИМ БОЯ',1.25);
}
function setGhost(){
 while(buildGhost.children.length)buildGhost.remove(buildGhost.children[0]);
 if(!state.buildMode)return;
 const type=['','wall','floor','ramp','roof'][state.piece]||'wall';
 const visual=world.buildPart(type,0,0,0,state.material,true,0);
  // Fix offset bug: preview parent already applies world ground height.
  visual.position.set(0,0,0);
  buildGhost.add(visual);
}
function ghostSpot(){
 const f=flatForward(),d=5.1;
 const x=Math.round((state.x+f.x*d)/4)*4;
 const z=Math.round((state.z+f.z*d)/4)*4;
 return {x,z,angle:state.buildRotation};
}
function build(){
 const kind=['','wall','floor','ramp','roof'][state.piece];
 const spot=ghostSpot();
 const cost=kind==='roof'?15:10;
 if(state[state.material]<cost){safeToast('НЕ ХВАТАЕТ МАТЕРИАЛОВ: ДОБУДЬ РЕСУРСЫ');return}
 if(Math.hypot(spot.x,spot.z)>102){safeToast('СЛИШКОМ ДАЛЕКО ОТ ОСТРОВА');return}
 if(world.colliders.some(c=>Math.hypot(spot.x-c.x,spot.z-c.z)<3.6&&c.type==='house')){safeToast('ЗДЕСЬ СТРОИТЬ НЕЛЬЗЯ');return}
 if(world.builds.some(b=>b.type===kind&&b.level===state.buildLevel&&Math.abs(b.x-spot.x)<1&&Math.abs(b.z-spot.z)<1&&Math.abs(b.angle-spot.angle)<.2)){safeToast('ПОСТРОЙКА УЖЕ ЕСТЬ');return}
 state[state.material]-=cost;
 world.addBuild(kind,spot.x,spot.z,spot.angle,state.material,state.buildLevel);
 state.buildCount++;
 safeToast('✓ '+({wall:'СТЕНА',floor:'ПОЛ',ramp:'ЛЕСТНИЦА',roof:'КРЫША'}[kind])+' ПОСТРОЕНА  -'+cost,.7);
 state.fireCooldown=.15;
}
function harvest(){
 let node=null,best=4.2;
 for(const n of world.harvestables){
  const dist=Math.hypot(n.x-state.x,n.z-state.z);
  if(n.alive&&dist<best){node=n;best=dist;}
 }
 if(node){
  world.harvest(node);
  const gain=node.kind==='wood'?24:node.kind==='stone'?18:13;
  state[node.kind]+=gain;
  burst(new THREE.Vector3(node.x,node.nodeY,node.z),node.kind==='wood'?'#ffc177':node.kind==='metal'?'#a3fded':'#dde4df',8);
  safeToast('+'+gain+' '+({wood:'ДЕРЕВО',stone:'КАМЕНЬ',metal:'МЕТАЛЛ'}[node.kind]),1.0);
  return true;
 }
 const nearest=bots.find(b=>b.alive&&Math.hypot(b.x-state.x,b.z-state.z)<3.6);
 if(nearest){
  hitBot(nearest,27,new THREE.Vector3(nearest.x,nearest.y+1.1,nearest.z));return true;
 }
 safeToast('ПОДОЙДИ К ДЕРЕВУ ИЛИ КАМНЮ');return false;
}
function reload(){
 if(state.buildMode||state.slot===3||state.slot===4)return;
 const key=state.slot===2?'shotgun':'rifle',info=stats[key];
 if(state.reload>0||state.ammo[key]===info.mag||state.reserve[key]<=0)return;
 state.reload=key==='rifle'?1.65:2.0;
 safeToast('↻ ПЕРЕЗАРЯДКА...',.6);
}
function finishReload(){
 const key=state.slot===2?'shotgun':'rifle';
 const info=stats[key];
 const want=info.mag-state.ammo[key],add=Math.min(want,state.reserve[key]);
 state.reserve[key]-=add;state.ammo[key]+=add;
}
function raySphere(origin,direction,center,radius){
 const oc=tmpB.subVectors(center,origin),projection=oc.dot(direction);
 if(projection<0)return null;
 const d=oc.lengthSq()-projection*projection;
 if(d>radius*radius)return null;
 return projection-Math.sqrt(Math.max(0,radius*radius-d));
}
function hitBot(bot,damage,pos){
 if(!bot.alive)return;
 bot.hp-=damage;
 ui.crosshair.classList.add('hit');
 setTimeout(()=>ui.crosshair.classList.remove('hit'),85);
 burst(pos,'#ffb38d',6);
 if(bot.hp<=0){
  bot.alive=false;bot.actor.kill();state.kills++;state.remaining--;
  world.spawnLoot(bot.x,bot.z,Math.random()<.35?'shield':'ammo');
  state.wood+=15;state.stone+=8;
  safeToast('✦ ПРОТИВНИК УНИЧТОЖЕН · +15 ДЕРЕВА',1.6);
  if(state.kills>state.highScore){
   state.highScore=state.kills;try{localStorage.setItem('skyforge-best',String(state.highScore))}catch{}
  }
  if(state.remaining===0)endMatch(true);
 }
}
function dealPlayerDamage(amount){
 if(!state.running||state.paused||state.ended)return;
 let damage=amount;
 const shieldHit=Math.min(state.shield,damage);state.shield-=shieldHit;damage-=shieldHit;
 state.hp=clamp(state.hp-damage,0,100);
 if(damage>0)document.body.style.filter='saturate(.74)';
 if(state.hp<=0)endMatch(false);
}
function shoot(){
 if(state.fireCooldown>0||state.reload>0||state.ended)return;
 if(state.buildMode){build();return;}
 if(state.slot===4){tryMedkit();return;}
 if(state.slot===3){harvest();state.fireCooldown=.38;playerActor.shoot();return;}
 const key=state.slot===2?'shotgun':'rifle';
 const info=stats[key];
 if(state.ammo[key]<=0){reload();return}
 state.ammo[key]--;
 state.fireCooldown=info.fireRate;
 playerActor.shoot();
 const eye=playerEye();
 // Third-person screen aim: use the actual crosshair target, not only yaw.
 camera.getWorldDirection(shotDirection);
 const cameraObstruction=world.raycast(camera.position,shotDirection,125);
 let nearestScreenHit=cameraObstruction?.distance??125;
 for(const enemy of bots){
   if(!enemy.alive)continue;
   const d=raySphere(camera.position,shotDirection,new THREE.Vector3(enemy.x,enemy.y+1.05,enemy.z),.68);
   if(d!==null&&d>0&&d<nearestScreenHit)nearestScreenHit=d;
 }
 const aim=camera.position.clone().addScaledVector(shotDirection,nearestScreenHit);
 const base=aim.sub(eye).normalize();
 const pellets=key==='shotgun'?8:1;
 for(let pellet=0;pellet<pellets;pellet++){
  // Horizontal and vertical spread scale with weapon type.
  dir.copy(base).add(new THREE.Vector3(rand(-info.spread,info.spread),rand(-info.spread,info.spread),rand(-info.spread,info.spread))).normalize();
  const wallHit=world.raycast(eye,dir,125);
  let nearest=wallHit?.distance||125;
  let target=null;
  for(const bot of bots){
   if(!bot.alive)continue;
   const center=tmpC.set(bot.x,bot.y+1.05,bot.z);
   const length=raySphere(eye,dir,center,.68);
   if(length!==null&&length<nearest){nearest=length;target=bot;}
  }
  const at=new THREE.Vector3().copy(eye).addScaledVector(dir,nearest);
  if(target)hitBot(target,info.damage,at);
  else if(wallHit)burst(at,'#fbe8c3',2);
  if(pellet<2)createTrace(eye.clone().addScaledVector(right(),.17).add(new THREE.Vector3(0,-.12,0)),at,key==='shotgun'?'#ffedb6':'#ffdf75',.022,.12);
 }
 state.pitch=clamp(state.pitch+rand(.007,.013),-.95,1.13);
 if(state.ammo[key]===0)reload();
}
function enemyFire(bot,distance){
 const from=new THREE.Vector3(bot.x,bot.y+1.46,bot.z),to=playerEye();
 const straight=tmpV.subVectors(to,from),len=straight.length();
 straight.normalize();
 const ray=world.raycast(from,straight,len);
 if(ray&&ray.distance<len-.7){
  const build=world.builds.find(b=>b.root===ray.object||b.root.children.some(m=>m===ray.object||m.children.includes(ray.object)));
  if(build){world.damageBuild(build,17);createTrace(from,ray.point,'#ffa087',.025,.13);return}
  return;
 }
 bot.actor.shoot();
 const accuracy=clamp(.78-distance*.012,.18,.7);
 if(Math.random()<accuracy){
  createTrace(from,to,'#ff796b',.032,.19);
  dealPlayerDamage(rand(4,9));
 }else{
  const off=to.clone().add(new THREE.Vector3(rand(-3,3),rand(-1.2,1.5),rand(-3,3)));
  createTrace(from,off,'#ff796b',.027,.18);
 }
}
function updateBots(dt){
 for(const bot of bots){
  if(!bot.alive)continue;
  const dx=state.x-bot.x,dz=state.z-bot.z,d=Math.hypot(dx,dz);
  if(d>110)continue;
  const desired=Math.atan2(-dx,-dz);
  let diff=(desired-bot.yaw+Math.PI*3)%(Math.PI*2)-Math.PI;
  bot.yaw+=clamp(diff,-dt*2.5,dt*2.5);
  const seePlayer=d<46;
  const goForward=d>(seePlayer?12:5);
  bot.wander-=dt;
  if(bot.wander<=0){bot.strafe=Math.random()<.5?-1:1;bot.wander=rand(2,4);}
  let mx=0,mz=0;
  if(goForward){mx=dx/(d||1);mz=dz/(d||1);}
  else if(d<7){mx=-dx/(d||1);mz=-dz/(d||1);}
  if(d<34){mx+=(-dz/(d||1))*bot.strafe*.23;mz+=(dx/(d||1))*bot.strafe*.23;}
  const motion=Math.hypot(mx,mz),spd=seePlayer?rand(2.9,3.8):2.3;
  if(motion>.1){
   const nextX=bot.x+mx/motion*spd*dt,nextZ=bot.z+mz/motion*spd*dt;
   if(!world.isBlocked(nextX,bot.z,.4))bot.x=nextX;
   if(!world.isBlocked(bot.x,nextZ,.4))bot.z=nextZ;
   bot.speed=lerp(bot.speed,spd,dt*4);
  }else bot.speed=lerp(bot.speed,0,dt*6);
  bot.y=groundHeight(bot.x,bot.z);
  bot.actor.setPose({x:bot.x,y:bot.y,z:bot.z,yaw:bot.yaw,pitch:Math.atan2(1.52-(bot.y+1.5),d),speed:bot.speed},dt);
  bot.cooldown-=dt;
  if(d<34 && bot.cooldown<=0 && state.running&&!state.paused&&!state.ended){
   enemyFire(bot,d);bot.cooldown=rand(.9,1.65);
  }
 }
}
function updateMovement(dt){
 const sprint=keys.has('shift')||keys.has('shiftleft');
 const w=(keys.has('w')?1:0)-(keys.has('s')?1:0)+(-ctrls.stickY);
 const d=(keys.has('d')?1:0)-(keys.has('a')?1:0)+ctrls.stickX;
 const strength=Math.min(1,Math.hypot(w,d));
 const f=flatForward(),rr=right();
 const vx=strength?(f.x*w+rr.x*d)/Math.hypot(w,d):0;
 const vz=strength?(f.z*w+rr.z*d)/Math.hypot(w,d):0;
 const speed=sprint?9.0:5.9;
 world.resolveXZ(state,state.x+vx*speed*dt,state.z+vz*speed*dt,.51);
 state.stepSpeed=lerp(state.stepSpeed,strength*speed,Math.min(1,dt*7));
 if((keys.has(' ')||ctrls.jump)&&state.grounded){
  state.vertical=8;state.grounded=false;
 }
 if(!state.grounded){
  state.vertical-=21*dt;state.y+=state.vertical*dt;
  const h=world.walkableHeight(state.x,state.z,state.y);
  if(state.vertical<=0&&state.y<=h){state.y=h;state.vertical=0;state.grounded=true;}
 }else{
  const h=world.walkableHeight(state.x,state.z,state.y);
  if(h<state.y-.30){state.grounded=false;state.vertical=0;}
  else state.y=h;
 }
 state.animTime+=dt;
 playerActor.setPose({x:state.x,y:state.y,z:state.z,yaw:state.yaw,pitch:state.pitch,speed:state.stepSpeed},dt);
}
function updateCamera(dt){
 const focus=playerEye();
 focus.y+=.2;
 const f=flatForward(),rr=right();
 const desired=focus.clone().addScaledVector(f,-5.15).addScaledVector(rr,.93).add(new THREE.Vector3(0,1.65,0));
 const ray=world.raycast(focus,tmpB.subVectors(desired,focus).normalize(),focus.distanceTo(desired));
 if(ray&&ray.distance<focus.distanceTo(desired)){
  desired.copy(focus).addScaledVector(tmpB,Math.max(.65,ray.distance-.3));
 }
 camSmooth.lerp(desired,clamp(1-Math.exp(-9*dt),0,1));
 camera.position.copy(camSmooth);
 aimPoint.copy(focus).addScaledVector(forward(),34);
 camera.lookAt(aimPoint);
}
function updateStorm(dt){
 const t=state.elapsed;
 const radius=clamp(92-Math.max(0,t-18)*.24,19,92);
 state.stormRadius=radius;world.setStorm(radius);
 state.stormTick+=dt;
 if(Math.hypot(state.x,state.z)>radius&&state.stormTick>=1){
  state.stormTick=0;dealPlayerDamage(7);safeToast('⛈ ТЫ ВНЕ БЕЗОПАСНОЙ ЗОНЫ!',1.4);
 }
}
function updateLoot(){
 for(const loot of world.loot){
  if(!loot.alive||Math.hypot(state.x-loot.x,state.z-loot.z)>1.8)continue;
  world.collectLoot(loot);
  if(loot.kind==='shield'){state.shield=Math.min(100,state.shield+27);safeToast('+27 ЗАЩИТЫ');}
  else if(loot.kind==='heal'){state.hp=Math.min(100,state.hp+35);safeToast('+35 ЗДОРОВЬЯ');}
  else{state.reserve.rifle+=28;state.reserve.shotgun+=8;safeToast('+28 ПАТРОНОВ');}
 }
}
function updateEffects(dt){
 for(let i=events.length-1;i>=0;i--){
  const e=events[i];e.time-=dt;
  if(e.vel){e.mesh.position.addScaledVector(e.vel,dt);e.vel.y-=12*dt;}
  if(e.mesh.material?.opacity!==undefined)e.mesh.material.opacity=Math.max(0,e.time/e.max);
  if(e.time<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();events.splice(i,1);}
 }
 if(state.toastUntil<state.elapsed)ui.toast.classList.remove('show');
 document.body.style.filter='';
}
function updateGhost(){
 if(!state.buildMode){buildGhost.visible=false;return}
 buildGhost.visible=true;
 const spot=ghostSpot();
 buildGhost.position.set(spot.x,groundHeight(spot.x,spot.z)+state.buildLevel*3,spot.z);
 buildGhost.rotation.y=spot.angle;
}
function updateQuick(){
 const art=state.buildMode?['🧱','▤','◩','⌂']:['🔫','💥','⛏','🩹'];
 const names=state.buildMode?['СТЕНА','ПОЛ','ЛЕСТН.','КРЫША']:['АВТОМАТ','ДРОБОВ.','КИРКА','АПТЕЧКА'];
 for(let i=1;i<=4;i++){
  const s=ui.quick.children[i-1];
  if(!s)continue;
  s.querySelector('.art').textContent=art[i-1];
  s.querySelector('.name').textContent=names[i-1];
  s.classList.toggle('active',state.buildMode?state.piece===i:state.slot===i);
 }
 ui.mode.textContent=state.buildMode?
  '🏗 СТРОИТЕЛЬСТВО · ЭТАЖ '+(state.buildLevel+1)+' · '+({wood:'ДЕРЕВО',stone:'КАМЕНЬ',metal:'МЕТАЛЛ'}[state.material])+' · E — ПОВОРОТ · Z — МАТЕРИАЛ'
  :'⚔ РЕЖИМ БОЯ · Q — СТРОИТЬ';
}
function updateHUD(){
 ui.kills.textContent=state.kills;
 ui.remaining.textContent=state.remaining;
 const sec=Math.max(0,Math.floor(18+(92-state.stormRadius)/.24-state.elapsed));
 const timeRemaining=Math.max(0,Math.ceil((92-19)/.24+18-state.elapsed));
 ui.stormTime.textContent=Math.floor(timeRemaining/60).toString().padStart(2,'0')+':'+Math.floor(timeRemaining%60).toString().padStart(2,'0');
 ui.hpFill.style.width=state.hp+'%';ui.shFill.style.width=state.shield+'%';
 ui.hpText.textContent=Math.ceil(state.hp);ui.shText.textContent=Math.ceil(state.shield);
 ui.woodText.textContent=state.wood;ui.stoneText.textContent=state.stone;ui.metalText.textContent=state.metal;
 if(state.buildMode){
  ui.weaponLabel.textContent='BUILD MODE';
  ui.ammoText.textContent='10▣';
  ui.actionText.textContent='ЛКМ — ПОСТРОИТЬ · Q — В БОЙ';
 }else if(state.slot===3){
  ui.weaponLabel.textContent='PICKAXE';
  ui.ammoText.textContent='∞';
  ui.actionText.textContent='F / ЛКМ — ДОБЫВАТЬ';
 }else if(state.slot===4){
  ui.weaponLabel.textContent='HEAL KIT';
  ui.ammoText.textContent=String(state.medkit);
  ui.actionText.textContent='ЛКМ — ЛЕЧИТЬСЯ';
 }else{
  const key=state.slot===2?'shotgun':'rifle';
  ui.weaponLabel.textContent=stats[key].name;
  ui.ammoText.innerHTML=state.ammo[key]+'<span> / '+state.reserve[key]+'</span>';
  ui.actionText.textContent=state.reload>0?'ПЕРЕЗАРЯДКА '+state.reload.toFixed(1)+'s':'R — ПЕРЕЗАРЯДКА';
 }
}
function drawMap(){
 const ctx=mini,w=ui.minimap.width,h=ui.minimap.height;
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#173f3f';ctx.fillRect(0,0,w,h);
 // Draw a stylized green coastline with natural variation
 ctx.beginPath();
 for(let i=0;i<90;i++){
  const a=i/90*Math.PI*2,rad=106+Math.sin(a*9)*3+Math.cos(a*13)*2;
  const x=w/2+Math.cos(a)*rad*.92,y=h/2+Math.sin(a)*rad*.92;
  if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 ctx.closePath();ctx.fillStyle='#43786a';ctx.fill();
 ctx.strokeStyle='#9ac6ab88';ctx.lineWidth=2;ctx.stroke();
 for(const c of world.colliders){
  const xx=w/2+c.x*.92,yy=h/2+c.z*.92;
  ctx.fillStyle=c.type==='house'?'#e4b97e':c.type==='tree'?'#295d48':'#769c95';
  ctx.beginPath();ctx.arc(xx,yy,c.type==='house'?5:c.type==='tree'?1.4:2,0,Math.PI*2);ctx.fill();
 }
 for(const b of world.builds){ctx.fillStyle='#f9dd92';ctx.fillRect(w/2+b.x*.92-2,h/2+b.z*.92-2,4,4);}
 ctx.strokeStyle='#79dbf9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(w/2,h/2,state.stormRadius*.92,0,Math.PI*2);ctx.stroke();
 for(const b of bots){
  if(!b.alive)continue;
  ctx.fillStyle='#ff7d6c';ctx.beginPath();ctx.arc(w/2+b.x*.92,h/2+b.z*.92,4,0,Math.PI*2);ctx.fill();
 }
 const px=w/2+state.x*.92,py=h/2+state.z*.92;
 ctx.save();ctx.translate(px,py);ctx.rotate(-state.yaw);
 ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fillStyle='#f3fffa';ctx.fill();ctx.strokeStyle='#154f54';ctx.lineWidth=2;ctx.stroke();ctx.restore();
}
function endMatch(victory){
 if(state.ended)return;
 state.running=false;state.paused=false;state.ended=true;
 Promise.resolve(document.exitPointerLock?.()).catch(()=>{});
 $('end').style.display='grid';
 $('endLine').textContent=victory?'VICTORY ROYALE':'MATCH OVER';
 $('endTitle').innerHTML=victory?'✦ ПОБЕДА!':'ТЫ ВЫБЫЛ';
 $('endStats').innerHTML='Убийства: <b>'+state.kills+'</b> · Постройки: <b>'+state.buildCount+
  '</b> · Время: <b>'+Math.floor(state.elapsed/60)+' мин '+Math.floor(state.elapsed%60)+' сек</b><br>Рекорд убийств: '+state.highScore;
}
function newGame(){
 state.x=-6;state.z=8;state.y=groundHeight(-6,8);state.yaw=.15;state.pitch=.04;state.vertical=0;state.grounded=true;
 Object.assign(state,{hp:100,shield:50,wood:150,stone:80,metal:40,kills:0,remaining:8,
 medkit:2,elapsed:0,stormRadius:92,stormTick:0,slot:1,buildMode:false,piece:1,buildRotation:0,
 material:'wood',buildLevel:0,buildCount:0,reload:0,lastShot:-10,fireCooldown:0,ended:false,paused:false,running:true});
 state.ammo={rifle:30,shotgun:6};state.reserve={rifle:180,shotgun:42};
 for(const part of [...world.builds])world.root.remove(part.root);
 world.builds.length=0;
 spawnBots();setGhost();updateQuick();
 $('end').style.display='none';$('paused').style.display='none';$('menu').style.display='none';
 $('ui').classList.remove('off');
 safeToast('⚔ УНИЧТОЖЬ 8 ПРОТИВНИКОВ И ПЕРЕЖИВИ ШТОРМ',3.5);
 if(!isTouch)requestLock();
}
function pause(){
 if(!state.running||state.ended)return;
 state.paused=true;ctrls.fire=false;$('paused').style.display='grid';
 Promise.resolve(document.exitPointerLock?.()).catch(()=>{});
}
function resume(){
 state.paused=false;$('paused').style.display='none';
 if(!isTouch)requestLock();
}
function requestLock(){
 if(!state.running||state.paused||state.ended||isTouch)return;
 if(document.pointerLockElement!==renderer.domElement)Promise.resolve(renderer.domElement.requestPointerLock?.()).catch(()=>safeToast('КЛИКНИ ПО ИГРЕ ДЛЯ УПРАВЛЕНИЯ МЫШЬЮ'));
}
$('startBtn').addEventListener('click',()=>newGame());
$('resumeBtn').addEventListener('click',resume);
$('restartBtn').addEventListener('click',newGame);
$('restartPauseBtn').addEventListener('click',newGame);
$('pauseBtn').addEventListener('click',pause);
$('howBtn').addEventListener('click',()=>{$('howContent').hidden=!$('howContent').hidden});
window.addEventListener('resize',()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
window.addEventListener('keydown',event=>{
 const key=event.key.toLowerCase();
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))event.preventDefault();
 if(key==='escape'){
  if(!state.running)return;
  if(state.paused)resume();else pause();
  return;
 }
 if(!state.running||state.paused||state.ended)return;
 keys.add(key);
 if(event.repeat)return;
 if(['1','2','3','4'].includes(key))selectWeapon(Number(key));
 if(key==='q')toggleBuild();
 if(key==='e'&&state.buildMode){state.buildRotation=(state.buildRotation+Math.PI/2)%(Math.PI*2);}
 if(key==='z'&&state.buildMode){
  const mats=['wood','stone','metal'];state.material=mats[(mats.indexOf(state.material)+1)%3];setGhost();updateQuick();
 }
 if(key==='c'&&state.buildMode){
  state.buildLevel=(state.buildLevel+1)%3;
  setGhost();safeToast('ЭТАЖ '+(state.buildLevel+1)+' · ИСПОЛЬЗУЙ ЛЕСТНИЦЫ ДЛЯ ПОДЪЁМА',1.4);
  updateQuick();
 }
 if(key==='r')reload();
 if(key==='f')harvest();
 if(key==='h')tryMedkit();
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();ctrls.fire=false;if(state.running&&!state.paused)pause()});
document.addEventListener('pointerlockchange',()=>{
 if(!isTouch && state.running&&!state.ended&&!state.paused&&document.pointerLockElement!==renderer.domElement){
  // Alt-tab and escape pause cleanly, but avoid early pausing on newGame.
  // If the lock request was denied, allow keyboard-only control.
 }
});
renderer.domElement.addEventListener('mousedown',event=>{
 if(!state.running||state.paused||state.ended)return;
 if(event.button===0){ctrls.fire=true;if(state.buildMode)shoot();}
 if(event.button===2){if(state.buildMode)toggleBuild(false);}
 if(!isTouch)requestLock();
});
renderer.domElement.addEventListener('mouseup',event=>{if(event.button===0)ctrls.fire=false});
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('mousemove',event=>{
 if(!state.running||state.paused||state.ended)return;
 if(document.pointerLockElement===renderer.domElement){
  state.yaw-=event.movementX*.0029;
  state.pitch=clamp(state.pitch-event.movementY*.00235,-.84,1.05);
 }
});
// Mobile analog input + right-thumb aiming + direct combat/build controls.
let touchLookId=null,touchLookX=0,touchLookY=0;
$('mobileLook').addEventListener('pointerdown',event=>{touchLookId=event.pointerId;touchLookX=event.clientX;touchLookY=event.clientY;$('mobileLook').setPointerCapture(event.pointerId)});
$('mobileLook').addEventListener('pointermove',event=>{
 if(event.pointerId!==touchLookId)return;
 state.yaw-=(event.clientX-touchLookX)*.007;
 state.pitch=clamp(state.pitch-(event.clientY-touchLookY)*.005,-.84,1.05);
 touchLookX=event.clientX;touchLookY=event.clientY;
});
$('mobileLook').addEventListener('pointerup',()=>touchLookId=null);
const stick=$('moveStick'),knob=$('stickKnob');
const stickMove=event=>{
 const b=stick.getBoundingClientRect();
 const vx=(event.clientX-b.left-b.width/2)/(b.width*.38);
 const vy=(event.clientY-b.top-b.height/2)/(b.height*.38);
 const mag=Math.max(1,Math.hypot(vx,vy));
 ctrls.stickX=vx/mag;ctrls.stickY=vy/mag;
 knob.style.transform='translate('+(ctrls.stickX*38)+'px,'+(ctrls.stickY*38)+'px)';
};
stick.addEventListener('pointerdown',e=>{stick.setPointerCapture(e.pointerId);stickMove(e)});
stick.addEventListener('pointermove',e=>{if(stick.hasPointerCapture(e.pointerId))stickMove(e)});
const resetStick=()=>{ctrls.stickX=0;ctrls.stickY=0;knob.style.transform='';};
stick.addEventListener('pointerup',resetStick);stick.addEventListener('pointercancel',resetStick);
$('fireTouch').addEventListener('pointerdown',e=>{e.preventDefault();ctrls.fire=true;if(state.buildMode)shoot()});
for(const name of ['pointerup','pointercancel','pointerleave'])$('fireTouch').addEventListener(name,()=>ctrls.fire=false);
$('jumpTouch').addEventListener('pointerdown',()=>ctrls.jump=true);
$('jumpTouch').addEventListener('pointerup',()=>ctrls.jump=false);
$('buildTouch').addEventListener('click',()=>{if(state.running)toggleBuild()});
$('swapTouch').addEventListener('click',()=>{if(!state.running)return;selectWeapon(state.buildMode?(state.piece%4+1):(state.slot%3+1))});
ui.quick.addEventListener('click',e=>{const slot=e.target.closest('.slot');if(slot&&state.running)selectWeapon(+slot.dataset.slot)});
let hudAccumulator=0,mapAccumulator=0;
function animate(){
 const dt=Math.min(clock.getDelta(),.048);
 requestAnimationFrame(animate);
 const active=state.running&&!state.paused&&!state.ended;
 if(active){
  state.elapsed+=dt;
  state.fireCooldown=Math.max(0,state.fireCooldown-dt);
  if(state.reload>0){state.reload-=dt;if(state.reload<=0){state.reload=0;finishReload();}}
  updateMovement(dt);
  updateBots(dt);
  updateStorm(dt);
  updateLoot();
  if(ctrls.fire&&!state.buildMode)shoot();
  updateGhost();
  updateEffects(dt);
  world.update(dt,state.elapsed);
  hudAccumulator+=dt;mapAccumulator+=dt;
  if(hudAccumulator>=.09){updateHUD();hudAccumulator=0;}
  if(mapAccumulator>=.25){drawMap();mapAccumulator=0;}
 }else{
  // Keep the world alive behind the start overlay without running combat.
  world.update(Math.min(dt,.03),state.elapsed);
  playerActor.setPose({x:state.x,y:state.y,z:state.z,yaw:state.yaw,speed:0},0);
 }
 updateCamera(dt);
 renderer.render(scene,camera);
}
updateQuick();updateHUD();drawMap();animate();
// These diagnostics make the prototype testable without fake screenshots.
window.SKYFORGE={
 state,world,bots,playerActor,camera,renderer,
 get mode(){return state.buildMode?'build':'combat'},
 get ready(){return !!renderer.domElement&&!!world.root&&!!playerActor.group},
 start:newGame,pause,resume,toggleBuild,selectWeapon,build,harvest,reload,shoot,
 status(){return {playing:state.running&&!state.paused,thirdPerson:true,botsAlive:state.remaining,
 builds:world.builds.length,health:state.hp,shield:state.shield,material:state.material,
 ammo:state.ammo.rifle,drawCalls:renderer.info.render.calls};}
};
loadActors().then(()=>console.info('SKYFORGE soldiers loaded')).catch(console.warn);
