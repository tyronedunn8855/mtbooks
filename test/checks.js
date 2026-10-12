// Run: node test/checks.js  (no dependencies)
const assert = require('assert');
const crypto = require('crypto');
const { build } = require('../api/checkout');
const { verify } = require('../api/stripe-webhook');
const P = [
  { id: 'flyer', cat: 'paper', name: 'Flyer', price_cents: 1500, active: true },
  { id: 'loaf', cat: 'treat', name: 'Mini loaf cake', price_cents: 500, active: true },
  { id: 'old', cat: 'paper', name: 'Old', price_cents: 100, active: false }
];
const shop = { open: true, delivery_fee_cents: 500 };
const base = { name: 'Ana', phone: '(414) 555-0100', items: [{ id: 'flyer', qty: 2 }], fulfil: 'pickup' };
const T = '2026-10-12';

let r = build(base, P, [], shop, T);
assert.equal(r.order.total_cents, 3000);                                  // server price, not client
r = build({ ...base, items: [{ id: 'flyer', qty: 1, price_cents: 1 }] }, P, [], shop, T);
assert.equal(r.order.total_cents, 1500);                                  // ignores client price
assert(build({ ...base, items: [{ id: 'old', qty: 1 }] }, P, [], shop, T).error);   // inactive item
assert(build({ ...base, items: [{ id: 'flyer', qty: 0 }] }, P, [], shop, T).error); // bad qty
assert(build({ ...base, phone: '123' }, P, [], shop, T).error);
assert(build({ ...base, website: 'bot' }, P, [], shop, T).error);         // honeypot
assert(build(base, P, [], { open: false }, T).error);                     // shop closed
const treat = { ...base, items: [{ id: 'loaf', qty: 1 }] };
assert(build({ ...treat, fulfil: 'delivery', address: '1 Main St' }, P, ['2026-10-14'], shop, T).error); // treats pickup only
assert(build({ ...treat, day: '2026-10-15' }, P, ['2026-10-14'], shop, T).error);  // not an open day
assert(build({ ...treat, day: '2026-10-01' }, P, ['2026-10-01'], shop, T).error);  // past day
assert.equal(build({ ...treat, day: '2026-10-14' }, P, ['2026-10-14'], shop, T).order.total_cents, 500);
assert(build({ ...base, fulfil: 'delivery' }, P, [], shop, T).error);    // delivery needs address
r = build({ ...base, fulfil: 'delivery', address: '12 Oak Ave, Milwaukee' }, P, [], shop, T);
assert.equal(r.order.total_cents, 3500);                                  // + delivery fee

const sec = 'whsec_test', raw = '{"a":1}', t = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', sec).update(t + '.' + raw).digest('hex');
assert(verify(raw, `t=${t},v1=${sig}`, sec));
assert(!verify(raw + ' ', `t=${t},v1=${sig}`, sec));
assert(!verify(raw, `t=${t - 600},v1=${sig}`, sec));
console.log('all checks passed');
