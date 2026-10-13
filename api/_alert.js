// Sends a push alert to every phone Milly turned alerts on for. Phones that turned alerts off (404/410) are removed.
const sb = require('./_sb');
const push = require('./_push');
const ready = () => sb.ready() && !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
async function alertAll(message) {
  if (!ready()) return 0;
  const env = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY, subject: process.env.SITE_URL || 'https://mtbooks.vercel.app' };
  const subs = await sb.rest('push_subscriptions?select=id,endpoint,p256dh,auth&limit=20');
  let sent = 0;
  for (const s of subs) {
    const st = await push.send(s, message, env).catch(() => 0);
    if (st >= 200 && st < 300) sent++;
    if (st === 404 || st === 410) await sb.rest('push_subscriptions?id=eq.' + s.id, { method: 'DELETE' }).catch(() => {});
  }
  return sent;
}
// "New paid order · $27" / "Ana: 2× Mini loaf cake, Flyer · Pickup Sat Oct 18"
function orderMessage(o) {
  const items = (o.items || []).filter(i => i.id !== 'delivery').map(i => (i.qty > 1 ? i.qty + '× ' : '') + i.name).join(', ');
  const day = o.day ? new Date(o.day + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
  const when = o.fulfil === 'delivery' ? 'Delivery' : 'Pickup';
  const total = '$' + ((o.total_cents || 0) / 100).toFixed(2).replace(/\.00$/, '');
  return { title: 'New paid order · ' + total, body: String(o.name || 'Someone').split(' ')[0] + ': ' + items + (day ? ' · ' + when + ' ' + day : ' · ' + when) };
}
module.exports = { alertAll, orderMessage, ready };
