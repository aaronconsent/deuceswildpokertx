// POST /api/login   { password }  -> sets admin cookie on success
// POST /api/logout  -> clears it (handled here via ?logout=1)
import { tokenFor, isAuthed, expectedToken, sessionCookie, clearCookie } from '../_shared/auth.js';
import { json } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('logout') === '1') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie() } });
  }
  const expected = await expectedToken(env);
  if (!expected) return json({ error: 'Admin password not configured on server' }, 500);

  const { password } = await request.json().catch(() => ({}));
  if (!password) return json({ error: 'Incorrect password' }, 401);
  const candidate = await tokenFor(password);
  if (candidate !== expected) return json({ error: 'Incorrect password' }, 401);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(candidate) } });
}

export async function onRequestGet({ request, env }) {
  // Diagnostic: reports ONLY whether the secret is bound (never its value) +
  // which bindings the Worker can see. Visit /api/login to check config.
  // envKeys = the NAMES of bindings/vars the Worker can see at runtime (no
  // values). If ADMIN_PASSWORD / SHEET_WEBHOOK_URL aren't listed, they're set
  // in the wrong place (e.g. Build vars, or Preview env) — not runtime vars.
  let envKeys = [];
  try { envKeys = Object.keys(env).sort(); } catch (e) {}
  return json({
    authed: await isAuthed(request, env),
    configured: !!(env.ADMIN_PASSWORD || env.ADMIN_PW_SHA256),
    bindings: { DB: !!env.DB, STATUS: !!env.STATUS, SHEET_WEBHOOK_URL: !!env.SHEET_WEBHOOK_URL },
    envKeys,
  });
}
