CREATE TABLE identity.teacher_quick_code (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  teacher_id text NOT NULL,
  school_id text NOT NULL,
  account_id text NOT NULL REFERENCES identity.account(id),
  identifier_id text NOT NULL REFERENCES identity.identifier(id),
  digest text NOT NULL UNIQUE,
  channel text NOT NULL,
  destination_hint text NOT NULL,
  expires_at bigint,
  status text NOT NULL CHECK (status IN ('pending','active','failed','uncertain','replaced'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX teacher_quick_active ON identity.teacher_quick_code(school_id,teacher_id) WHERE status='active';
--> statement-breakpoint
CREATE INDEX teacher_quick_history ON identity.teacher_quick_code(school_id,teacher_id,sequence DESC);
