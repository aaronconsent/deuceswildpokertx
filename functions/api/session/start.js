// POST /api/session/start  (AUTH)
// Creates a new active session at a table and checks in the first seat.
//   body: { table_id, game_type, seat_qr }
import { json, now, getSeat, activeSessionForTable } from '../../_shared/db.js';

const GAMES = ['holdem_cash', 'omaha_cash', 'tournament'];

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const { table_id, game_type, seat_qr } = await request.json().catch(() => ({}));
  if (!table_id || !GAMES.includes(game_type) || !seat_qr)
    return json({ error: 'table_id, valid game_type, and seat_qr required' }, 400);

  const seat = await getSeat(db, seat_qr);
  if (!seat || seat.table_id !== Number(table_id))
    return json({ error: 'Seat does not belong to that table' }, 400);

  if (await activeSessionForTable(db, table_id))
    return json({ error: 'Table already has an active session' }, 409);

  const t = now();
  const res = await db.prepare(
    `INSERT INTO sessions (table_id, game_type, started_at, status) VALUES (?,?,?, 'active')`
  ).bind(table_id, game_type, t).run();
  const sessionId = res.meta.last_row_id;

  await db.prepare(
    `INSERT INTO seat_checkins (session_id, seat_qr, checked_in_at) VALUES (?,?,?)`
  ).bind(sessionId, seat_qr, t).run();

  return json({ ok: true, action: 'session_started', session_id: sessionId,
    table_id: Number(table_id), game_type, seat_qr });
}
