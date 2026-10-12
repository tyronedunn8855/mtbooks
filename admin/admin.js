/* Mili's Studio: orders, menu, pickup days and shop settings.
   Security lives in the database (Row Level Security in supabase/setup.sql), not in this file:
   only the owner email can read orders or change anything. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const money = c => '$' + (c % 100 ? (c / 100).toFixed(2) : c / 100);
  const show = id => ['v-signin', 'v-off', 'v-denied', 'v-app'].forEach(v => $('#' + v).hidden = v !== id);
  function toast(t) { const x = $('#toast'); x.textContent = t; x.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => x.classList.remove('on'), 2000); }

  const cfg = window.MT_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey || !window.supabase) return show('v-off');
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  const must = r => { if (r.error) throw r.error; return r.data; };
  const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); toast('Didn\'t save. Check your connection and try again.'); } };

  /* ---------- auth ---------- */
  $('#f-signin').addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target.email.value.trim(), msg = $('#signin-msg');
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/admin/', shouldCreateUser: false } });
    msg.textContent = error ? 'Couldn\'t send the link. Check the email and try again.' : 'Check your email for the sign-in link.';
  });
  $('#out').onclick = async () => { await sb.auth.signOut(); location.reload(); };

  async function start() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return show('v-signin');
    $('#out').hidden = false;
    const ok = await sb.rpc('is_owner');
    if (ok.error || ok.data !== true) return show('v-denied');
    show('v-app'); $('#tabbar').hidden = false;
    loadOrders(); loadMenu(); loadDays(); loadShop();
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN') start(); });

  /* ---------- tabs ---------- */
  $$('#tabbar button').forEach(b => b.onclick = () => {
    $$('#tabbar button').forEach(x => x.toggleAttribute('aria-current', x === b));
    b.setAttribute('aria-current', 'page');
    ['orders', 'menu', 'days', 'shop'].forEach(t => $('#t-' + t).hidden = t !== b.dataset.t);
    window.scrollTo(0, 0);
  });

  /* ---------- orders ---------- */
  let orders = [], filter = 'open';
  const STATUS = { new: 'New', making: 'Making it', ready: 'Ready', done: 'Done', cancelled: 'Cancelled' };
  const loadOrders = guard(async () => {
    orders = must(await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(300));
    renderOrders();
  });
  $('#refresh').onclick = loadOrders;
  $$('#o-filter button').forEach(b => b.onclick = () => { filter = b.dataset.f; $$('#o-filter button').forEach(x => x.setAttribute('aria-selected', x === b)); renderOrders(); });
  function renderOrders() {
    const open = o => o.status !== 'done' && o.status !== 'cancelled';
    const n = orders.filter(o => o.status === 'new').length, badge = $('#badge');
    badge.hidden = !n; badge.textContent = n;
    const list = orders.filter(o => filter === 'all' || (filter === 'open' ? open(o) : !open(o)));
    const box = $('#orders'); box.textContent = '';
    if (!list.length) return box.append(el('p', 'empty', filter === 'open' ? 'Nothing to do right now.' : 'No orders here yet.'));
    list.forEach(o => {
      const t = el('article', 'ticket' + (o.paid ? ' paid' : ''));
      const top = el('div', 't-top'); top.append(el('span', 't-name', o.name), el('span', 't-total', money(o.total_cents)));
      const when = new Date(o.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const meta = el('p', 't-meta');
      meta.append(el('span', 'pill ' + (o.paid ? 'ok' : 'no'), o.paid ? 'Paid' : 'Not paid'), el('span', 'pill', o.fulfil), document.createTextNode('Ordered ' + when));
      const items = el('div', 't-items');
      (o.items || []).forEach(i => { const r = el('div'); r.append(el('span', '', i.qty + ' × ' + i.name), el('span', '', money(i.qty * i.price_cents))); items.append(r); });
      t.append(top, meta, items);
      if (o.day) t.append(el('p', '', (o.fulfil === 'pickup' ? 'Pickup / needed by: ' : 'Needed by: ') + new Date(o.day + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })));
      if (o.address) t.append(el('p', '', 'Deliver to: ' + o.address));
      if (o.details) t.append(el('p', 't-details', o.details));
      const acts = el('div', 't-acts'), sel = el('select');
      sel.setAttribute('aria-label', 'Order status for ' + o.name);
      Object.entries(STATUS).forEach(([k, v]) => { const op = el('option', '', v); op.value = k; op.selected = o.status === k; sel.append(op); });
      sel.onchange = guard(async () => { must(await sb.from('orders').update({ status: sel.value }).eq('id', o.id).select()); o.status = sel.value; toast('Saved'); renderOrders(); });
      const phone = String(o.phone || '').replace(/[^\d+]/g, '');
      const txt = el('a', '', 'Text'); txt.href = 'sms:' + phone + '?&body=' + encodeURIComponent('Hi ' + o.name.split(' ')[0] + ', this is Mili from MT-THECREATOR about your order!');
      const call = el('a', '', 'Call'); call.href = 'tel:' + phone;
      acts.append(sel, txt, call);
      if (o.email) { const m = el('a', '', 'Email'); m.href = 'mailto:' + encodeURIComponent(o.email); acts.append(m); }
      t.append(acts); box.append(t);
    });
  }
  // new orders appear on their own every minute while the studio is open
  setInterval(() => { if (!$('#v-app').hidden && document.visibilityState === 'visible') loadOrders(); }, 60000);

  /* ---------- menu ---------- */
  let menu = [];
  const CATS = { paper: 'Design & print', media: 'Photo & video', treat: 'Sweet treat' };
  const loadMenu = guard(async () => { menu = must(await sb.from('products').select('*').order('sort')); renderMenu(); });
  function renderMenu() {
    const box = $('#menu'); box.textContent = '';
    menu.forEach(p => {
      const f = el('form', 'item' + (p.active ? '' : ' off'));
      const name = el('label', '', 'Name'), price = el('label', '', 'Price $'), note = el('label', 'full', 'Note'), cat = el('label', 'full', 'Category');
      const ni = el('input'); ni.value = p.name; ni.maxLength = 60; ni.required = true; name.append(ni);
      const pi = el('input'); pi.type = 'number'; pi.min = '0.5'; pi.max = '1000'; pi.step = '0.5'; pi.inputMode = 'decimal'; pi.value = p.price_cents / 100; pi.required = true; price.append(pi);
      const no = el('input'); no.value = p.note || ''; no.maxLength = 80; note.append(no);
      const cs = el('select'); Object.entries(CATS).forEach(([k, v]) => { const o = el('option', '', v); o.value = k; o.selected = p.cat === k; cs.append(o); }); cat.append(cs);
      const row = el('div', 'row'), sw = el('label', 'switch'), on = el('input'); on.type = 'checkbox'; on.checked = p.active; sw.append(on, el('span', '', 'On the site'));
      const save = el('button', 'pink', 'Save'); save.type = 'submit';
      row.append(sw, save);
      f.append(name, price, note, cat, row);
      f.onsubmit = guard(async e => {
        e.preventDefault();
        const cents = Math.round(parseFloat(pi.value) * 100);
        if (!ni.value.trim() || !(cents >= 50 && cents <= 100000)) return toast('Check the name and price.');
        must(await sb.from('products').update({ name: ni.value.trim(), note: no.value.trim(), price_cents: cents, cat: cs.value, active: on.checked }).eq('id', p.id).select());
        Object.assign(p, { name: ni.value.trim(), note: no.value.trim(), price_cents: cents, cat: cs.value, active: on.checked });
        toast('Saved'); renderMenu();
      });
      box.append(f);
    });
  }
  $('#m-new').onclick = guard(async () => {
    const id = 'item-' + Date.now().toString(36);
    const row = must(await sb.from('products').insert({ id, cat: 'paper', name: 'New item', price_cents: 1000, active: false, sort: menu.length + 1 }).select());
    menu.push(row[0]); renderMenu(); toast('Added. Fill it in, switch it on and save.');
  });

  /* ---------- pickup days ---------- */
  let open = new Set(), month = new Date(); month.setDate(1);
  const iso = d => d.toLocaleDateString('en-CA');
  const loadDays = guard(async () => { open = new Set(must(await sb.from('open_days').select('day')).map(d => d.day)); renderCal(); });
  function renderCal() {
    $('#cal-title').textContent = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const cal = $('#cal'); cal.textContent = '';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => cal.append(el('span', 'dow', d)));
    for (let i = 0; i < month.getDay(); i++) cal.append(el('span'));
    const today = iso(new Date()), last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const day = iso(new Date(month.getFullYear(), month.getMonth(), d)), b = el('button', '', d);
      b.type = 'button'; b.disabled = day < today; b.setAttribute('aria-pressed', open.has(day));
      b.setAttribute('aria-label', new Date(day + 'T12:00').toDateString() + (open.has(day) ? ', open' : ', closed'));
      b.onclick = guard(async () => {
        if (open.has(day)) { must(await sb.from('open_days').delete().eq('day', day).select()); open.delete(day); toast('Closed ' + day); }
        else { must(await sb.from('open_days').insert({ day }).select()); open.add(day); toast('Opened ' + day); }
        renderCal();
      });
      cal.append(b);
    }
  }
  $('#cal-prev').onclick = () => { month.setMonth(month.getMonth() - 1); renderCal(); };
  $('#cal-next').onclick = () => { month.setMonth(month.getMonth() + 1); renderCal(); };

  /* ---------- shop settings ---------- */
  let shop = {};
  const loadShop = guard(async () => {
    const r = must(await sb.from('settings').select('v').eq('k', 'shop'));
    shop = (r[0] && r[0].v) || {};
    const f = $('#f-shop');
    f.open.checked = shop.open !== false; f.banner.value = shop.banner || ''; f.fee.value = (shop.delivery_fee_cents || 0) / 100;
    f.phone.value = shop.phone || ''; f.instagram.value = shop.instagram || '';
  });
  $('#f-shop').addEventListener('submit', guard(async e => {
    e.preventDefault();
    const f = e.target, fee = Math.round((parseFloat(f.fee.value) || 0) * 100);
    if (fee < 0 || fee > 20000) return toast('Check the delivery fee.');
    const v = Object.assign({}, shop, { open: f.open.checked, banner: f.banner.value.trim(), delivery_fee_cents: fee, phone: f.phone.value.trim(), instagram: f.instagram.value.trim().replace(/^@/, '').replace(/[^\w.]/g, '') });
    must(await sb.from('settings').upsert({ k: 'shop', v }).select());
    shop = v; toast('Saved');
  }));

  start();
})();
