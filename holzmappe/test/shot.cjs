const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2], out = process.argv[3], wait = +(process.argv[4] || 6000);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 400)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  const t0 = Date.now();
  await p.goto(url);
  await p.waitForFunction(() => window.__frames, null, { timeout: wait, polling: 500 }).catch(()=>console.log("no __frames"));
  await p.screenshot({ path: out });
  console.log('time', Date.now() - t0, 'ms');
  console.log(errs.slice(0, 15).join('\n'));
  await b.close();
})();
