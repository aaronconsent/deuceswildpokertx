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
  return json({ authed: await isAuthed(request, env) });
}
