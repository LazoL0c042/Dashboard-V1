import * as THREE from 'three';
import { Engine } from '../src/engine.js';
import { rng } from '../src/util.js';
import { makeSky, makeTerrain, makeRidges, makeGrass, makeLights, makeMist, makeShafts, makeParticles } from '../src/env.js';
import { makeTree, makeFruits, makeForest } from '../src/tree.js';
const id = new URLSearchParams(location.search).get('t') || 'kiefer';
const eng = new Engine(); eng.mount(document.getElementById('c'));
const p = { skyTop:'#4a6a8f', skyHorizon:'#f0c68a', sunDir:new THREE.Vector3(-0.6,0.35,-1), sunColor:'#ffb860', sunIntensity:3.2, ground:['#6b6a3a','#8a7a48','#5a5a3a'], groundTex:['#7a6a45','#9a8a5a','#5a5236'], grass:['#7d8a45','#b0a050'], fog:'#e3b07a', ridgeColor:'#3a3a35', treeline:'conifer', hemi:0.5 };
const scene = new THREE.Scene(); const r = rng(3);
scene.fog = new THREE.FogExp2(p.fog, 0.008);
const sky = makeSky(p); scene.add(sky);
const skyScene = new THREE.Scene(); skyScene.add(makeSky(p)); scene.environment = eng.envFromScene(skyScene);
const ter = makeTerrain(p, r); scene.add(ter); scene.add(makeRidges(p, r));
const t = makeTree(id, { seed: 2 }); t.group.position.set(0, 0, -8); scene.add(t.group);
const fr = makeFruits(id, t.tips); if (fr) { fr.position.copy(t.group.position); scene.add(fr); }
const fpos=[]; for(let i=0;i<30;i++){ const a=r()*6.28, d=r.range(25,60); const x=Math.cos(a)*d, z=-Math.abs(Math.sin(a)*d)-10; fpos.push(new THREE.Vector3(x, ter.userData.height(x,z), z)); }
scene.add(makeForest(id, fpos));
const gr = makeGrass(p, ter, eng.q.density, r); if (gr) scene.add(gr);
makeLights(p, scene, eng.q);
const mist = makeMist(p, 4, r); scene.add(mist); const sh = makeShafts(p, r, { origin: new THREE.Vector3(0,20,-8)}); scene.add(sh);
scene.add(makeParticles('rise', '#ffb050', 120, [-8,8,0,10,-14,2]));
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200);
eng.setWorld({ scene, camera, rig: { pos: new THREE.Vector3(0, 3, 14), target: new THREE.Vector3(0, 7, -6), dur: 0 }, post: { tint: '#ffd9a0', tintAmt: 0.2, focus: 22, dof: 0.6 }, update(dt,t){ mist.userData.update(dt); sh.userData.update(dt,t);} });
window.__ready = true;
