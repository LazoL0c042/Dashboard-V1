import { makeSign } from '../src/props.js';
import { HOLZ_BY_ID } from '../src/data.js';
(async () => {
  const g = await makeSign('kiefer', HOLZ_BY_ID.kiefer);
  let tex; g.traverse(o => { if (o.material && Array.isArray(o.material)) tex = o.material[4].map; });
  const img = tex.image; img.style.width = '900px'; document.body.appendChild(img);
  window.__frames = 1;
})();
