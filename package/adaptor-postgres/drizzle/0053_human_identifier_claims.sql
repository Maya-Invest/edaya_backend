-- Bootstrap preparation precedes school creation, so these tables deliberately
-- have no school/entity foreign key. Claims survive business-record deletion.
CREATE TABLE human_identifier_counters (
  school_id text NOT NULL,
  profile_group text NOT NULL CHECK (profile_group IN ('students', 'teachers', 'guardians', 'staff')),
  counter numeric(16, 0) NOT NULL CHECK (counter BETWEEN 1 AND 9999999999999999),
  PRIMARY KEY (school_id, profile_group)
);
--> statement-breakpoint
CREATE TABLE human_identifier_claims (
  school_id text NOT NULL,
  profile_group text NOT NULL CHECK (profile_group IN ('students', 'teachers', 'guardians', 'staff')),
  identifier text COLLATE "C" NOT NULL CHECK (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  entity_id text NOT NULL,
  caller_id text NOT NULL,
  attempt_id text NOT NULL,
  review_token text NOT NULL,
  generated boolean NOT NULL,
  state text NOT NULL CHECK (state IN ('reserved', 'active', 'retired')),
  PRIMARY KEY (school_id, profile_group, identifier),
  UNIQUE (school_id, profile_group, caller_id, attempt_id),
  UNIQUE (review_token)
);
--> statement-breakpoint
CREATE UNIQUE INDEX human_identifier_one_active_per_profile
  ON human_identifier_claims (school_id, profile_group, entity_id) WHERE state = 'active';
