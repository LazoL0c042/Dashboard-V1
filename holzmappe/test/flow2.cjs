const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2], B = 'http://localhost:8765/dist/holzmappe.html';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 860, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  // Nahansicht: Reich öffnen, Station 0 anfahren, weiter blättern
  await p.goto(B + '?start=realm&r=eiche&q=low'); await p.waitForTimeout(25000);
  await p.evaluate(() => window.__app.engine.world.focus(5)); await p.waitForTimeout(9000);
  console.log('station card:', await p.evaluate(() => document.querySelector('.st-card h3')?.textContent), '| hidden:', await p.evaluate(() => document.querySelector('.st-card').hidden));
  await p.screenshot({ path: S + '/g-station.png', timeout: 180000 });
  await p.click('.st-next'); await p.waitForTimeout(6000);
  console.log('next station:', await p.evaluate(() => document.querySelector('.st-card h3')?.textContent));
  await p.click('.st-over'); await p.waitForTimeout(3000);
  console.log('overview hidden card:', await p.evaluate(() => document.querySelector('.st-card').hidden));
  // Lebenslauf über den Knopf
  await p.click('#map-nav .life-btn'); await p.waitForTimeout(25000);
  console.log('life phase:', await p.evaluate(() => document.querySelector('#life').dataset.phase));
  await p.click('#life-go'); await p.waitForTimeout(40000);
  console.log('after start phase:', await p.evaluate(() => document.querySelector('#life').dataset.phase), 'age:', await p.evaluate(() => document.querySelector('#lr-age').textContent));
  await p.screenshot({ path: S + '/g-life.png', timeout: 180000 });
  // Regler ziehen
  await p.evaluate(() => { const r = document.querySelector('#life-range'); r.value = 700; r.dispatchEvent(new Event('input')); }); await p.waitForTimeout(8000);
  console.log('slider → age:', await p.evaluate(() => document.querySelector('#lr-age').textContent), 'stage:', await p.evaluate(() => document.querySelector('#lr-stage').textContent));
  await p.screenshot({ path: S + '/g-life2.png', timeout: 180000 });
  await p.click('#life-back'); await p.waitForTimeout(25000);
  console.log('back to realm:', await p.evaluate(() => window.__app.current), 'life hidden:', await p.evaluate(() => document.querySelector('#life').hidden));
  console.log('ERRORS:\n' + errs.join('\n'));
  await b.close();
})();
