// Auth gate for /api/*. These paths are PUBLIC; everything else under /api
// requires a valid admin cookie (scan, session/*, checkin, checkout, admin/*).
import { isAuthed } from '../_shared/auth.js';

const PUBLIC = new Set(['/api/sessions', '/api/sms-optin', '/api/refer', '/api/login', '/api/winners', '/api/contact']);

export async function onRequest(context) {
  const { request, next, env } = context;
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';

  if (PUBLIC.has(path)) return next();
  if (await isAuthed(request, env)) return next();

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
}
