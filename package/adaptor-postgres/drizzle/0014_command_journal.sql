CREATE TABLE command_receipts (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  command TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  result_mode TEXT NOT NULL CHECK (result_mode IN ('ordinary', 'secret-display')),
  status TEXT NOT NULL CHECK (status IN ('claimed', 'completed')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (school_id, command, caller_id, request_id),
  CHECK ((status = 'claimed' AND result IS NULL AND completed_at IS NULL)
    OR (status = 'completed' AND result IS NOT NULL AND completed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE command_audit (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES command_receipts(id),
  school_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  event TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX command_audit_resource_idx ON command_audit (school_id, resource_type, resource_id, recorded_at);
--> statement-breakpoint
CREATE TABLE command_outbox (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES command_receipts(id),
  school_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX command_outbox_pending_idx ON command_outbox (status, next_attempt_at, created_at);
