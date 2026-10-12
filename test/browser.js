const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.xml': 'text/xml', '.txt': 'text/plain' };
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, u);
  if (u.startsWith('/api/')) { r.writeHead(503, { 'Content-Type': 'application/json' }); return r.end('{"error":"not_connected"}'); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(fs.readFileSync(path.join(ROOT, '404.html'))); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(5077);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [name, vp, rm] of [['desktop', { width: 1440, height: 900 }, 'no-preference'], ['phone', { width: 390, height: 844 }, 'reduce']]) {
    const ctx = await b.newContext({ viewport: vp, reducedMotion: rm, isMobile: name === 'phone', hasTouch: name === 'phone' });
    const pg = await ctx.newPage(), errs = [], bad = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
    pg.on('response', r => r.status() >= 400 && !r.url().includes('/api/') && bad.push(r.status() + ' ' + r.url()));
    await pg.goto('http://localhost:5077/');
    const loaderSeen = await pg.locator('#loader').isVisible().catch(() => false);
    await pg.waitForSelector('#loader', { state: 'detached', timeout: 10000 });
    await pg.screenshot({ path: `C:/Users/nxtve/AppData/Local/Temp/mt2-${name}-hero.png` });
    const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const cards = await pg.locator('#grid .card').count();
    // scroll through to trigger reveals
    for (let y = 0; y < 30; y++) { await pg.evaluate(() => scrollBy(0, 400)); await pg.waitForTimeout(150); }
    const hidden = await pg.evaluate(() => [...document.querySelectorAll('[data-rv]')].filter(e => getComputedStyle(e).opacity < .5).length);
    const lit = await pg.locator('.statement .w.on').count();
    // tabs + add to bag
    await pg.evaluate(() => scrollTo(0, document.getElementById('shop').offsetTop));
    await pg.click('.tabs button[data-cat=treat]');
    await pg.waitForTimeout(800);
    const treatCards = await pg.locator('#grid .card').count();
    await pg.click('#grid .card:first-child .add');
    await pg.click('.tabs button[data-cat=paper]'); await pg.waitForTimeout(800);
    await pg.click('#grid .card:first-child .add');
    const bagN = await pg.textContent('#bag-n');
    await pg.click('#bag-open'); await pg.waitForTimeout(600);
    await pg.click('#pay');
    const e1 = await pg.textContent('#co-err');
    await pg.fill('[name=name]', 'Test Person'); await pg.fill('[name=phone]', '4145550100');
    await pg.click('#pay');
    const e2 = await pg.textContent('#co-err');
    const delivDisabled = await pg.isDisabled('#deliv-opt input');
    await pg.screenshot({ path: `C:/Users/nxtve/AppData/Local/Temp/mt2-${name}-bag.png` });
    await pg.keyboard.press('Escape');
    const total = await pg.textContent('#total');
    console.log(name, JSON.stringify({ loaderSeen, overflow, cards, treatCards, hidden, lit, bagN, total, e1, e2, delivDisabled, errs, bad }));
    await pg.goto('http://localhost:5077/');
    await pg.waitForSelector('#loader', { state: 'detached', timeout: 10000 });
    await pg.screenshot({ path: `C:/Users/nxtve/AppData/Local/Temp/mt2-${name}-full.png`, fullPage: true });
    await ctx.close();
  }
  // motion toggle + admin + 404
  const pg = await b.newPage();
  await pg.goto('http://localhost:5077/'); await pg.waitForSelector('#loader', { state: 'detached' });
  await pg.click('#motion-tg'); await pg.waitForLoadState('load');
  console.log('after toggle: html.rm =', await pg.evaluate(() => document.documentElement.classList.contains('rm')), 'button =', await pg.textContent('#motion-tg'));
  await pg.click('#motion-tg'); await pg.waitForLoadState('load');
  await pg.goto('http://localhost:5077/admin/'); await pg.waitForTimeout(800);
  console.log('admin shows:', await pg.locator('main section:visible h1').first().textContent());
  await pg.screenshot({ path: 'C:/Users/nxtve/AppData/Local/Temp/mt2-admin.png' });
  await pg.goto('http://localhost:5077/nope'); console.log('404 title:', await pg.title());
  for (const u of ['privacy.html', 'terms.html']) { await pg.goto('http://localhost:5077/' + u); console.log(u, await pg.title()); }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
