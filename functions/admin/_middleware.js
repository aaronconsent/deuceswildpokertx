// Protects every /admin/* page (static HTML included). Unauthenticated users
// are redirected to the login page. The login page itself is exempt.
import { isAuthed } from '../_shared/auth.js';

export async function onRequest(context) {
  const { request, next, env } = context;
  const path = new URL(request.url).pathname;

  if (path === '/admin/login' || path === '/admin/login.html') return next();
  if (await isAuthed(request, env)) return next();

  return Response.redirect(new URL('/admin/login.html', request.url).toString(), 302);
}
