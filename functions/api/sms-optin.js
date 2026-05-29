// POST /api/sms-optin  (PUBLIC)   { phone, source }
// Logs the opt-in to KV (namespace binding STATUS) for now. A later prompt
// wires the actual SMS provider; this just queues numbers + consent timestamp.
import { json, now } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const { phone, source } = await request.json().catch(() => ({}));
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return json({ error: 'Please enter a valid 10-digit mobile number.' }, 400);
  const e164 = digits.length === 10 ? '+1' + digits : '+' + digits;

  if (!env.STATUS) return json({ ok: true, queued: false, note: 'KV not bound; not stored' });

  const key = 'smsoptin:' + e164;
  const existing = await env.STATUS.get(key);
  if (!existing) {
    await env.STATUS.put(key, JSON.stringify({ phone: e164, source: source || '', consented_at: now() }));
  }
  return json({ ok: true });
}
