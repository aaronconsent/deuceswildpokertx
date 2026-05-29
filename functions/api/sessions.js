// GET /api/sessions  (PUBLIC)
// Powers the home-page live status widget. Returns all active sessions with
// seat counts + tournament players-remaining. Falls back to a KV manual
// override ("doors open tonight") when no tables are running yet.
import { json, seatedCount, playersRemaining } from '../_shared/db.js';

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return json({ open: false, sessions: [], seats_available: 0, source: 'no-db' });

  const { results } = await db.prepare(
    `SELECT s.id, s.table_id, s.game_type, s.started_at, t.table_number, t.total_seats
       FROM sessions s JOIN tables_config t ON t.id = s.table_id
      WHERE s.status = 'active'
      ORDER BY t.table_number ASC`).all();

  const sessions = [];
  let seatsAvailable = 0;
  for (const s of (results || [])) {
    const seated = await seatedCount(db, s.id);
    seatsAvailable += Math.max(0, s.total_seats - seated);
    const row = {
      session_id: s.id, table_id: s.table_id, table_number: s.table_number,
      game_type: s.game_type, total_seats: s.total_seats, seated,
      started_at: s.started_at,
    };
    if (s.game_type === 'tournament') row.players_remaining = await playersRemaining(db, s.id);
    sessions.push(row);
  }

  let manual = null;
  if (sessions.length === 0 && env.STATUS) {
    try { const raw = await env.STATUS.get('manual_status'); if (raw) manual = JSON.parse(raw); } catch (e) {}
  }

  return json({
    open: sessions.length > 0,
    seats_available: seatsAvailable,
    sessions,
    manual,                 // { open, message, updated } or null
    source: 'd1',
  });
}
