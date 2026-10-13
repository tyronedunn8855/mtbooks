// Creates an order and a Stripe Checkout page for it. Prices always come from the database, never from the browser.
// Env vars (Vercel only): STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL (e.g. https://mtthecreator.vercel.app).
const sb = require('./_sb');

const hits = new Map(); // ponytail: per-instance rate limit; use Upstash if abuse shows up
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); hits.set(ip, list);
  return list.length > 8;
}
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Pure check of the order against the menu. Returns {error} or {order, lines}.
function build(body, products, openDays, shop, today) {
  if (!shop || shop.open === false) return { error: 'Milly is not taking orders right now.' };
  if (clean(body.website, 100)) return { error: 'spam' }; // honeypot
  const name = clean(body.name, 80), phone = clean(body.phone, 20).replace(/[^\d+]/g, ''), email = clean(body.email, 120);
  if (name.length < 2) return { error: 'Please enter your name.' };
  if (phone.replace(/\D/g, '').length < 10) return { error: 'Please enter a phone number Milly can text.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email doesn\'t look right.' };
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 30) return { error: 'Your bag is empty.' };
  const byId = new Map(products.filter(p => p.active).map(p => [p.id, p]));
  const lines = [];
  for (const it of body.items) {
    const p = byId.get(String(it && it.id)), qty = Number(it && it.qty);
    if (!p) return { error: 'Something in your bag is no longer on the menu. Please refresh.' };
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { error: 'Please check the amounts in your bag.' };
    lines.push({ id: p.id, name: p.name, qty, price_cents: p.price_cents, cat: p.cat });
  }
  const hasTreat = lines.some(l => l.cat === 'treat');
  const fulfil = body.fulfil === 'delivery' ? 'delivery' : 'pickup';
  if (hasTreat && fulfil === 'delivery') return { error: 'Treats are pickup only for now.' };
  const day = clean(body.day, 10);
  if (day && (!DAY.test(day) || day < today)) return { error: 'Please pick a date that hasn\'t passed.' };
  if (hasTreat && !openDays.includes(day)) return { error: 'Please pick one of the open pickup days for treats.' };
  const address = fulfil === 'delivery' ? clean(body.address, 200) : '';
  if (fulfil === 'delivery' && address.length < 6) return { error: 'Please enter the delivery address.' };
  const fee = fulfil === 'delivery' ? Math.max(0, Number(shop.delivery_fee_cents) || 0) : 0;
  if (fee) lines.push({ id: 'delivery', name: 'Delivery', qty: 1, price_cents: fee, cat: 'fee' });
  const total = lines.reduce((s, l) => s + l.qty * l.price_cents, 0);
  if (total < 50) return { error: 'Order total is too small to pay by card.' };
  return {
    lines,
    order: { name, phone, email, items: lines.map(({ cat, ...l }) => l), total_cents: total, fulfil, day: day || null, address, details: clean(body.details, 1500) }
  };
}

module.exports = async (req, res) => {
  const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });
  // names only (never values), so a missing Vercel variable is easy to spot
  const missing = ['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k]);
  // seen: names of any STRIPE/SUPABASE variables present (JSON-quoted so stray spaces show). Never values.
  if (missing.length) return send(503, { error: 'not_connected', missing, seen: Object.keys(process.env).filter(k => /stripe|supabase/i.test(k)).map(k => JSON.stringify(k)) });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (limited(ip)) return send(429, { error: 'Too many tries. Please wait a minute.' });
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > 16384) return send(413, { error: 'too big' }); }
  let body; try { body = JSON.parse(raw); } catch (e) { return send(400, { error: 'bad request' }); }

  try {
    const today = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); // ponytail: fixed US Central-ish offset
    const [products, days, set] = await Promise.all([
      sb.rest('products?select=*'),
      sb.rest('open_days?select=day&day=gte.' + today),
      sb.rest('settings?k=eq.shop&select=v')
    ]);
    const r = build(body, products, days.map(d => d.day), set[0] && set[0].v, today);
    if (r.error) return send(400, { error: r.error === 'spam' ? 'bad request' : r.error });

    const [row] = await sb.rest('orders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(r.order) });
    const site = (process.env.SITE_URL || 'https://' + req.headers.host).replace(/\/+$/, '');
    const f = new URLSearchParams({
      mode: 'payment',
      client_reference_id: row.id,
      success_url: site + '/?paid=1#order',
      cancel_url: site + '/?cancelled=1#order',
      'phone_number_collection[enabled]': 'false'
    });
    if (r.order.email) f.set('customer_email', r.order.email);
    r.lines.forEach((l, i) => {
      f.set(`line_items[${i}][quantity]`, l.qty);
      f.set(`line_items[${i}][price_data][currency]`, 'usd');
      f.set(`line_items[${i}][price_data][unit_amount]`, l.price_cents);
      f.set(`line_items[${i}][price_data][product_data][name]`, l.name);
    });
    const s = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', body: f,
      headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then(x => x.json());
    if (!s.url) throw new Error('stripe: ' + (s.error && s.error.message));
    await sb.rest('orders?id=eq.' + row.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_session: String(s.id).slice(0, 120) }) });
    return send(200, { url: s.url });
  } catch (e) {
    console.error(e);
    return send(500, { error: 'Checkout failed. Please try again or text Milly.' });
  }
};
module.exports.build = build;
