const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  for (const r of ['eiche', 'tanne', 'buche', 'robinie', 'kiefer']) {
    await p.goto(`http://localhost:8765/dist/holzmappe.html?start=life&r=${r}&frames=1&q=low`);
    await p.waitForFunction(() => window.__app && window.__app.life, null, { timeout: 120000 });
    const out = await p.evaluate(() => {
      const w = window.__app.life, log = []; let last = '';
      w.start();
      for (let i = 0; i < 4000; i++) { w.update(0.05, i * 0.05); const ph = w.phase(); if (ph !== last) { log.push(ph + '@' + (i * 0.05).toFixed(1) + 's'); last = ph; } if (ph === 'life' && w.age() > 900) break; }
      return log.join(' → ') + ' | Endalter ' + Math.round(w.age()) + ' | Anzeige ' + document.querySelector('#lr-stage').textContent + ' | Endnote sichtbar ' + !document.querySelector('.life-endnote').hidden;
    });
    console.log(r.padEnd(8), out);
  }
  console.log('ERRORS:', errs.join('\n') || 'keine');
  await b.close();
})();
