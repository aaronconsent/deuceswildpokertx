// Shared D1 helpers for the seat-tracking system.
export const now = () => Math.floor(Date.now() / 1000);

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

// The seat for a qr_token (joined with its table). null if unknown.
export async function getSeat(db, qr) {
  return db.prepare(
    `SELECT s.qr_token, s.table_id, s.seat_number, t.table_number, t.total_seats
       FROM seats_config s JOIN tables_config t ON t.id = s.table_id
      WHERE s.qr_token = ?`).bind(qr).first();
}

// The active session for a table, or null.
export async function activeSessionForTable(db, tableId) {
  return db.prepare(
    `SELECT * FROM sessions WHERE table_id = ? AND status = 'active'
      ORDER BY started_at DESC LIMIT 1`).bind(tableId).first();
}

// Is this seat currently occupied within the given session?
export async function openCheckin(db, sessionId, qr) {
  return db.prepare(
    `SELECT * FROM seat_checkins
      WHERE session_id = ? AND seat_qr = ? AND checked_out_at IS NULL
      ORDER BY checked_in_at DESC LIMIT 1`).bind(sessionId, qr).first();
}

// Players still seated in a session.
export async function seatedCount(db, sessionId) {
  const r = await db.prepare(
    `SELECT COUNT(*) n FROM seat_checkins
      WHERE session_id = ? AND checked_out_at IS NULL`).bind(sessionId).first();
  return r ? r.n : 0;
}

// Tournament players remaining = still seated + those moved (checked out with
// no finish_position, i.e. consolidating to another table).
export async function playersRemaining(db, sessionId) {
  const r = await db.prepare(
    `SELECT
        SUM(CASE WHEN checked_out_at IS NULL THEN 1 ELSE 0 END) +
        SUM(CASE WHEN checked_out_at IS NOT NULL AND finish_position IS NULL THEN 1 ELSE 0 END) AS n
       FROM seat_checkins WHERE session_id = ?`).bind(sessionId).first();
  return r && r.n ? r.n : 0;
}
