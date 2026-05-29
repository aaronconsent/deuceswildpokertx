// POST /api/refer  (PUBLIC)  { referrer_name, friend_name, friend_phone }
// Logs a referral lead to D1 (referrals table) for Mike & Ike to follow up
// and credit both players at the door.
import { json, now } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const b = await request.json().catch(() => ({}));
  const referrer = (b.referrer_name || '').trim();
  const friend = (b.friend_name || '').trim();
  const phone = (b.friend_phone || '').replace(/\D/g, '');
  if (b._gotcha) return json({ ok: true }); // honeypot
  if (!referrer || !friend || phone.length < 10)
    return json({ error: 'Please fill in your name, your friend\'s name, and a valid phone number.' }, 400);
  if (!db) return json({ error: 'Database not configured yet.' }, 500);

  const e164 = phone.length === 10 ? '+1' + phone : '+' + phone;
  await db.prepare(
    `INSERT INTO referrals (referrer_name, friend_name, friend_phone, created_at, status)
     VALUES (?,?,?,?, 'new')`).bind(referrer, friend, e164, now()).run();

  return json({ ok: true });
}
