CREATE TABLE schedules (
  id TEXT NOT NULL,
  kind TEXT PRIMARY KEY,
  expression TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  next_run_at INTEGER NOT NULL,
  revision INTEGER NOT NULL
);
CREATE TABLE scheduler_work (
  ref TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  revision INTEGER NOT NULL,
  due_at INTEGER,
  available_at INTEGER,
  lease TEXT,
  replay_requested INTEGER NOT NULL DEFAULT 0,
  projection_pending INTEGER NOT NULL DEFAULT 0,
  executing INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  failure TEXT,
  dead INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX scheduler_ready ON scheduler_work(available_at,ref) WHERE dead=0 AND available_at IS NOT NULL;
-- Persist the first deadline so downtime crossing 02:00 is recoverable.
INSERT INTO scheduler_work(ref,kind,revision,due_at,available_at)
SELECT kind,kind,1,first_due,first_due FROM (SELECT kind,CASE WHEN kind='school-recovery' THEN unixepoch()*1000 ELSE deadline END AS first_due FROM
 (SELECT 'school-recovery' AS kind UNION ALL SELECT 'identity-cleanup'),
 (SELECT 1000 * unixepoch(date('now', '-2 hours', '+1 day') || ' 02:00') AS deadline));
