import * as THREE from 'three';
import { Engine } from '../src/engine.js';
import { buildRealm } from '../src/realms.js';
const P = new URLSearchParams(location.search); const id = P.get('r') || 'kiefer';
const eng = new Engine(); eng.mount(document.getElementById('c'));
buildRealm(id, eng).then(w => {
  if (P.get('close')) { const p = new THREE.Vector3(); w.pick[0].getWorldPosition(p); w.rig.pos = p.clone().add(new THREE.Vector3(-1.2, 1.8, 4)); w.rig.target = p.clone().add(new THREE.Vector3(0, 1.8, 0)); }
  eng.setWorld(w); window.__ready = true; }).catch(e => console.error('BUILD', e.stack));
