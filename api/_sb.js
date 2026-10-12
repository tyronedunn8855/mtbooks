// Server-side Supabase calls with the service key. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY live only in Vercel env vars.
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
function headers(extra) {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const h = { apikey: k, 'Content-Type': 'application/json' };
  if (k && !k.startsWith('sb_')) h.Authorization = 'Bearer ' + k; // older JWT-style keys
  return Object.assign(h, extra || {});
}
async function rest(path, opts) {
  const r = await fetch(URL_ + '/rest/v1/' + path, Object.assign({}, opts, { headers: headers(opts && opts.headers) }));
  const text = await r.text();
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}
const ready = () => !!(URL_ && process.env.SUPABASE_SERVICE_ROLE_KEY);
module.exports = { rest, ready };
