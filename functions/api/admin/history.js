// GET /api/admin/history  (AUTH)  -> last 30 days of sessions + summary stats
// Powers /admin/sessions.html.
import { json, now } from '../../_shared/db.js';

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return json({ sessions: [], stats: {} });
  const since = now() - 30 * 86400;

  const { results } = await db.prepare(
    `SELECT s.id, s.game_type, s.started_at, s.ended_at, s.status, t.table_number,
            (SELECT COUNT(*) FROM seat_checkins c WHERE c.session_id = s.id) AS total_checkins,
            (SELECT seat_qr FROM seat_checkins c WHERE c.session_id = s.id AND c.finish_position = 1 LIMIT 1) AS winner_seat
       FROM sessions s JOIN tables_config t ON t.id = s.table_id
      WHERE s.started_at >= ?
      ORDER BY s.started_at DESC`).bind(since).all();

  const rows = results || [];
  const stats = {
    sessions_run: rows.length,
    tournaments: rows.filter(r => r.game_type === 'tournament').length,
    total_checkins: rows.reduce((a, r) => a + (r.total_checkins || 0), 0),
    active_now: rows.filter(r => r.status === 'active').length,
  };
  return json({ sessions: rows, stats, window_days: 30 });
}
