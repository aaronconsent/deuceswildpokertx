// POST /api/scan  (AUTH)
// Single smart endpoint the host interface hits on every QR scan. Decides what
// to do from current state. Performs the instant-checkin case directly;
// returns an intent for the cases that need a one-tap confirm.
//   body: { qr_token }
//   ->  need_game       (table has no active session -> UI shows game picker)
//       checked_in      (active session, empty seat -> done, no prompt)
//       confirm_checkout (cash, occupied seat -> UI confirms)
//       confirm_bustout  (tournament, occupied seat -> UI confirms; finish pos)
import { json, now, getSeat, activeSessionForTable, openCheckin, playersRemaining } from '../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const { qr_token } = await request.json().catch(() => ({}));
  if (!qr_token) return json({ error: 'Missing qr_token' }, 400);

  const seat = await getSeat(db, qr_token);
  if (!seat) return json({ error: 'Unknown seat code' }, 404);

  const session = await activeSessionForTable(db, seat.table_id);

  // No game running at this table yet -> ask which game to start.
  if (!session) {
    return json({ action: 'need_game', table_id: seat.table_id, table_number: seat.table_number, seat_qr: qr_token });
  }

  const occupied = await openCheckin(db, session.id, qr_token);

  // Empty seat at a running table -> instant check-in, no prompt.
  if (!occupied) {
    await db.prepare(
      `INSERT INTO seat_checkins (session_id, seat_qr, checked_in_at) VALUES (?,?,?)`
    ).bind(session.id, qr_token, now()).run();
    return json({ action: 'checked_in', session_id: session.id, seat_qr: qr_token,
      table_number: seat.table_number, seat_number: seat.seat_number, game_type: session.game_type });
  }

  // Occupied seat -> confirm checkout (cash) or bust-out (tournament).
  if (session.game_type === 'tournament') {
    const finish = await playersRemaining(db, session.id); // bust now -> finishes Nth
    return json({ action: 'confirm_bustout', session_id: session.id, seat_qr: qr_token,
      table_number: seat.table_number, seat_number: seat.seat_number, finish_position: finish });
  }
  return json({ action: 'confirm_checkout', type: 'cash', session_id: session.id, seat_qr: qr_token,
    table_number: seat.table_number, seat_number: seat.seat_number });
}
