import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
const cwd=process.cwd(),source=path.join(cwd,'source'),overlay=path.join(cwd,'addons'),dist=path.join(cwd,'dist');
const run=(bin,args,dir=cwd)=>{console.log('>',bin,args.join(' '));execFileSync(bin,args,{cwd:dir,stdio:'inherit',timeout:220000})};
run('git',['clone','--depth=1','https://github.com/cass-agency/fortnite-clone.git',source]);
run('git',['clone','--depth=1','--filter=blob:none','--sparse','--single-branch','--branch','skyforge-duel-arena','https://github.com/SDI4326/tinystrike.git',overlay]);
run('git',['sparse-checkout','set','duel'],overlay);
const gameDir=path.join(source,'src','game'),duelDir=path.join(overlay,'duel');
for(const file of ['ArenaWorld.js','DuelServer.js','DuelUI.js','Soldier.js'])await cp(path.join(duelDir,file),path.join(gameDir,file));
function patch(s,a,b,label){if(!s.includes(a))throw Error('Missing source anchor '+label);return s.replace(a,b)}
const src=path.join(source,'src','main.js');
let main=await readFile(src,'utf8');
main=patch(main,"import { io } from 'socket.io-client';",[
 "import {makeDuelServer} from './game/DuelServer.js';",
 "import {installDuelUI} from './game/DuelUI.js';",
 "import {attachCombatSoldier} from './game/Soldier.js';"].join('\n'),'network');
main=patch(main,"import { World } from './game/World.js';","import {ArenaWorld} from './game/ArenaWorld.js';",'arena import');
main=patch(main,'const socket = io();','const socket = makeDuelServer();','offline host');
main=patch(main,'const world = new World(scene);','const world = new ArenaWorld(scene);','arena');
main=patch(main,'const thirdPersonCamera = new ThirdPersonCamera(camera);',
 'const thirdPersonCamera = new ThirdPersonCamera(camera);\nconst duelUI = installDuelUI({socket,canvas,renderer,world});','duel interface');
