-- ============================================================================
-- Deuces Wild Poker Club — D1 schema + seed
-- Apply once on first deploy:
--   wrangler d1 execute dwp-tracking --file=db/schema.sql --remote
-- Idempotent: safe to re-run (CREATE IF NOT EXISTS + INSERT OR IGNORE).
-- The QR codes track SEATS, not players. No PII is ever stored here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tables_config (
  id            INTEGER PRIMARY KEY,
  table_number  INTEGER NOT NULL,
  total_seats   INTEGER NOT NULL DEFAULT 10,
  is_active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS seats_config (
  qr_token    TEXT PRIMARY KEY,          -- 't1-s1' .. 't4-s10'
  table_id    INTEGER NOT NULL,
  seat_number INTEGER NOT NULL,
  FOREIGN KEY (table_id) REFERENCES tables_config(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id    INTEGER NOT NULL,
  game_type   TEXT NOT NULL,             -- 'holdem_cash' | 'omaha_cash' | 'tournament'
  started_at  INTEGER NOT NULL,          -- unix seconds
  ended_at    INTEGER,
  status      TEXT NOT NULL,             -- 'active' | 'ended'
  FOREIGN KEY (table_id) REFERENCES tables_config(id)
);

CREATE TABLE IF NOT EXISTS seat_checkins (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      INTEGER NOT NULL,
  seat_qr         TEXT NOT NULL,
  checked_in_at   INTEGER NOT NULL,
  checked_out_at  INTEGER,
  finish_position INTEGER,               -- tournament bust-outs only
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (seat_qr)    REFERENCES seats_config(qr_token)
);

-- Referral leads (the only place /refer/ writes; reviewed by Mike & Ike).
CREATE TABLE IF NOT EXISTS referrals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_name TEXT NOT NULL,
  friend_name   TEXT NOT NULL,
  friend_phone  TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new'  -- 'new' | 'credited'
);

CREATE INDEX IF NOT EXISTS idx_active_checkins ON seat_checkins(session_id, checked_out_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions ON sessions(status);

-- ---- Seed the 4 tables ----
INSERT OR IGNORE INTO tables_config (id, table_number, total_seats, is_active) VALUES
 (1,1,10,1),(2,2,10,1),(3,3,10,1),(4,4,10,1);

-- ---- Seed the 40 seats (t1-s1 .. t4-s10) ----
INSERT OR IGNORE INTO seats_config (qr_token, table_id, seat_number) VALUES
 ('t1-s1',1,1),('t1-s2',1,2),('t1-s3',1,3),('t1-s4',1,4),('t1-s5',1,5),('t1-s6',1,6),('t1-s7',1,7),('t1-s8',1,8),('t1-s9',1,9),('t1-s10',1,10),
 ('t2-s1',2,1),('t2-s2',2,2),('t2-s3',2,3),('t2-s4',2,4),('t2-s5',2,5),('t2-s6',2,6),('t2-s7',2,7),('t2-s8',2,8),('t2-s9',2,9),('t2-s10',2,10),
 ('t3-s1',3,1),('t3-s2',3,2),('t3-s3',3,3),('t3-s4',3,4),('t3-s5',3,5),('t3-s6',3,6),('t3-s7',3,7),('t3-s8',3,8),('t3-s9',3,9),('t3-s10',3,10),
 ('t4-s1',4,1),('t4-s2',4,2),('t4-s3',4,3),('t4-s4',4,4),('t4-s5',4,5),('t4-s6',4,6),('t4-s7',4,7),('t4-s8',4,8),('t4-s9',4,9),('t4-s10',4,10);
