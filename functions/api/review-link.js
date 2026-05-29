// /api/review-link
//   GET  (PUBLIC) -> { url }     the Google review URL (powers /review/ + QR)
//   POST (ADMIN)  { url }        set it (stored in KV 'review_link')
// The auth split is enforced in worker.js / _middleware.js: GET is allowlisted
// public, POST falls through to the admin gate.
import { json, now } from '../_shared/db.js';

export async function onRequestGet({ env }) {
  if (!env.STATUS) return json({ url: '' });
  const raw = await env.STATUS.get('review_link');
  return json(raw ? JSON.parse(raw) : { url: '' });
}

export async function onRequestPost({ request, env }) {
  if (!env.STATUS) return json({ error: 'KV not bound' }, 500);
  const { url } = await request.json().catch(() => ({}));
  const u = (url || '').trim();
  if (u && !/^https?:\/\//i.test(u)) return json({ error: 'Enter a full https:// URL.' }, 400);
  const val = { url: u, updated: now() };
  await env.STATUS.put('review_link', JSON.stringify(val));
  return json({ ok: true, ...val });
}
