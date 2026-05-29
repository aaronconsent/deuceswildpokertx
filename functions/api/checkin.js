// POST /api/checkin  (AUTH)
// Explicit check-in of a seat into an existing session (the scan endpoint
// usually handles this automatically; this is here for completeness / retries).
//   body: { seat_qr, session_id }
import { json, now, getSeat, openCheckin } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const { seat_qr, session_id } = await request.json().catch(() => ({}));
  if (!seat_qr || !session_id) return json({ error: 'seat_qr and session_id required' }, 400);

  const seat = await getSeat(db, seat_qr);
  if (!seat) return json({ error: 'Unknown seat code' }, 404);

  const session = await db.prepare(`SELECT * FROM sessions WHERE id = ? AND status = 'active'`).bind(session_id).first();
  if (!session) return json({ error: 'No active session' }, 404);
  if (seat.table_id !== session.table_id) return json({ error: 'Seat is not at this session\'s table' }, 400);

  if (await openCheckin(db, session_id, seat_qr)) return json({ ok: true, action: 'already_seated' });

  await db.prepare(`INSERT INTO seat_checkins (session_id, seat_qr, checked_in_at) VALUES (?,?,?)`)
    .bind(session_id, seat_qr, now()).run();
  return json({ ok: true, action: 'checked_in', session_id, seat_qr });
}
