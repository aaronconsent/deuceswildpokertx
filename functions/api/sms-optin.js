// POST /api/sms-optin  (PUBLIC)   { phone, source }
// SMS Text Club opt-in. Normalizes the phone to 11-digit US format (country
// code + 10 digits, no plus, e.g. 17133848985), keeps a KV backup (de-dupes),
// then writes NEW sign-ups straight to the Google Sheet via a Google Apps
// Script Web App (env SHEET_WEBHOOK_URL). No Make.com / third party.
//
// The Apps Script receives this JSON and appends a row (see GOOGLE-SHEET-SETUP.md):
//   { phone: "17133848985", source: "/text-club/",
//     consented_at: "2026-05-28T...Z", ts: 1780000000 }
import { json, now } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const { phone, source } = await request.json().catch(() => ({}));
  let d = (phone || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;                 // 7133848985 -> 17133848985
  if (d.length !== 11 || d[0] !== '1')
    return json({ error: 'Please enter a valid 10-digit US mobile number.' }, 400);
  const formatted = d;                              // e.g. 17133848985

  const ts = now();
  const payload = {
    phone: formatted,
    source: (source || '').slice(0, 120),
    consented_at: new Date(ts * 1000).toISOString(),
    ts,
  };

  let stored = false, dedup = false, written = false;

  // 1) KV backup + de-dupe (best-effort; also lets us avoid duplicate rows).
  if (env.STATUS) {
    try {
      const key = 'smsoptin:' + formatted;
      if (await env.STATUS.get(key)) dedup = true;
      else { await env.STATUS.put(key, JSON.stringify(payload)); stored = true; }
    } catch (e) { /* fall through to sheet write */ }
  }

  // 2) Append NEW numbers straight to the Google Sheet (Apps Script Web App).
  //    Skip known duplicates so the sheet doesn't get repeat rows.
  if (!dedup && env.SHEET_WEBHOOK_URL) {
    try {
      const r = await fetch(env.SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      written = r.ok;
    } catch (e) { written = false; }
  }

  // Succeed if we captured the number anywhere (or already had it).
  if (stored || written || dedup) return json({ ok: true });
  return json({ error: 'Could not save right now — please text us instead.' }, 502);
}
