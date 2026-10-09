import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
export async function attachCombatSoldier(player){
 try{
  const data=await new GLTFLoader().loadAsync('/assets/soldier_ct.glb');
  const rig=data.scene;rig.scale.setScalar(1.86/2.2699);rig.rotation.y=Math.PI;
  rig.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});
  for(const c of player.characterGroup.children)c.visible=false;
  player.characterGroup.add(rig);
  const mixer=new THREE.AnimationMixer(rig),acts=new Map();
  for(const clip of data.animations){const k=clip.name.split('|').pop().toLowerCase();acts.set(k,mixer.clipAction(clip));}
  let current='';
  function update(dt){
    const pace=player.velocity.lengthSq();
    let action=pace<.25?'idle':player.isSprinting?'run_gun':'walk';
    if(!acts.has(action))action=acts.has('walk')?'walk':'idle';
    if(current!==action){
      acts.get(current)?.fadeOut(.12);
      const target=acts.get(action);target?.reset().fadeIn(.12).play();
      current=action;
    }
    mixer.update(dt);
  }
  return update;
 }catch(err){console.warn('3D soldier model fallback',err);return ()=>{};}
}
