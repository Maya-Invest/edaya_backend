ALTER TABLE scheduler_work ADD COLUMN cron_expression TEXT;
UPDATE scheduler_work SET cron_expression='0 2 * * *' WHERE ref IN ('school-recovery','identity-cleanup');
CREATE TABLE scheduler_dispatch_windows (
  kind TEXT PRIMARY KEY,
  expression TEXT NOT NULL DEFAULT 'immediate'
);
INSERT INTO scheduler_dispatch_windows(kind) SELECT DISTINCT kind FROM scheduler_work;
CREATE INDEX scheduler_kind_ready ON scheduler_work(kind,available_at,ref) WHERE dead=0 AND available_at IS NOT NULL;
CREATE TRIGGER scheduler_register_kind AFTER INSERT ON scheduler_work
WHEN NOT EXISTS (SELECT 1 FROM scheduler_dispatch_windows WHERE kind=NEW.kind)
BEGIN INSERT OR IGNORE INTO scheduler_dispatch_windows(kind) VALUES(NEW.kind); END;
CREATE TRIGGER scheduler_register_changed_kind AFTER UPDATE OF kind ON scheduler_work
WHEN OLD.kind<>NEW.kind AND NOT EXISTS (SELECT 1 FROM scheduler_dispatch_windows WHERE kind=NEW.kind)
BEGIN INSERT OR IGNORE INTO scheduler_dispatch_windows(kind) VALUES(NEW.kind); END;
