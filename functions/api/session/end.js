// POST /api/session/end  (AUTH)
// Ends a session: checks out every still-seated player and marks the session
// ended. For a tournament, the last remaining player gets finish_position = 1
// (the winner). Cash checkouts get no finish position.
//   body: { session_id }
import { json, now } from '../../_shared/db.js';

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const { session_id } = await request.json().catch(() => ({}));
  if (!session_id) return json({ error: 'session_id required' }, 400);

  const session = await db.prepare(`SELECT * FROM sessions WHERE id = ?`).bind(session_id).first();
  if (!session) return json({ error: 'Session not found' }, 404);
  if (session.status === 'ended') return json({ ok: true, action: 'already_ended' });

  const t = now();
  const { results } = await db.prepare(
    `SELECT id FROM seat_checkins WHERE session_id = ? AND checked_out_at IS NULL
      ORDER BY checked_in_at ASC`).bind(session_id).all();
  const stillSeated = results || [];

  if (session.game_type === 'tournament') {
    // Winner = the single last remaining player (1st). If more than one is
    // still seated at force-end, the earliest-seated is recorded as the winner
    // and the rest get no position (table was being broken).
    for (let i = 0; i < stillSeated.length; i++) {
      const pos = (stillSeated.length === 1 || i === stillSeated.length - 1) ? 1 : null;
      await db.prepare(`UPDATE seat_checkins SET checked_out_at = ?, finish_position = ? WHERE id = ?`)
        .bind(t, pos, stillSeated[i].id).run();
    }
  } else {
    for (const c of stillSeated) {
      await db.prepare(`UPDATE seat_checkins SET checked_out_at = ? WHERE id = ?`).bind(t, c.id).run();
    }
  }

  await db.prepare(`UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?`).bind(t, session_id).run();
  return json({ ok: true, action: 'session_ended', session_id, checked_out: stillSeated.length });
}
