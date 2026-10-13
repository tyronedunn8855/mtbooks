// "Send a test alert" from Milly's Studio. Only the signed-in owner can use it.
const sb = require('./_sb');
const { alertAll, ready } = require('./_alert');
module.exports = async (req, res) => {
  const out = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return out(405, { error: 'POST only' });
  if (!ready()) return out(503, { error: 'not set up' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || token.length > 4000) return out(401, { error: 'sign in' });
  try {
    // who is this? (Supabase checks the token), then compare with the owner login in the database
    const u = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + token } });
    if (!u.ok) return out(401, { error: 'sign in' });
    const email = String((await u.json()).email || '').toLowerCase();
    const owner = String(await sb.rest('rpc/owner_email', { method: 'POST', body: '{}' }) || '').toLowerCase();
    if (!email || email !== owner) return out(403, { error: 'owner only' });
    const sent = await alertAll({ title: 'Order alerts are on', body: 'You\'ll get a ping like this for every paid order.' });
    return out(200, { sent });
  } catch (e) { console.error(e); return out(500, { error: 'failed' }); }
};
