const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2], B = 'http://localhost:8765/dist/holzmappe.html';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  // 1) Buch: TOC → Szene → Detail
  await p.goto(B + '?start=buch&p=0&q=low');
  await p.waitForTimeout(3000);
  await p.click('.bn-next'); await p.waitForTimeout(25000);
  console.log('page after 1 flip:', await p.evaluate(() => window.__app.page), 'pages in DOM:', await p.evaluate(() => document.querySelectorAll('#leaves .page').length));
  await p.screenshot({ path: S + '/f-book2.png' });
  await p.click('.bn-next'); await p.waitForTimeout(6000);
  console.log('page after 2 flips:', await p.evaluate(() => window.__app.page));
  await p.click('.bn-prev'); await p.waitForTimeout(25000);
  console.log('page after back:', await p.evaluate(() => window.__app.page), 'canvas in page:', await p.evaluate(() => !!document.querySelector('#leaves .pg-canvas canvas')));
  // 2) Prolog → Buch antippen → Auswahl
  await p.goto(B + '?q=low'); await p.waitForTimeout(12000);
  await p.evaluate(() => window.__app.engine.world.onPick('buch'));
  await p.waitForTimeout(9000);
  console.log('chooser visible:', await p.evaluate(() => document.querySelector('#chooser').classList.contains('on')));
  await p.screenshot({ path: S + '/f-chooser.png' });
  // 3) Karte → Reich betreten → Kompass zurück
  await p.click('[data-mode=karte]'); await p.waitForTimeout(20000);
  await p.evaluate(() => document.querySelectorAll('.map-label')[0].click()); await p.waitForTimeout(30000);
  console.log('current realm:', await p.evaluate(() => window.__app.current), 'title:', await p.evaluate(() => document.querySelector('#realm-title b')?.textContent));
  await p.screenshot({ path: S + '/f-realm.png' });
  console.log('ERRORS:\n' + errs.join('\n'));
  await b.close();
})();
