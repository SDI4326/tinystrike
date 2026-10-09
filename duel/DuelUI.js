export function installDuelUI({socket,canvas,renderer,world}){
 const root=document.body, el=(t,id)=>{const n=document.createElement(t);n.id=id;return n};
 const hud=el('div','sd-hud');
 hud.innerHTML=[
  '<div class="sd-brand">SKYFORGE <b>DUEL</b><small>BUILD · EDIT · FIGHT</small></div>',
  '<div class="sd-score"><div>YOU <b id="sd-you">0</b></div><div class="sd-center"><small id="sd-round">ROUND 1 · FIRST TO 5</small><strong id="sd-timer">00:00</strong></div><div><b id="sd-rival">0</b> RIVAL</div></div>',
  '<div class="sd-enemy-health">RIVAL-01 <span id="sd-hp-number">100 HP</span><div><i id="sd-hp-fill"></i></div></div>',
  '<div class="sd-hotbar">',
  '<button data-weapon="pistol"><small>1</small>🔫<em>PISTOL</em></button>',
  '<button data-weapon="shotgun"><small>2</small>💥<em>SHOTGUN</em></button>',
  '<button data-weapon="sniper"><small>3</small>🎯<em>SNIPER</em></button>',
  '<button data-weapon="rifle"><small>4</small>⚡<em>RIFLE</em></button>',
  '<button data-build="0"><small>Z</small>▥<em>WALL</em></button>',
  '<button data-build="2"><small>X</small>◩<em>RAMP</em></button>',
  '<button data-build="1"><small>C</small>▤<em>FLOOR</em></button>',
  '<button data-build="3"><small>V</small>⌂<em>ROOF</em></button>',
  '</div><div class="sd-controls">WASD · SPACE ПРЫЖОК · SHIFT БЕГ · Z/X/C/V СТРОИТЬ · G УБРАТЬ · F6 ЧИТЫ</div>',
  '<button id="sd-cheat-btn">⚡ OWNER / F6</button><div id="sd-banner"></div>'
 ].join('');
 root.appendChild(hud);
 const menu=el('div','sd-cheats');
 menu.innerHTML=[
  '<div class="sd-cheats-title"><b>⚡ OWNER MODE</b><button id="sd-cheat-x">✕</button></div>',
  '<p>Настройки только для нашей одиночной тренировки.</p>',
  '<label>Бессмертие <input type="checkbox" data-key="god"></label>',
  '<label>Бесконечные патроны <input type="checkbox" data-key="ammo"></label>',
  '<label>Суперскорость <input type="checkbox" data-key="speed"></label>',
  '<label>Полёт — Space / F <input type="checkbox" data-key="fly"></label>',
  '<label>Нет отдачи <input type="checkbox" data-key="norecoil"></label>',
  '<p>Постройки бесплатные. Стена Z · лестница X · пол C · крыша V.</p>',
  '<button id="sd-cheat-close">ПРОДОЛЖИТЬ</button>'
 ].join('');
 root.appendChild(menu);
 const cheats=globalThis.SKY_DUEL_CHEATS={god:false,ammo:false,speed:false,fly:false,norecoil:false};
 let player=null,weapon=null,builder=null,mode='duel',elapsed=0,selectedPiece=0;
 const open=()=>{menu.classList.add('show');socket.paused=true;document.exitPointerLock?.()};
 const close=()=>{menu.classList.remove('show');socket.paused=false;if(player)Promise.resolve(canvas.requestPointerLock?.()).catch(()=>{})};
 const toggle=()=>menu.classList.contains('show')?close():open();
 document.getElementById('sd-cheat-btn').addEventListener('click',open);
 document.getElementById('sd-cheat-x').addEventListener('click',close);
 document.getElementById('sd-cheat-close').addEventListener('click',close);
 for(const box of menu.querySelectorAll('input'))box.addEventListener('change',()=>{cheats[box.dataset.key]=box.checked});
 const banner=document.getElementById('sd-banner');
 function toast(msg,ms=1400){banner.textContent=msg;banner.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>banner.classList.remove('show'),ms)}
 const startMenu=document.getElementById('start-screen'),startButton=document.getElementById('play-btn');
 if(startMenu){
  const h=startMenu.querySelector('h1');if(h)h.innerHTML='SKYFORGE<br><span style="color:#ffd393">DUEL</span>';
  const subtitle=startMenu.querySelector('.subtitle');if(subtitle)subtitle.textContent='FAST 1V1 BUILD FIGHTS · THIRD PERSON';
  startButton.textContent='▶ ИГРАТЬ 1V1 С БОТОМ';
  const practice=el('button','sd-practice');practice.textContent='🏗 СВОБОДНОЕ СТРОИТЕЛЬСТВО';startButton.after(practice);
  practice.addEventListener('click',()=>{mode='practice';socket.practice=true;startButton.click()});
  const difficulty=el('div','sd-difficulty');
  difficulty.innerHTML='<span>СЛОЖНОСТЬ</span><button data-level="easy">ЛЕГКО</button><button class="active" data-level="normal">НОРМАЛЬНО</button><button data-level="hard">СЛОЖНО</button>';
  practice.after(difficulty);
  difficulty.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;socket.setDifficulty(b.dataset.level);for(const x of difficulty.querySelectorAll('button'))x.classList.toggle('active',x===b)});
  const note=el('p','sd-note');note.textContent='Z стена · X лестница · C пол · V крыша · мышь стрелять / строить';difficulty.after(note);
  startMenu.querySelector('.controls-list')?.classList.add('sd-old-controls');
 }
 function selectBuild(i){
  if(!builder)return;
  if(!builder.buildMode)builder.toggleBuildMode();
  builder.pieceIndex=i;builder._buildPreviewMesh();builder.previewMesh.visible=true;builder._updateBuildHUD();
  selectedPiece=i;toast(['СТЕНА','ПОЛ','ЛЕСТНИЦА','КРЫША'][i]+' · ЛКМ УСТАНОВИТЬ',700);
 }
 function selectWeapon(type){
  if(!builder||!weapon)return;
  if(builder.buildMode)builder.toggleBuildMode();
  weapon.equipWeapon(type);
 }
 function dismantle(){
  if(!builder||!player)return;let closest=null,d=6;
  for(const [key,b] of builder.buildingBlocks){const len=player.position.distanceTo(b.mesh.position);if(len<d){d=len;closest=key}}
  if(!closest){toast('ПОДОЙДИ К ПОСТРОЙКЕ');return}
  builder._destroyBlock(closest,builder.buildingBlocks.get(closest));toast('ПОСТРОЙКА УБРАНА');
 }
 document.addEventListener('keydown',e=>{
  if(e.code==='F6'){e.preventDefault();e.stopImmediatePropagation();toggle();return;}
  if(e.code==='Escape'&&menu.classList.contains('show')){e.preventDefault();e.stopImmediatePropagation();close();return;}
  if(!player||menu.classList.contains('show')||e.repeat)return;
  const keys={KeyZ:0,KeyX:2,KeyC:1,KeyV:3};
  if(e.code in keys){e.preventDefault();selectBuild(keys[e.code])}
  else if(e.code==='Digit4'){e.preventDefault();selectWeapon('rifle')}
  else if(e.code==='KeyG'){e.preventDefault();dismantle()}
 },true);
 hud.querySelector('.sd-hotbar').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!player)return;
  if(b.dataset.build!=null)selectBuild(Number(b.dataset.build));
  else if(b.dataset.weapon)selectWeapon(b.dataset.weapon);
 });
 socket.on('skyforge:score',d=>{toast(d.won?'⚡ РАУНД ВЫИГРАН':'☠ РАУНД ПРОИГРАН',2200);elapsed=0});
 socket.on('skyforge:round-start',()=>toast('⚔ СЛЕДУЮЩИЙ РАУНД',950));
 socket.on('skyforge:match-complete',d=>{
  const end=document.getElementById('death-screen');end.style.display='flex';
  end.querySelector('h2').textContent=d.won?'🏆 ПОБЕДА!':'ПОРАЖЕНИЕ';
  end.querySelector('p').textContent='СЧЁТ: '+d.wins+' : '+d.losses;
  const btn=document.getElementById('respawn-btn');btn.textContent='ИГРАТЬ ЗАНОВО';btn.onclick=()=>location.reload();
  document.exitPointerLock?.();
 });
 let last=performance.now(),acc=0;
 function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(!player)return;
  if(socket.playing&&!socket.paused)elapsed+=dt;
  acc+=dt;if(acc<.1)return;acc=0;
  document.getElementById('sd-round').textContent=mode==='practice'?'FREE BUILD':'ROUND '+socket.round+' · FIRST TO 5';
  document.getElementById('sd-you').textContent=socket.wins;
  document.getElementById('sd-rival').textContent=socket.losses;
  document.getElementById('sd-timer').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
  const hp=Math.max(0,socket.bot?.health||0);
  document.getElementById('sd-hp-number').textContent=hp+' HP';document.getElementById('sd-hp-fill').style.width=hp+'%';
  document.querySelector('.sd-enemy-health').style.display=mode==='practice'?'none':'block';
  for(const b of hud.querySelectorAll('.sd-hotbar button'))b.classList.toggle('active',b.dataset.build!=null?builder.buildMode&&Number(b.dataset.build)===selectedPiece:!builder.buildMode&&b.dataset.weapon===weapon.currentWeaponType);
 }
 requestAnimationFrame(loop);
 const api={
  attach({player:p,weapon:w,builder:b}){player=p;weapon=w;builder=b;hud.classList.add('playing');toast(mode==='practice'?'🏗 СТРОЙ БЕЗ ОГРАНИЧЕНИЙ':'⚔ 1V1 · ПЕРВЫМ ДО ПЯТИ',1800);},
  get mode(){return mode},get cheats(){return cheats},selectBuild,selectWeapon,toggle,
  status(){return {mode,wins:socket.wins,losses:socket.losses,round:socket.round,builds:builder?.buildingBlocks.size||0,enemyHP:socket.bot?.health||0}}
 };
 window.SKYFORGE_DUEL=api;return api;
}
