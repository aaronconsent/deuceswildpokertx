// POST /api/sms-optin  (PUBLIC)   { phone, source }
// SMS Text Club opt-in. Normalizes the phone to E.164, keeps a KV backup (and
// de-dupes), then forwards NEW sign-ups to the Make.com webhook (env
// SMS_WEBHOOK_URL) which appends them to the Google Spreadsheet.
//
// Make scenario receives this JSON (map these to sheet columns):
//   { phone: "+19365551234", phone_digits: "9365551234",
//     source: "/text-club/", consented_at: "2026-05-28T...Z", ts: 1780000000 }
import { json, now } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const { phone, source } = await request.json().catch(() => ({}));
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15)
    return json({ error: 'Please enter a valid mobile number.' }, 400);
  const e164 = digits.length === 10 ? '+1' + digits : '+' + digits;

  const ts = now();
  const payload = {
    phone: e164,
    phone_digits: digits,
    source: (source || '').slice(0, 120),
    consented_at: new Date(ts * 1000).toISOString(),
    ts,
  };

  let stored = false, dedup = false, forwarded = false;

  // 1) KV backup + de-dupe (best-effort; also lets us avoid duplicate rows).
  if (env.STATUS) {
    try {
      const key = 'smsoptin:' + e164;
      if (await env.STATUS.get(key)) dedup = true;
      else { await env.STATUS.put(key, JSON.stringify(payload)); stored = true; }
    } catch (e) { /* fall through to webhook */ }
  }

  // 2) Forward NEW numbers to Make.com -> Google Sheet. (Skip if it's a known
  //    duplicate, so the sheet doesn't get repeat rows.)
  if (!dedup && env.SMS_WEBHOOK_URL) {
    try {
      const r = await fetch(env.SMS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      forwarded = r.ok;
    } catch (e) { forwarded = false; }
  }

  // Succeed if we captured the number anywhere (or already had it).
  if (stored || forwarded || dedup) return json({ ok: true });
  return json({ error: 'Could not save right now — please text us instead.' }, 502);
}