main=patch(main,'let builder = null;','let builder = null;\nlet animateSoldier=()=>{};','soldier tick');
main=patch(main,"  player = new Player(scene, camera, localPlayerColor || '#4d96ff');",
"  player = new Player(scene, camera, localPlayerColor || '#4d96ff');\n  player.position.set(0,1.8,28);",'spawn');
main=patch(main,'  builder = new Builder(scene, player, socket, world, hud);',
[
'  builder = new Builder(scene, player, socket, world, hud);',
'  socket.world=world;',
'  socket.start();',
'  if(socket.practice)socket.setPractice(true);',
'  duelUI.attach({player,weapon,builder});',
'  attachCombatSoldier(player).then(fn=>animateSoldier=fn);',
'  globalThis.SKYFORGE_GAME={player,weapon,builder,world,socket,renderer,scene,camera};'
].join('\n'),'match initialization');
main=patch(main,'  hud.updatePlayerCount(1);','  hud.updatePlayerCount(socket.practice?1:2);','counter');
main=patch(main,"function showDeathScreen() {\n  document.getElementById('death-screen').style.display = 'flex';\n}","function showDeathScreen() {\n  socket.onPlayerDeath();\n}",'round loss');
main=patch(main,'  if (gameStarted && document.pointerLockElement !== canvas) {',
"  if (document.getElementById('sd-cheats')?.classList.contains('show'))return;\n  if (gameStarted && document.pointerLockElement !== canvas) {",'pointerlock');
main=patch(main,'    player.update(delta, world);','    player.update(delta, world);\n    animateSoldier(delta);','animated character');
main=patch(main,'  const delta   = clock.getDelta();','  const delta   = Math.min(clock.getDelta(),0.055);','frame spike');
main=patch(main,'  canvas.requestPointerLock();','  Promise.resolve(canvas.requestPointerLock?.()).catch(()=>{});','lock initialization');
await writeFile(src,main);
let player=await readFile(path.join(gameDir,'Player.js'),'utf8');
player=patch(player,'const speed = this.isSprinting ? SPRINT_SPEED : MOVE_SPEED;',
"const speed=(this.isSprinting ? SPRINT_SPEED : MOVE_SPEED)*(globalThis.SKY_DUEL_CHEATS?.speed?2.0:1);",'speed');
player=patch(player,"    if (!this.isOnGround) {\n      this.velocity.y += GRAVITY * delta;\n    }",
"    if(globalThis.SKY_DUEL_CHEATS?.fly){this.velocity.y=(this.keys['Space']?12:0)-(this.keys['KeyF']?12:0);this.isOnGround=false;}\n    else if (!this.isOnGround) {\n      this.velocity.y += GRAVITY * delta;\n    }",'flight');
player=patch(player,'  takeDamage(amount) {\n    this.health','  takeDamage(amount) {\n    if(globalThis.SKY_DUEL_CHEATS?.god)return;\n    this.health','god mode');
await writeFile(path.join(gameDir,'Player.js'),player);
let builder=await readFile(path.join(gameDir,'Builder.js'),'utf8');
builder=patch(builder,'const BLOCK_SIZE = 2;','const BLOCK_SIZE = 4;','build dimensions');
const start=builder.indexOf('  _getPlacementTransform() {'),end=builder.indexOf('  _placeBlock() {');
if(start<0||end<0||end<start)throw Error('Missing source building transform');
const transformed=[
'  _getPlacementTransform() {',
'    const p=this.player.position.clone();',
'    p.x-=Math.sin(this.player.yaw)*5.5;',
'    p.z-=Math.cos(this.player.yaw)*5.5;',
'    p.x=Math.round(p.x/BLOCK_SIZE)*BLOCK_SIZE;',
'    p.z=Math.round(p.z/BLOCK_SIZE)*BLOCK_SIZE;',
'    p.y=this.pieceIndex===1?.24:2;',
'    if(this.player.pitch<-.42)p.y+=4;',
'    return p;',
'  }',
''].join('\n');
builder=builder.slice(0,start)+transformed+'\n'+builder.slice(end);
await writeFile(path.join(gameDir,'Builder.js'),builder);
let weapon=await readFile(path.join(gameDir,'Weapon.js'),'utf8');
weapon=patch(weapon,"export const WEAPON_DEFS = {\n  pistol: {",
"export const WEAPON_DEFS = {\n  rifle: {name:'Assault Rifle',damage:18,fireRate:.105,ammo:30,maxAmmo:30,reload:1.8,spread:.019,pellets:1,color:0x315a67},\n  pistol: {",'rifle');
weapon=patch(weapon,"      if (e.code === 'Digit3') this.equipWeapon('sniper');",
"      if (e.code === 'Digit3') this.equipWeapon('sniper');\n      if (e.code === 'Digit4') this.equipWeapon('rifle');",'rifle input');
weapon=patch(weapon,'    if (this.fireCooldown > 0) this.fireCooldown -= delta;',
"    if(globalThis.SKY_DUEL_CHEATS?.ammo){this.ammo=this.def.maxAmmo;this.hud.updateAmmo(this.ammo,this.def.name);}\n    if (this.fireCooldown > 0) this.fireCooldown -= delta;",'unlimited ammo');
await writeFile(path.join(gameDir,'Weapon.js'),weapon);
let server=await readFile(path.join(gameDir,'DuelServer.js'),'utf8');
server=patch(server,'players:[this.publicBot()]','players:this.practice?[]:[this.publicBot()]','practice mode');
server=patch(server,'if(!this.playing)return;this.t+=dt;','if(!this.playing||this.paused)return;this.t+=dt;','pause');
await writeFile(path.join(gameDir,'DuelServer.js'),server);
let html=await readFile(path.join(source,'index.html'),'utf8');
html=html.replace('<title>Voxel Battle Royale</title>','<title>SKYFORGE DUEL — 1v1 Build Fights</title>');
html=html.replace('</head>','<link rel="stylesheet" href="/duel.css"></head>');
await writeFile(path.join(source,'index.html'),html);
await cp(path.join(duelDir,'duel.css'),path.join(source,'duel.css'));
for(const file of ['main.js','game/ArenaWorld.js','game/DuelServer.js','game/DuelUI.js','game/Soldier.js','game/Builder.js','game/Weapon.js','game/Player.js'])
 run('node',['--check',path.join(source,'src',file)]);
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
run('npm',['run','build'],source);
await mkdir(dist,{recursive:true});
await cp(path.join(source,'dist'),dist,{recursive:true});
await cp(path.join(source,'LICENSE'),path.join(dist,'LICENSE.txt'));
await writeFile(path.join(dist,'ATTRIBUTION.txt'),'SKYFORGE DUEL is a modified MIT-licensed Voxel Royale game, from cass-agency/fortnite-clone. Original project license preserved in LICENSE.txt. Arena and UI authored for SDI4326/tinystrike. Character art is CC0-licensed Quaternius Toon Shooter. No proprietary code or assets from 1v1.LOL. Independent, not affiliated with JustPlay.LOL or Epic Games.');
await mkdir(path.join(dist,'assets'),{recursive:true});
const response=await fetch('https://raw.githubusercontent.com/SDI4326/tinystrike/main/assets/models/soldier_ct.glb');
if(!response.ok)throw Error('3D soldier unavailable: '+response.status);
await writeFile(path.join(dist,'assets','soldier_ct.glb'),new Uint8Array(await response.arrayBuffer()));
console.log('SKYFORGE DUEL completed and syntax-checked');
