// POST /api/contact  (PUBLIC)  { name, phone, email, message, _gotcha }
// General question from the contact page. Logged to KV (STATUS) under a
// 'contact:' key for Mike & Ike to review. Real delivery (email/SMS) is wired
// in a later prompt; phone/text remains the primary channel meanwhile.
import { json, now } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  if (b._gotcha) return json({ ok: true });                 // honeypot
  const name = (b.name || '').trim();
  const message = (b.message || '').trim();
  const phone = (b.phone || '').trim();
  const email = (b.email || '').trim();
  if (!name || !message) return json({ error: 'Please include your name and a message.' }, 400);
  if (!phone && !email) return json({ error: 'Add a phone number or email so we can reply.' }, 400);

  if (!env.STATUS) return json({ ok: true, stored: false });
  await env.STATUS.put('contact:' + Date.now(),
    JSON.stringify({ name, phone, email, message: message.slice(0, 2000), at: now() }));
  return json({ ok: true });
}
