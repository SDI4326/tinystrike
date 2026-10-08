import * as THREE from 'three';
import {upgradeIsland} from './map-plus.js';

function init(){
 const app=window.SKYFORGE;
 if(!app){setTimeout(init,60);return;}
 const {world,state,camera,playerActor}=app;
 upgradeIsland(world);
 const $=id=>document.getElementById(id);
 const css=document.createElement('style');
 css.textContent=`
 #pilotPick{display:flex;justify-content:center;gap:10px;margin:0 auto 18px;flex-wrap:wrap}
 .pilot{display:flex;align-items:center;gap:9px;border:1px solid #ffffff33;background:#14353dc9;padding:10px 14px;border-radius:12px;color:#dffef3;font-size:12px;font-weight:900}
 .pilot.selected{border:2px solid #a9ffe0;background:#215b58;box-shadow:0 0 20px #47ffe428}
 .pilot .swatch{height:17px;width:17px;border-radius:50%;border:2px solid #fff8}
 #staminaBar{padding:7px 10px;margin-bottom:7px;border-radius:10px;background:#102b31d9;border:1px solid #a6f2c43b;display:flex;gap:8px;align-items:center;font-size:10px;font-weight:950;letter-spacing:.06em}
 #staminaTrack{flex:1;height:8px;background:#1c393f;border-radius:6px;overflow:hidden}
 #staminaFill{width:100%;height:100%;border-radius:6px;background:linear-gradient(90deg,#ffcc7e,#5df5c3)}
 #battleXP{position:absolute;bottom:145px;right:20px;text-align:right;font-size:12px;font-weight:900;color:#c5fbed;text-shadow:0 2px 5px #000}
 #newHint{margin:8px 0;color:#d9f0db;font-size:10px}
 #dashTouch{right:200px;bottom:142px;width:66px;height:66px;border-color:#fff0a5!important;background:#2d646cc9!important;font-size:11px}
 @media(max-width:900px){#battleXP{display:none}#staminaBar{font-size:8px;padding:4px;margin-bottom:4px}#dashTouch{right:180px;bottom:100px;width:52px;height:52px}}
 `;
 document.head.appendChild(css);
 const bar=document.createElement('div');bar.id='staminaBar';
 bar.innerHTML='<span>⚡ ВЫНОСЛИВОСТЬ</span><div id="staminaTrack"><div id="staminaFill"></div></div><b id="staminaText">100</b>';
 $('left').prepend(bar);
 const xp=document.createElement('div');xp.id='battleXP';xp.textContent='БОЕВОЙ УРОВЕНЬ 1 · 0 XP';
 $('ui').appendChild(xp);
 const hint=document.createElement('div');hint.id='newHint';
 hint.textContent='X — рывок · CTRL — присесть · G — разобрать постройку · колесо — прицел';
 $('hint').appendChild(hint);
 const cards=document.createElement('div');cards.id='pilotPick';
 const title=document.createElement('div');title.className='eyebrow';title.textContent='ВЫБЕРИ СТИЛЬ БОЙЦА';
 const start=$('startBtn');start.parentNode.insertBefore(title,start);start.parentNode.insertBefore(cards,start);
 const creativeBtn=document.createElement('button');
 creativeBtn.className='secondary';creativeBtn.textContent='🏗 СВОБОДНОЕ СТРОИТЕЛЬСТВО — БЕЗ БОТОВ И ШТОРМА';
 creativeBtn.style.cssText='border:1px solid #8dfbd15c;border-radius:12px;padding:13px 16px;margin-top:12px;color:#b7ffdc;background:#123d3d;width:min(340px,100%)';
 start.after(creativeBtn);
 creativeBtn.addEventListener('click',()=>{
  app.start();state.creative=true;
  state.wood=9999;state.stone=9999;state.metal=9999;state.hp=100;state.shield=100;state.remaining=0;
  for(const bot of app.bots){bot.alive=false;bot.actor.dispose();}
  app.toggleBuild(true);
  const title=$('top').querySelector('small:last-of-type');if(title)title.textContent='СВОБОДНАЯ ИГРА';
  tip('🏗 ТВОРЧЕСКИЙ РЕЖИМ · БЕЗЛИМИТНЫЕ РЕСУРСЫ');
 });
 const skinOptions=[
  {id:'aqua',label:'ШТУРМОВИК',accent:'#55fce0',dark:'#193f45'},
  {id:'ember',label:'ФЕНИКС',accent:'#ffb47e',dark:'#503738'},
  {id:'shadow',label:'ПРИЗРАК',accent:'#bdaaff',dark:'#26273d'}
 ];
 let skinId='aqua';try{skinId=localStorage.getItem('skyforge-skin')||'aqua'}catch{}
 const gear=new THREE.Group();gear.name='Skyforge Elite Gear';playerActor.visual.add(gear);
 function customize(id){
  const p=skinOptions.find(x=>x.id===id)||skinOptions[0];skinId=p.id;
  try{localStorage.setItem('skyforge-skin',skinId)}catch{}
  while(gear.children.length){const o=gear.children[0];gear.remove(o);o.geometry?.dispose();o.material?.dispose()}
  const main=new THREE.MeshStandardMaterial({color:p.accent,metalness:.55,roughness:.29,emissive:p.accent,emissiveIntensity:.34});
  const dark=new THREE.MeshStandardMaterial({color:p.dark,metalness:.44,roughness:.47});
  const piece=(geo,mat,x,y,z)=>{
   const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;gear.add(o);return o;
  };
  // Compact sci-fi suit upgrades overlay the existing animated 3D soldier.
  piece(new THREE.BoxGeometry(.43,.55,.23),dark,0,1.23,.24);
  piece(new THREE.BoxGeometry(.25,.42,.07),main,0,1.2,.39);
  for(const side of [-1,1]){
   piece(new THREE.BoxGeometry(.24,.13,.29),dark,side*.36,1.51,.01);
   piece(new THREE.BoxGeometry(.19,.065,.26),main,side*.36,1.57,.01);
   piece(new THREE.BoxGeometry(.085,.34,.075),main,side*.23,1.26,.40);
  }
  piece(new THREE.CylinderGeometry(.16,.16,.22,9),dark,.31,1.30,.38);
  piece(new THREE.TorusGeometry(.13,.037,6,13),main,.31,1.48,.40);
  piece(new THREE.BoxGeometry(.36,.055,.1),main,0,1.81,-.20);
  gear.userData.core=main;gear.userData.accent=p.accent;
  [...cards.children].forEach(b=>b.classList.toggle('selected',b.dataset.id===skinId));
 }
 skinOptions.forEach(p=>{
  const b=document.createElement('button');b.className='pilot';b.dataset.id=p.id;
  b.innerHTML='<span class="swatch" style="background:'+p.accent+'"></span>'+p.label;
  b.addEventListener('click',()=>customize(p.id));cards.appendChild(b);
 });
 customize(skinId);
 const dashBtn=document.createElement('button');dashBtn.className='touch-btn';dashBtn.id='dashTouch';dashBtn.textContent='РЫВОК';$('mobile').appendChild(dashBtn);
 const pressed=new Set();let stamina=100,dashLeft=0,dashCooldown=0,zoom=73,lastKills=0,level=1,xpValue=0;
 state.stamina=100;state.level=1;
 const originalMove=world.resolveXZ.bind(world);
 world.resolveXZ=(position,nx,nz,radius)=>{
  if(position===state){
   const crouched=pressed.has('control'), exhausted=stamina<1&&pressed.has('shift');
   const factor=crouched?.56:exhausted?.72:1;
   nx=position.x+(nx-position.x)*factor;nz=position.z+(nz-position.z)*factor;
  }
  return originalMove(position,nx,nz,radius);
 };
 const originalPose=playerActor.setPose.bind(playerActor);
 playerActor.setPose=(pose,dt)=>originalPose({...pose,crouch:pressed.has('control')},dt);
 const tip=message=>{const node=$('toast');node.textContent=message;node.classList.add('show');setTimeout(()=>node.classList.remove('show'),1600)};
 function dash(){
  if(!state.running||state.paused||state.ended||dashLeft>0||dashCooldown>0||stamina<38)return;
  stamina-=38;dashLeft=.25;dashCooldown=2.8;tip('⚡ РЫВОК!');
 }
 const reset=()=>{stamina=100;dashLeft=0;dashCooldown=0;lastKills=0;xpValue=0;level=1;state.stamina=100;state.level=1};
 for(const id of ['startBtn','restartBtn','restartPauseBtn'])$(id).addEventListener('click',reset);
 dashBtn.addEventListener('pointerdown',e=>{e.preventDefault();dash()});
 window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();pressed.add(key);
  if(e.repeat||!state.running||state.paused||state.ended)return;
  if(key==='x')dash();
  if(key==='g'&&state.buildMode){
   let closest=null,dist=6;
   for(const b of world.builds){
    const d=Math.hypot(state.x-b.x,state.z-b.z);
    if(d<dist){closest=b;dist=d}
   }
   if(!closest){tip('ПОДОЙДИ К СВОЕЙ ПОСТРОЙКЕ');return}
   world.damageBuild(closest,closest.hp+1);
   state[closest.mat]+=5;
   state.buildCount=Math.max(0,state.buildCount-1);
   tip('♻ ПОСТРОЙКА РАЗОБРАНА · +5 МАТЕРИАЛОВ');
  }
 });
 window.addEventListener('keyup',e=>pressed.delete(e.key.toLowerCase()));
 window.addEventListener('blur',()=>pressed.clear());
 window.addEventListener('wheel',e=>{
  if(!state.running||state.paused)return;
  zoom=Math.max(55,Math.min(84,zoom+Math.sign(e.deltaY)*3));
  camera.fov=zoom;camera.updateProjectionMatrix();
 },{passive:true});
 const map=$('minimap'),ctx=map.getContext('2d');
 let last=performance.now(),lastMap=0,tipVisited=new Set();
 function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(.06,(now-last)/1000);last=now;
  if(!state.running||state.paused||state.ended)return;
  dashCooldown=Math.max(0,dashCooldown-dt);
  const forward=-Math.cos(state.yaw),side=-Math.sin(state.yaw);
  const walking=['w','a','s','d'].some(k=>pressed.has(k));
  const sprint=pressed.has('shift')&&walking&&!pressed.has('control');
  stamina=Math.max(0,Math.min(100,stamina+(sprint&&stamina>0?-18:24)*dt));
  if(dashLeft>0){
   dashLeft=Math.max(0,dashLeft-dt);
   const fw=(pressed.has('w')?1:0)-(pressed.has('s')?1:0);
   const sr=(pressed.has('d')?1:0)-(pressed.has('a')?1:0);
   const mx=fw*(-Math.sin(state.yaw))+sr*Math.cos(state.yaw);
   const mz=fw*forward+sr*(-Math.sin(state.yaw));
   const mag=Math.hypot(mx,mz)||1;
   const vx=(mx||-Math.sin(state.yaw))/mag,vz=(mz||forward)/mag;
   originalMove(state,state.x+vx*24*dt,state.z+vz*24*dt,.5);
  }
  $('staminaFill').style.width=stamina+'%';$('staminaText').textContent=String(Math.ceil(stamina));
  state.stamina=Math.round(stamina);
  if(state.kills>lastKills){
   xpValue+=(state.kills-lastKills)*100;lastKills=state.kills;
   const newLevel=1+Math.floor(xpValue/200);
   if(newLevel>level){level=newLevel;state.wood+=30;state.stone+=20;tip('★ УРОВЕНЬ '+level+' · +30 ДЕРЕВА · +20 КАМНЯ')}
  }
  state.level=level;
  xp.textContent='БОЕВОЙ УРОВЕНЬ '+level+' · '+xpValue+' XP · ПОСТРОЕНО: '+world.builds.length;
  if(now-lastMap>420){
   lastMap=now;
   // POI captions on the actual live minimap.
   for(const p of world.landmarks){
    const x=map.width/2+p.x*.92,y=map.height/2+p.z*.92;
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,4.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffffff';ctx.font='bold 7px Arial';ctx.textAlign='center';
    ctx.fillText(p.name.split(' ')[0],x,y-8);
    if(Math.hypot(state.x-p.x,state.z-p.z)<16&&!tipVisited.has(p.name)){
     tipVisited.add(p.name);tip('📍 '+p.name);
    }
   }
  }
 }
 requestAnimationFrame(loop);
 app.upgrade={version:2,landmarks:world.landmarks,skin:()=>skinId,dash,hasStamina:true,demolition:true};
 console.info('SKYFORGE 2: landmarks, player cosmetics, stamina, dash and demolition installed');
}
init();
