// ============================================================================
// Deuces Wild Poker Club — Cloudflare Worker entry (static assets + API)
//
// This repo deploys as a Workers project (not Pages), so the /functions/ Pages
// Functions don't auto-run. This Worker provides the same API by importing the
// exact same handler code from /functions/ and routing to it, then falls
// through to the static-assets binding (env.ASSETS) for everything else.
//
// wrangler.jsonc sets `assets.run_worker_first: true` so this Worker runs on
// every request — required so the /admin/* auth gate below is actually enforced
// (otherwise Cloudflare would serve the static admin HTML directly).
//
// Bindings (wrangler.jsonc): ASSETS (static assets), DB (D1), STATUS (KV).
// Secret: ADMIN_PASSWORD.
// ============================================================================
import { isAuthed } from './functions/_shared/auth.js';
import { onRequestGet as sessionsGet } from './functions/api/sessions.js';
import { onRequestPost as scanPost } from './functions/api/scan.js';
import { onRequestPost as startPost } from './functions/api/session/start.js';
import { onRequestPost as endPost } from './functions/api/session/end.js';
import { onRequestPost as checkinPost } from './functions/api/checkin.js';
import { onRequestPost as checkoutPost } from './functions/api/checkout.js';
import { onRequestGet as boardGet } from './functions/api/admin/board.js';
import { onRequestGet as historyGet } from './functions/api/admin/history.js';
import { onRequestGet as statusGet, onRequestPost as statusPost } from './functions/api/status.js';
import { onRequestGet as loginGet, onRequestPost as loginPost } from './functions/api/login.js';
import { onRequestPost as smsPost } from './functions/api/sms-optin.js';
import { onRequestPost as referPost } from './functions/api/refer.js';
import { onRequestGet as winnersGet } from './functions/api/winners.js';
import { onRequestPost as contactPost } from './functions/api/contact.js';

// API paths that do NOT require admin auth.
const PUBLIC_API = new Set(['/api/sessions', '/api/sms-optin', '/api/refer', '/api/login', '/api/winners', '/api/contact']);

const jsonErr = (msg, status) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });

// route table: 'METHOD /path' -> handler({ request, env, ctx })
const ROUTES = {
  'GET /api/sessions': sessionsGet,
  'POST /api/scan': scanPost,
  'POST /api/session/start': startPost,
  'POST /api/session/end': endPost,
  'POST /api/checkin': checkinPost,
  'POST /api/checkout': checkoutPost,
  'GET /api/admin/board': boardGet,
  'GET /api/admin/history': historyGet,
  'GET /api/status': statusGet,
  'POST /api/status': statusPost,
  'GET /api/login': loginGet,
  'POST /api/login': loginPost,
  'POST /api/sms-optin': smsPost,
  'POST /api/refer': referPost,
  'GET /api/winners': winnersGet,
  'POST /api/contact': contactPost,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // ---------- API ----------
    if (path === '/api' || path.startsWith('/api/')) {
      if (!PUBLIC_API.has(path) && !(await isAuthed(request, env))) {
        return jsonErr('Unauthorized', 401);
      }
      const handler = ROUTES[`${request.method} ${path}`];
      if (!handler) return jsonErr('Not found', 404);
      return handler({ request, env, ctx });
    }

    // ---------- Admin pages (gate before serving the static HTML) ----------
    if (path === '/admin' || path.startsWith('/admin/')) {
      const isLogin = path === '/admin/login' || path === '/admin/login.html';
      if (!isLogin && !(await isAuthed(request, env))) {
        return Response.redirect(new URL('/admin/login.html', request.url).toString(), 302);
      }
      return env.ASSETS.fetch(request);
    }

    // ---------- Everything else: static assets ----------
    return env.ASSETS.fetch(request);
  },
};
