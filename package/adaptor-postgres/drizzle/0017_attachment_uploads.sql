CREATE TABLE attachment_uploads (
  attachment_id text PRIMARY KEY,
  school_id text NOT NULL REFERENCES schools(id),
  caller_id text NOT NULL,
  attachment jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  completed_storage_key text,
  checksum text,
  completed_at timestamptz,
  CONSTRAINT attachment_upload_identity CHECK ((
    attachment->>'id' = attachment_id AND attachment->>'schoolId' = school_id
    AND attachment->>'status' = 'pending_upload'
  ) IS TRUE),
  CONSTRAINT attachment_upload_completion CHECK ((
    (completed_storage_key IS NULL AND checksum IS NULL AND completed_at IS NULL)
    OR (completed_storage_key IS NOT NULL AND checksum ~ '^[0-9a-f]{64}$' AND completed_at IS NOT NULL)
  ) IS TRUE)
);
--> statement-breakpoint
CREATE INDEX attachment_uploads_pending_expiry ON attachment_uploads (expires_at, attachment_id)
  WHERE completed_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX attachment_uploads_storage_key ON attachment_uploads ((attachment->>'storageKey'));
