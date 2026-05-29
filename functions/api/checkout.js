// POST /api/checkout  (AUTH)
// Checks a seat out of its active session.
//   body: { seat_qr, session_id, type: 'bust' | 'move' | 'cash', finish_position? }
//     bust  -> tournament bust-out, records finish_position (computed if absent)
//     move  -> consolidating to another table, NO finish_position (still in)
//     cash  -> cash game leaver, no finish_position
import { json, now, getSeat, openCheckin, playersRemaining } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const body = await request.json().catch(() => ({}));
  const { seat_qr, session_id, type } = body;
  if (!seat_qr || !session_id || !['bust', 'move', 'cash'].includes(type))
    return json({ error: "seat_qr, session_id, and type ('bust'|'move'|'cash') required" }, 400);

  const seat = await getSeat(db, seat_qr);
  if (!seat) return json({ error: 'Unknown seat code' }, 404);

  const checkin = await openCheckin(db, session_id, seat_qr);
  if (!checkin) return json({ ok: true, action: 'not_seated' });

  let finish = null;
  if (type === 'bust') {
    finish = body.finish_position != null ? body.finish_position : await playersRemaining(db, session_id);
  }

  await db.prepare(`UPDATE seat_checkins SET checked_out_at = ?, finish_position = ? WHERE id = ?`)
    .bind(now(), finish, checkin.id).run();

  return json({ ok: true, action: 'checked_out', type, seat_qr, finish_position: finish });
}
