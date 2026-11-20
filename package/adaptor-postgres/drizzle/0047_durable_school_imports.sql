ALTER TABLE staff_members ADD COLUMN phone text;
--> statement-breakpoint
CREATE TABLE school_import_batches (
  school_id text NOT NULL REFERENCES schools(id),
  id text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (school_id, id),
  CHECK (data->>'defaultOnExisting' IN ('S', 'M', 'O'))
);
--> statement-breakpoint
CREATE INDEX school_import_batches_history ON school_import_batches (school_id, created_at DESC, id);
--> statement-breakpoint
CREATE TABLE school_import_files (
  school_id text NOT NULL,
  batch_id text NOT NULL,
  id text NOT NULL,
  file_id text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  data jsonb NOT NULL,
  PRIMARY KEY (school_id, id),
  UNIQUE (school_id, batch_id, file_id, revision),
  FOREIGN KEY (school_id, batch_id) REFERENCES school_import_batches(school_id, id)
);
--> statement-breakpoint
CREATE TABLE school_import_rows (
  school_id text NOT NULL,
  batch_id text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (school_id, batch_id, id),
  FOREIGN KEY (school_id, batch_id) REFERENCES school_import_batches(school_id, id)
);
--> statement-breakpoint
CREATE TABLE school_import_identities (
  school_id text NOT NULL REFERENCES schools(id),
  type text NOT NULL,
  source_key text NOT NULL,
  target_id text NOT NULL,
  generated_code text,
  bound boolean NOT NULL DEFAULT false,
  PRIMARY KEY (school_id, type, source_key)
);
--> statement-breakpoint
CREATE TABLE school_import_outcomes (
  school_id text NOT NULL,
  batch_id text NOT NULL,
  row_id text NOT NULL,
  operation_id text NOT NULL,
  input_digest text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (school_id, operation_id),
  UNIQUE (school_id, batch_id, row_id, input_digest),
  FOREIGN KEY (school_id, batch_id, row_id) REFERENCES school_import_rows(school_id, batch_id, id)
);
--> statement-breakpoint
CREATE TABLE school_import_row_revisions (
  school_id text NOT NULL,
  batch_id text NOT NULL,
  row_id text NOT NULL,
  revision_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (school_id, batch_id, row_id, revision_id),
  FOREIGN KEY (school_id, revision_id) REFERENCES school_import_files(school_id, id),
  FOREIGN KEY (school_id, batch_id) REFERENCES school_import_batches(school_id, id)
);
