/* MT-THECREATOR storefront: menu, bag, checkout and motion. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const money = c => '$' + (c % 100 ? (c / 100).toFixed(2) : c / 100);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // Built-in menu: shown if the database can't be reached. Keep in sync with supabase/setup.sql.
  let MENU = [
    ['itinerary', 'paper', 'Itinerary', '', 2500], ['poster', 'paper', 'Poster', '', 2500], ['flyer', 'paper', 'Flyer', '', 1500],
    ['card', 'paper', 'Card', '', 1500], ['invite', 'paper', 'Custom invitation', '', 1500], ['bizcard', 'paper', 'Business cards', '', 1500],
    ['pfp', 'paper', 'Business profile picture', '', 1000], ['photo-edit', 'media', 'Photo editing', 'Your photos, edited', 1000],
    ['photo-shoot', 'media', 'Photo shoot + editing', 'Taken and edited by Mili', 1500], ['yt', 'media', 'YouTube intro / outro', '', 3000],
    ['cookie-1', 'treat', 'Cookie', 'Single', 200], ['cookie-3', 'treat', 'Cookies, 3 pack', '', 500],
    ['milly-dozen', 'treat', 'Milly Dozen', '13 cookies', 1500], ['loaf', 'treat', 'Mini loaf cake', '', 500]
  ].map(([id, cat, name, note, price_cents], sort) => ({ id, cat, name, note, price_cents, sort, active: true }));
  let SHOP = { open: true, banner: '', delivery_fee_cents: 0, phone: '', instagram: 'mtthecreator_' };
  let DAYS = [];
  const CAT = { paper: 'Design & print', media: 'Photo & video', treat: 'Sweet treat' };

  /* ---------- data ---------- */
  const cfg = window.MT_SUPABASE || {};
  async function q(path) {
    const r = await fetch(cfg.url.replace(/\/+$/, '') + '/rest/v1/' + path, { headers: { apikey: cfg.anonKey } });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function load() {
    if (!cfg.url || !cfg.anonKey) return;
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const [p, d, s] = await Promise.all([q('products?select=*&order=sort'), q('open_days?select=day,note&order=day&day=gte.' + today), q('settings?k=eq.shop&select=v')]);
      if (p.length) MENU = p;
      DAYS = d;
      if (s[0]) SHOP = Object.assign(SHOP, s[0].v);
    } catch (e) { console.warn('Using built-in menu', e); }
  }

  /* ---------- shop grid ---------- */
  let cat = 'all';
  function renderGrid() {
    const g = $('#grid'); g.textContent = '';
    MENU.filter(p => p.active && (cat === 'all' || p.cat === cat)).forEach(p => {
      const c = el('article', 'card');
      c.append(el('p', 'mono k', CAT[p.cat]), el('h3', '', p.name), el('p', 'note', p.note || ''));
      const row = el('div', 'row'), b = el('button', 'add', SHOP.open === false ? 'Closed' : 'Add to bag');
      b.type = 'button'; b.disabled = SHOP.open === false;
      b.setAttribute('aria-label', 'Add ' + p.name + ' to bag');
      b.onclick = () => { add(p.id); b.classList.add('done'); b.textContent = 'Added'; setTimeout(() => { b.classList.remove('done'); b.textContent = 'Add to bag'; }, 1200); };
      row.append(el('span', 'price', money(p.price_cents)), b);
      c.append(row); g.append(c);
    });
  }
  $$('.tabs button').forEach(t => t.onclick = () => {
    cat = t.dataset.cat;
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', x === t));
    renderGrid();
  });

  /* ---------- bag ---------- */
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem('mt-bag')) || []; } catch (e) {}
  const save = () => { try { localStorage.setItem('mt-bag', JSON.stringify(bag)); } catch (e) {} renderBag(); };
  const find = id => MENU.find(p => p.id === id && p.active);
  function add(id) {
    const l = bag.find(x => x.id === id);
    if (l) l.qty = Math.min(50, l.qty + 1); else bag.push({ id, qty: 1 });
    save(); toast('Added to your bag');
  }
  function renderBag() {
    bag = bag.filter(l => find(l.id));
    const n = bag.reduce((s, l) => s + l.qty, 0);
    $('#bag-n').textContent = n;
    const box = $('#lines'); box.textContent = '';
    if (!n) { box.append(el('p', 'empty', 'Your bag is empty.')); $('#co').hidden = $('#total-row').hidden = true; return; }
    bag.forEach(l => {
      const p = find(l.id), row = el('div', 'line'), nm = el('div', 'nm', p.name);
      nm.append(el('small', '', money(p.price_cents) + ' each'));
      const qy = el('div', 'qty'), minus = el('button', '', '−'), plus = el('button', '', '+');
      minus.type = plus.type = 'button';
      minus.setAttribute('aria-label', 'One less ' + p.name); plus.setAttribute('aria-label', 'One more ' + p.name);
      minus.onclick = () => { l.qty--; if (!l.qty) bag = bag.filter(x => x !== l); save(); };
      plus.onclick = () => { l.qty = Math.min(50, l.qty + 1); save(); };
      qy.append(minus, el('span', '', l.qty), plus);
      row.append(nm, qy, el('span', 'lp', money(l.qty * p.price_cents)));
      box.append(row);
    });
    $('#co').hidden = $('#total-row').hidden = false;
    syncFulfil();
  }
  function totalCents() {
    let t = bag.reduce((s, l) => s + l.qty * find(l.id).price_cents, 0);
    if (fulfil() === 'delivery') t += +SHOP.delivery_fee_cents || 0;
    return t;
  }
  const fulfil = () => ($('input[name=fulfil]:checked') || {}).value;
  const hasTreat = () => bag.some(l => find(l.id).cat === 'treat');
  let pickDay = '';
  function syncFulfil() {
    const treat = hasTreat(), d = $('#deliv-opt input');
    d.disabled = treat;
    if (treat && d.checked) $('input[value=pickup]').checked = true;
    const fee = +SHOP.delivery_fee_cents || 0;
    $('#fulfil-hint').textContent = treat ? 'Treats are pickup only for now.' : (fee ? 'Delivery adds ' + money(fee) + '.' : 'Mili will confirm delivery details by text.');
    $('#addr-wrap').hidden = fulfil() !== 'delivery';
    $('#day-wrap').hidden = !treat;
    $('#date-wrap').hidden = treat;
    const days = $('#days'); days.textContent = '';
    if (treat && !DAYS.length) days.append(el('span', 'hint', 'No pickup days are open right now. Text or DM Mili to plan your treats.'));
    DAYS.forEach(d => {
      const b = el('button', '', new Date(d.day + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
      b.type = 'button'; b.setAttribute('aria-pressed', d.day === pickDay);
      if (d.note) b.title = d.note;
      b.onclick = () => { pickDay = d.day; syncFulfil(); };
      days.append(b);
    });
    $('#total').textContent = money(totalCents());
  }
  $$('input[name=fulfil]').forEach(r => r.onchange = syncFulfil);

  /* drawer */
  const drawer = $('#drawer'), scrim = $('#scrim');
  let lastFocus;
  function openBag() {
    lastFocus = document.activeElement;
    drawer.classList.add('on'); scrim.classList.add('on'); drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lock'); lenis && lenis.stop();
    $('#bag-close').focus();
  }
  function closeBag() {
    drawer.classList.remove('on'); scrim.classList.remove('on'); drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lock'); lenis && lenis.start();
    lastFocus && lastFocus.focus();
  }
  $('#bag-open').onclick = openBag; $('#bag-close').onclick = closeBag; scrim.onclick = closeBag;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('on')) closeBag(); });

  /* checkout */
  $('#co').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, err = $('#co-err'), pay = $('#pay');
    const v = n => f.elements[n].value.trim();
    err.textContent = '';
    if (v('name').length < 2) return fail('Please enter your name.', 'name');
    if (v('phone').replace(/\D/g, '').length < 10) return fail('Please enter a phone number Mili can text.', 'phone');
    if (v('email') && !f.elements.email.checkValidity()) return fail('That email doesn\'t look right.', 'email');
    if (fulfil() === 'delivery' && v('address').length < 6) return fail('Please enter the delivery address.', 'address');
    if (hasTreat() && !pickDay) return fail('Please pick a pickup day for your treats.');
    pay.disabled = true; pay.textContent = 'Opening checkout…';
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: v('name'), phone: v('phone'), email: v('email'), fulfil: fulfil(), address: v('address'),
          day: hasTreat() ? pickDay : v('needby'), details: v('details'), website: v('website'), items: bag
        })
      });
      const out = await r.json().catch(() => ({}));
      if (r.ok && out.url) { location.href = out.url; return; }
      if (r.status === 503 || r.status === 404 || out.error === 'not_connected')
        return fail('Online payment isn\'t switched on yet. Please DM or text Mili to place this order.');
      fail(out.error || 'Checkout failed. Please try again.');
    } catch (x) { fail('Couldn\'t reach checkout. Check your connection and try again.'); }
    function fail(msg, field) { err.textContent = msg; pay.disabled = false; pay.textContent = 'Pay securely'; if (field) f.elements[field].focus(); }
  });

  /* return from Stripe */
  const qs = new URLSearchParams(location.search), flash = $('#flash');
  if (qs.has('paid')) { flash.hidden = false; flash.textContent = 'Thank you! Your payment went through. Mili will text you to confirm your order.'; bag = []; save(); }
  else if (qs.has('cancelled')) { flash.hidden = false; flash.textContent = 'Checkout was cancelled. Your bag is still saved.'; }
  if (qs.has('paid') || qs.has('cancelled')) history.replaceState(null, '', location.pathname + location.hash);

  /* misc */
  function toast(t) { const x = $('#toast'); x.textContent = t; x.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => x.classList.remove('on'), 1800); }
  $('#yr').textContent = new Date().getFullYear();
  const mt = $('#menu-tg'), links = $('#links');
  mt.onclick = () => { const o = links.classList.toggle('open'); mt.setAttribute('aria-expanded', o); };
  links.onclick = e => { if (e.target.tagName === 'A') { links.classList.remove('open'); mt.setAttribute('aria-expanded', false); } };
  const mtg = $('#motion-tg');
  mtg.textContent = window.__rm ? 'Turn motion on' : 'Turn motion off';
  mtg.onclick = () => { try { localStorage.setItem('mt-motion', window.__rm ? 'on' : 'off'); } catch (e) {} location.reload(); };

  function applyShop() {
    const b = $('#banner');
    if (SHOP.open === false) { b.hidden = false; b.textContent = SHOP.banner || 'Mili is not taking new orders right now. Check back soon.'; }
    else if (SHOP.banner) { b.hidden = false; b.textContent = SHOP.banner; }
    if (SHOP.instagram) { const ig = $('#ig-link'); ig.href = 'https://instagram.com/' + encodeURIComponent(SHOP.instagram); ig.textContent = 'DM @' + SHOP.instagram; }
    if (SHOP.phone) { const t = $('#text-link'); t.hidden = false; t.href = 'sms:' + String(SHOP.phone).replace(/[^\d+]/g, ''); }
    const loaf = find('loaf'); if (loaf) $('#tag-price').textContent = money(loaf.price_cents) + ' each';
  }

  /* gallery video plays only on screen */
  const vio = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.isIntersecting && !window.__rm) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }), { threshold: .3 });
  $$('video[data-autoplay]').forEach(v => vio.observe(v));

  /* ---------- motion ---------- */
  let lenis = null;
  function loader() {
    const ld = $('#loader');
    if (window.__rm) return Promise.resolve();
    window.scrollTo(0, 0);
    const imgs = $$('img').slice(0, 4), jobs = [document.fonts ? document.fonts.ready : Promise.resolve(), ...imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))];
    let done = 0;
    const tick = () => { done++; const p = Math.round(done / jobs.length * 100); $('#ld-i').style.width = p + '%'; $('#ld-p').textContent = p + '%'; };
    return Promise.race([Promise.all(jobs.map(j => Promise.resolve(j).then(tick))), new Promise(r => setTimeout(r, 6000))])
      .then(() => new Promise(r => setTimeout(r, 250)))
      .then(() => {
        if (!window.gsap) { ld.remove(); return; }
        return new Promise(r => gsap.to(ld, { clipPath: 'polygon(0 0,100% 0,100% 0,0 0)', duration: .9, ease: 'power3.inOut', onComplete: () => { ld.remove(); r(); } }));
      });
  }
  function motion() {
    if (window.__rm || !window.gsap || !window.ScrollTrigger) { $$('[data-rv]').forEach(e => e.removeAttribute('data-rv')); return; }
    gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis) {
      lenis = new Lenis({ lerp: .1 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const t = a.getAttribute('href'); if (t.length > 1 && $(t)) { e.preventDefault(); lenis.scrollTo(t, { offset: -70 }); } }));
    }
    // hero: staged lines, then copy
    gsap.from('.hero h1 .ln>span', { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: .14 });
    gsap.from('[data-hero]', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: .1, delay: .35 });
    gsap.from('#hero-frame', { rotate: 9, scale: .92, duration: 1.4, ease: 'power3.out', delay: .2 });
    gsap.to('#hero-frame img', { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    // reveals
    ScrollTrigger.batch('[data-rv]', { start: 'top 88%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .08 }) });
    // statement: words light up as you scroll (scrubbed)
    const p = $('#stmt'), parts = [];
    p.childNodes.forEach(n => {
      const pk = n.nodeType === 1;
      n.textContent.split(/(\s+)/).forEach(w => { if (!w.trim()) parts.push(document.createTextNode(w)); else { const s = el('span', 'w' + (pk ? ' pk' : ''), w); parts.push(s); } });
    });
    p.textContent = ''; parts.forEach(n => p.append(n));
    const words = $$('.w', p);
    ScrollTrigger.create({ trigger: '.statement', start: 'top 75%', end: 'bottom 55%', scrub: true,
      onUpdate: s => { const k = Math.round(s.progress * words.length); words.forEach((w, i) => w.classList.toggle('on', i < k)); } });
    // grid cards cascade each time the grid is redrawn
    new MutationObserver(() => gsap.from('#grid .card', { y: 24, opacity: 0, duration: .6, ease: 'power3.out', stagger: .04 })).observe($('#grid'), { childList: true });
  }

  /* boot */
  renderGrid(); renderBag();
  const scripts = new Promise(r => window.addEventListener('load', r));
  Promise.all([load(), scripts]).then(() => { renderGrid(); renderBag(); applyShop(); return loader(); }).then(motion);
})();
