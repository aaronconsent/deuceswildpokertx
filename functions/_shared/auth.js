// Shared auth for admin pages + write APIs. Single shared password in the
// ADMIN_PASSWORD env var. On login we set an HttpOnly cookie whose value is a
// SHA-256 token derived from the password; middleware re-derives and compares.
// No DB-backed sessions needed.

const COOKIE = 'dwp_admin';

async function tokenFor(password) {
  const data = new TextEncoder().encode('dwp::' + password + '::v1');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const c = request.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

// The expected cookie token (a SHA-256 hex). Sourced from either:
//  - ADMIN_PW_SHA256  : the hashed password, safe to store in wrangler.jsonc, or
//  - ADMIN_PASSWORD   : a plaintext dashboard secret (if it ever binds).
// ADMIN_PW_SHA256 must equal sha256("dwp::<password>::v1").
async function expectedToken(env) {
  if (env.ADMIN_PW_SHA256) return env.ADMIN_PW_SHA256.trim().toLowerCase();
  if (env.ADMIN_PASSWORD) return await tokenFor(env.ADMIN_PASSWORD);
  return null;
}

async function isAuthed(request, env) {
  const expected = await expectedToken(env);
  if (!expected) return false;
  const tok = getCookie(request, COOKIE);
  return !!tok && tok === expected;
}

function sessionCookie(token) {
  // 12h session, HttpOnly, SameSite=Lax, Secure.
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`;
}
function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export { COOKIE, tokenFor, getCookie, isAuthed, expectedToken, sessionCookie, clearCookie };
