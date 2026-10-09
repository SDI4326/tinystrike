// Local 1v1 arena host for an offline, licence-safe browser training match.
// Peer play is intentionally not simulated as real multiplayer.
const enemyName='RIVAL-01';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const rand=(a,b)=>a+Math.random()*(b-a);
export class DuelServer{
 constructor(){
  this.listeners=new Map();this.playing=false;this.practice=false;this.roundActive=false;
  this.playerHealth=100;this.wins=0;this.losses=0;this.round=1;this.difficulty='normal';
  this.me={x:0,y:1.8,z:28};
  this.bot=this.spawnBot();this.t=0;this.bots=[this.bot];
  this.storm={radius:54,centerX:0,centerZ:0,nextShrinkIn:99};
  setTimeout(()=>this.deliver('init',{
   id:'skyforge-player',color:'#5cf4e0',name:'YOU',players:[this.publicBot()],
   placedBlocks:[],buildBlocks:[],weaponChests:[],storm:{...this.storm}
  }),50);
  this.timer=setInterval(()=>this.tick(.07),70);
 }
 spawnBot(){return {id:'rival',name:enemyName,color:'#ff865a',health:100,isDead:false,
  position:{x:0,y:1.8,z:-28},rotation:{y:Math.PI},cooldown:2,dir:1,strafeTime:1.2,coverTime:0,shotIndex:0};}
 publicBot(){const b=this.bot;return {id:b.id,name:b.name,color:b.color,health:b.health,isDead:b.isDead,position:{...b.position},rotation:{...b.rotation}}}
 on(ev,fn){const a=this.listeners.get(ev)||[];a.push(fn);this.listeners.set(ev,a);return this;}
 off(ev,fn){this.listeners.set(ev,(this.listeners.get(ev)||[]).filter(f=>f!==fn));return this;}
 deliver(ev,p){for(const h of this.listeners.get(ev)||[])try{h(p)}catch(e){console.error('DuelServer',ev,e)}}
 start(){this.playing=true;this.roundActive=true;this.t=0;this.resetBot();}
 setPractice(v){this.practice=!!v;this.playing=true;this.roundActive=true;this.deliver('playerLeft',{id:'rival'});this.storm.radius=70;this.deliver('stormUpdate',{...this.storm});}
 setDifficulty(v){this.difficulty=['easy','normal','hard'].includes(v)?v:'normal'}
 resetBot(){
  this.bot=this.spawnBot();this.bots=[this.bot];
  this.deliver('playerRespawned',{id:'rival',position:{...this.bot.position}});
  this.deliver('playerMoved',{id:'rival',position:{...this.bot.position},rotation:{...this.bot.rotation}});
 }
 async finishRound(won){
  if(!this.roundActive||this.practice)return;
  this.roundActive=false;
  if(won)this.wins++;else this.losses++;
  this.deliver('skyforge:score',{wins:this.wins,losses:this.losses,round:this.round,won});
  window.dispatchEvent(new CustomEvent('skyforge:duel-end',{detail:{won,wins:this.wins,losses:this.losses}}));
  if(this.wins>=5||this.losses>=5){this.playing=false;this.deliver('skyforge:match-complete',{won:this.wins>=5,wins:this.wins,losses:this.losses});return;}
  await sleep(2400);
  this.round++;this.playerHealth=100;this.me={x:0,y:1.8,z:28};
  this.deliver('respawned',{position:{...this.me},health:100});
  this.resetBot();
  this.roundActive=true;this.storm.radius=54;this.t=0;
  this.deliver('skyforge:round-start',{round:this.round});
 }
 onPlayerDeath(){if(!this.roundActive)return;this.finishRound(false);}
 emit(ev,p={}){
  if(ev==='playerUpdate'){this.me={...p.position};return;}
  if(ev==='shoot'){
   if(this.practice||!this.roundActive||this.bot.isDead||p.targetId!=='rival')return;
   const damage=Math.min(120,Math.max(0,Number(p.damage)||0));
   this.bot.health=Math.max(0,this.bot.health-damage);
   this.deliver('skyforge:enemy-health',{health:this.bot.health,damage});
   if(this.bot.health<=0){
    this.bot.isDead=true;this.deliver('playerDied',{deadId:'rival',message:'YOU eliminated RIVAL'});
    this.finishRound(true);
   }
   return;
  }
  if(ev==='respawn'){this.playerHealth=100;this.deliver('respawned',{position:{x:0,y:1.8,z:28},health:100});return;}
  if(ev==='pickupChest'){this.deliver('weaponPickedUp',{weaponType:'shotgun'});return;}
  if(ev==='placeBlock'){this.deliver('skyforge:built',p);return;}
 }
 blocked(a,b){
  if(!this.world)return false;
  const p=this.world.buildingBlocks||[];
  if(!p.length)return false;
  // Check only user-created cover, never visual decorations or the ground.
  for(const wall of p){
   if(wall.name!=='placed_block')continue;
   const ax=a.x,az=a.z,bx=b.x,bz=b.z;
   const vx=bx-ax,vz=bz-az,length=vx*vx+vz*vz;
   if(length<.1)continue;
   const t=Math.max(0,Math.min(1,((wall.position.x-ax)*vx+(wall.position.z-az)*vz)/length));
   if(Math.hypot(ax+vx*t-wall.position.x,az+vz*t-wall.position.z)<1.85
     &&Math.abs(wall.position.y-1.8)<3)return true;
  }
  return false;
 }
 tick(dt){
  if(!this.playing)return;this.t+=dt;
  if(this.practice)return;
  if(!this.roundActive)return;
  const b=this.bot,dx=this.me.x-b.position.x,dz=this.me.z-b.position.z,dist=Math.hypot(dx,dz)||1;
  b.rotation.y=Math.atan2(-dx,-dz);
  const level=this.difficulty==='hard'?1.28:this.difficulty==='easy'?.72:1;
  const speed=5.8*level;
  b.strafeTime-=dt;
  if(b.strafeTime<=0){b.dir*=-1;b.strafeTime=rand(1.0,2.5);}
  const forward=dist>14?0.5:dist<7?-.60:.08;
  const vx=dx/dist*forward+(-dz/dist)*b.dir*.92;
  const vz=dz/dist*forward+(dx/dist)*b.dir*.92;
  let nx=b.position.x+vx*speed*dt,nz=b.position.z+vz*speed*dt;
  if(nx>48||nx<-48){b.dir*=-1;nx=b.position.x;}
  if(nz>48||nz<-48){b.dir*=-1;nz=b.position.z;}
  if(!this.world?.isArenaPointBlocked?.(nx,nz)){b.position.x=nx;b.position.z=nz;}
  this.deliver('playerMoved',{id:b.id,position:{...b.position},rotation:{...b.rotation}});
  b.cooldown-=dt;
  if(dist<51&&b.cooldown<=0){
   b.cooldown=(1.22+Math.random()*.65)/level;
   if(!this.blocked(b.position,this.me)){
    this.deliver('playerShot',{origin:{...b.position},direction:{x:dx/dist,y:.06,z:dz/dist}});
    const accuracy=Math.max(.2,Math.min(.79,.61-dist*.0055))*level;
    if(Math.random()<accuracy&&!globalThis.SKY_DUEL_CHEATS?.god){
     const damage=rand(6,12);
     this.playerHealth=Math.max(0,this.playerHealth-damage);
     this.deliver('hit',{damage});
    }
   }
  }
  if(b.coverTime<=0 && this.difficulty==='hard' &&Math.random()<.0015){
   b.coverTime=3;
   this.deliver('skyforge:bot-build',{x:b.position.x,y:2,z:b.position.z});
  }
  b.coverTime=Math.max(0,b.coverTime-dt);
 }
}
export function makeDuelServer(){return new DuelServer();}
