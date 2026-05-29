// /api/status  (AUTH)  — manual "doors open / closed" override for the home
// widget, used when the QR check-in system isn't running. Stored in KV
// (STATUS namespace, key 'manual_status'). Read side is merged into
// /api/sessions when no live sessions exist.
//   GET  -> current manual status
//   POST { open: bool, message: string } -> set it
import { json, now } from '../_shared/db.js';

export async function onRequestGet({ env }) {
  if (!env.STATUS) return json({ manual: null });
  const raw = await env.STATUS.get('manual_status');
  return json({ manual: raw ? JSON.parse(raw) : null });
}

export async function onRequestPost({ request, env }) {
  if (!env.STATUS) return json({ error: 'KV not bound' }, 500);
  const { open, message } = await request.json().catch(() => ({}));
  const val = { open: !!open, message: (message || '').slice(0, 140), updated: now() };
  await env.STATUS.put('manual_status', JSON.stringify(val));
  return json({ ok: true, manual: val });
}
