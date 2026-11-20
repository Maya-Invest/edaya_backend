CREATE TABLE cron_occurrences (
  id text PRIMARY KEY,
  school_id text NOT NULL,
  schedule_id text NOT NULL,
  job_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  scheduled_for timestamptz NOT NULL,
  as_of timestamptz NOT NULL,
  request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, schedule_id, scheduled_for)
);
