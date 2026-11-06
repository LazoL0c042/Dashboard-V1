const { chromium } = require('playwright');
(async () => {
  const [url, out, js, wait] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto(url); await p.waitForTimeout(+(wait || 8000));
  if (js) { await p.evaluate(js); await p.waitForTimeout(1500); }
  await p.screenshot({ path: out }); console.log(errs.join('\n')); await b.close();
})();
