// GET /api/admin/board  (AUTH)
// Full operational view for the host check-in dashboard: every table, its
// active session (if any), and per-seat occupancy. Powers /admin/checkin.html.
import { json, activeSessionForTable, playersRemaining } from '../../_shared/db.js';

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return json({ tables: [] });

  const { results: tables } = await db.prepare(
    `SELECT id, table_number, total_seats FROM tables_config WHERE is_active = 1 ORDER BY table_number`).all();

  const out = [];
  for (const t of (tables || [])) {
    const session = await activeSessionForTable(db, t.id);

    // All seats for this table.
    const { results: seatRows } = await db.prepare(
      `SELECT qr_token, seat_number FROM seats_config WHERE table_id = ? ORDER BY seat_number`).bind(t.id).all();

    // Which seats are currently occupied in the active session.
    let occupied = new Set();
    if (session) {
      const { results: open } = await db.prepare(
        `SELECT seat_qr FROM seat_checkins WHERE session_id = ? AND checked_out_at IS NULL`).bind(session.id).all();
      occupied = new Set((open || []).map(r => r.seat_qr));
    }

    const seats = (seatRows || []).map(s => ({
      qr: s.qr_token, seat_number: s.seat_number, occupied: occupied.has(s.qr_token),
    }));

    const row = {
      table_id: t.id, table_number: t.table_number, total_seats: t.total_seats,
      seats, seated: occupied.size,
      session: session ? { id: session.id, game_type: session.game_type, started_at: session.started_at } : null,
    };
    if (session && session.game_type === 'tournament') row.players_remaining = await playersRemaining(db, session.id);
    out.push(row);
  }
  return json({ tables: out, server_time: Math.floor(Date.now() / 1000) });
}
