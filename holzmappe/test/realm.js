import * as THREE from 'three';
import { Engine } from '../src/engine.js';
import { buildRealm } from '../src/realms.js';
const P = new URLSearchParams(location.search); const id = P.get('r') || 'kiefer';
const eng = new Engine(); eng.mount(document.getElementById('c'));
buildRealm(id, eng).then(w => {
  eng.setWorld(w);
  if (P.get('st') != null) { w.focus(+P.get('st')); eng.cam.fly.dur = 0.001; }
  window.__ready = true; }).catch(e => console.error('BUILD', e.stack));
