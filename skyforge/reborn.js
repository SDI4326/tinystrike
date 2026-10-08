import * as THREE from 'three';

// Reborn expansion: original battle map, persistent builds and performance settings.
function init() {
 const g=window.SKYFORGE;
 if(!g?.upgrade){setTimeout(init,90);return;}
 const {world,state,renderer}=g, el=id=>document.getElementById(id);
 const saveKey='skyforge-reborn-builds-v1',qualityKey='skyforge-reborn-quality-v1';
 const types=new Set(['wall','floor','ramp','roof']),materials=new Set(['wood','stone','metal']);
 const make=(color,metalness=0,emissive=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.7,flatShading:true,emissive:emissive?color:'#000000',emissiveIntensity:emissive});
 const mat={concrete:make('#8c9a99'),steel:make('#344d58',.5),orange:make('#b67b53',.22),blue:make('#4c8193',.4),trim:make('#d3e4df',.25),lamp:make('#ffc883',.2,.4),neon:make('#65eedb',.4,.7)};
 const ground=(x,z)=>Math.sin(x*.059+1.6)*.75+Math.sin(z*.049-2)*.62+Math.sin((x+z)*.105)*.22+Math.cos(x*.2-z*.09)*.17+Math.max(0,Math.hypot(x,z)-78)*.015;
 const box=(x,z,w,d,h,m,y=0,collide=false)=>{
  const mesh=world.box(w,h,d,m,x,ground(x,z)+y+h/2,z);
  if(collide)world.colliders.push({x,z,w,d,type:'structure'});
  return mesh;
 };
 const pole=(x,z)=>{
  const y=ground(x,z);
  world.cyl(.15,.19,4.5,mat.steel,x,y+2.25,z,8);
  world.box(.8,.2,.8,mat.lamp,x,y+4.6,z);
 };
 function makeCompound(){
  const x=45,z=5;
  for(let i=-3;i<=3;i++)box(x+i*5.8,z,5.8,23,.18,mat.concrete);
  for(const side of [-1,1]){
   box(x+side*20,z,1.3,19,6,mat.steel,0,true);
   box(x+side*15,z-10,8,1.4,5,mat.blue,0,true);
   box(x+side*15,z+10,8,1.4,5,mat.orange,0,true);
   box(x+side*7,z+side*3,3,2,1.6,mat.steel,0,true);
   box(x+side*7,z+side*3,3.2,2.2,.12,mat.trim,1.6);
   pole(x+side*24,z-13);pole(x+side*24,z+13);
  }
  box(x,z,23,2.4,.45,mat.steel,5.4);
  for(const d of [-11,11])box(x+d,z,1,2.4,5.3,mat.concrete);
  const beacon=world.cyl(.6,.6,2.8,mat.neon,x,ground(x,z)+8.1,z,12);
  beacon.rotation.z=.17;
 }
 function makeCamp(){
  const x=-24,z=67;
  for(const [dx,dz] of [[-12,-7],[12,-7],[-12,8],[12,8]]){
   box(x+dx,z+dz,8,5,3.6,mat.concrete,0,true);
   box(x+dx,z+dz,8.4,5.5,.24,mat.steel,3.6);
   box(x+dx,z+dz+2.6,5,.2,1.2,mat.neon,1.5);
  }
  for(const [dx,dz] of [[-4,-4],[4,-3],[-4,4],[4,6]])box(x+dx,z+dz,2.3,2,1.5,mat.orange,0,true);
  world.cyl(.35,.45,9,mat.steel,x,ground(x,z)+4.5,z,9);
  const dish=world.geo(new THREE.TorusGeometry(3.2,.44,8,20),mat.trim,x,ground(x,z)+9.5,z);
  dish.rotation.x=.7;
  pole(x-20,z-16);pole(x+20,z+16);
  world.colliders.push({x,z,w:1.1,d:1.1,type:'structure'});
 }
 try{makeCompound();makeCamp();}catch(err){console.error('Map Reborn extension failed',err);}
 const newPlaces=[{name:'СТАЛЬНОЙ КВАРТАЛ',x:45,z:5},{name:'ЛАБОРАТОРИЯ СЕВЕР',x:-24,z:67}];
 if(Array.isArray(world.landmarks))world.landmarks.push(...newPlaces);
 const panel=document.createElement('div');
 panel.id='reborn-panel';
 panel.innerHTML='<div class="r-head"><strong>SKYFORGE REBORN</strong><button id="r-close">✕</button></div>'
  +'<p>Сохраняй стены, лестницы и другие постройки. Они останутся в этом браузере после закрытия игры.</p>'
  +'<div class="r-actions"><button id="r-save">СОХРАНИТЬ</button><button id="r-load">ЗАГРУЗИТЬ</button></div>'
  +'<div class="r-actions"><button id="r-clear">РАЗОБРАТЬ ВСЕ ПОСТРОЙКИ</button></div>'
  +'<div id="r-status">Сохранение только на этом устройстве</div>'
  +'<h3>КАЧЕСТВО ГРАФИКИ</h3><div class="r-actions"><button id="r-quality">ГРАФИКА: СБАЛАНСИРОВАННАЯ</button></div>';
 document.body.appendChild(panel);
 const open=()=>{panel.classList.add('shown');try{document.exitPointerLock?.()}catch{}};
 const close=()=>panel.classList.remove('shown');
 el('r-close').addEventListener('click',close);
 const settings=document.createElement('button');settings.type='button';settings.id='reborn-settings';settings.textContent='⚙ ПАРАМЕТРЫ';
 document.body.appendChild(settings);settings.addEventListener('click',open);
 const pause=el('paused')?.querySelector('.panel');
 if(pause){const b=document.createElement('button');b.textContent='⚙ ПАРАМЕТРЫ И СОХРАНЕНИЕ';b.className='secondary';pause.appendChild(b);b.addEventListener('click',open);}
 const notify=t=>{el('r-status').textContent=t;};
 const save=()=>{
  const pieces=world.builds.slice(0,240).map(b=>({type:b.type,mat:b.mat,x:b.x,z:b.z,angle:b.angle,level:b.level??0}));
  try{localStorage.setItem(saveKey,JSON.stringify({version:1,pieces}));notify('СОХРАНЕНО ПОСТРОЕК: '+pieces.length);return true}
  catch{notify('Не удалось сохранить: хранилище заблокировано');return false}
 };
 const load=()=>{
  let parsed=null;try{parsed=JSON.parse(localStorage.getItem(saveKey)||'null')}catch{}
  if(!Array.isArray(parsed?.pieces)){notify('Сохранение не найдено');return false}
  for(const b of [...world.builds])world.root.remove(b.root);
  world.builds.length=0;let n=0;
  for(const b of parsed.pieces.slice(0,240)){
   if(!types.has(b.type)||!materials.has(b.mat)||![b.x,b.z,b.angle,b.level??0].every(Number.isFinite))continue;
   if(Math.abs(b.x)>104||Math.abs(b.z)>104||b.level<0||b.level>5)continue;
   world.addBuild(b.type,b.x,b.z,b.angle,b.mat,b.level??0);n++;
  }
  notify('ЗАГРУЖЕНО ПОСТРОЕК: '+n);return true;
 };
 el('r-save').addEventListener('click',save);
 el('r-load').addEventListener('click',load);
 el('r-clear').addEventListener('click',()=>{
  for(const b of [...world.builds])world.root.remove(b.root);
  world.builds.length=0;notify('Постройки разобраны');
 });
 let quality='balanced';
 try{quality=localStorage.getItem(qualityKey)||'balanced'}catch{}
 function setQuality(q){
  quality=['low','balanced','high'].includes(q)?q:'balanced';
  renderer.setPixelRatio(quality==='low'?1:Math.min(devicePixelRatio,quality==='high'?1.65:1.28));
  renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.needsUpdate=true;
  el('r-quality').textContent='ГРАФИКА: '+({low:'БЫСТРАЯ',balanced:'СБАЛАНСИРОВАННАЯ',high:'ВЫСОКАЯ'}[quality]);
  try{localStorage.setItem(qualityKey,quality)}catch{}
 }
 el('r-quality').addEventListener('click',()=>setQuality({low:'balanced',balanced:'high',high:'low'}[quality]));
 setQuality(quality);
 document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save()}
  if(e.key==='Escape'&&panel.classList.contains('shown')){e.preventDefault();e.stopImmediatePropagation();close()}
 },true);
 const guide=document.createElement('div');guide.id='reborn-guide';
 guide.innerHTML='<b>Q</b> СТРОИТЬ　<b>1–4</b> ВЫБРАТЬ　<b>E</b> ПОВОРОТ　<b>Z</b> МАТЕРИАЛ　<b>C</b> ЭТАЖ　<b>Ctrl+S</b> СОХРАНИТЬ';
 el('ui')?.appendChild(guide);
 const brand=el('brand');if(brand)brand.innerHTML='SKY<b>FORGE</b><span>REBORN · BUILD & SURVIVE</span>';
 g.reborn={version:3,save,load,setQuality,open,get quality(){return quality},get locations(){return newPlaces},status:()=>({...g.status(),quality,sites:world.landmarks?.length??0})};
 console.info('SKYFORGE REBORN: saved builds, map, graphics loaded');
}
init();
