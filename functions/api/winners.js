// GET /api/winners  (PUBLIC)
// Recent tournament activity from D1. NOTE: the seat-tracking model is
// anonymous (no player names are ever stored), so this returns recent ended
// tournaments (date, table, entry count) as proof of activity — the *named*
// winner gallery on /winners/ comes from the editable /data/winners.json.
import { json, now } from '../_shared/db.js';

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return json({ tournaments: [], count_30d: 0 });

  const since = now() - 30 * 86400;
  const { results } = await db.prepare(
    `SELECT s.id, s.ended_at, t.table_number,
            (SELECT COUNT(*) FROM seat_checkins c WHERE c.session_id = s.id) AS entries
       FROM sessions s JOIN tables_config t ON t.id = s.table_id
      WHERE s.game_type = 'tournament' AND s.status = 'ended' AND s.ended_at IS NOT NULL
      ORDER BY s.ended_at DESC LIMIT 12`).all();

  const cnt = await db.prepare(
    `SELECT COUNT(*) n FROM sessions
      WHERE game_type = 'tournament' AND status = 'ended' AND ended_at >= ?`).bind(since).first();

  return json({
    tournaments: (results || []).map(r => ({ date: r.ended_at, table_number: r.table_number, entries: r.entries })),
    count_30d: cnt ? cnt.n : 0,
  });
}
