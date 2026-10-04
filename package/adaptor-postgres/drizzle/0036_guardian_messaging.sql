CREATE TABLE conversations (
 id text PRIMARY KEY, school_id text NOT NULL REFERENCES schools(id),
 guardian_id text NOT NULL, destination text NOT NULL CHECK(destination IN ('school','teacher')),
 status text NOT NULL CHECK(status IN ('awaiting_school','awaiting_guardian','resolved')),
 updated_at timestamptz NOT NULL, awaiting_since timestamptz NOT NULL, payload jsonb NOT NULL, UNIQUE(school_id,id)
);
--> statement-breakpoint
CREATE INDEX conversations_school_queue ON conversations(school_id,destination,status,awaiting_since,id);
--> statement-breakpoint
CREATE TABLE conversation_messages (
 id text PRIMARY KEY, school_id text NOT NULL, conversation_id text NOT NULL,
 sequence integer NOT NULL CHECK(sequence>0), author_kind text NOT NULL CHECK(author_kind IN ('guardian','teacher','staff')), payload jsonb NOT NULL,
 UNIQUE(conversation_id,sequence),
 FOREIGN KEY(school_id,conversation_id) REFERENCES conversations(school_id,id)
);
--> statement-breakpoint
CREATE TABLE conversation_reads (
 school_id text NOT NULL, conversation_id text NOT NULL,
 profile_kind text NOT NULL CHECK(profile_kind IN ('guardian','teacher','staff')), profile_id text NOT NULL, through_sequence integer NOT NULL CHECK(through_sequence>=0),
 PRIMARY KEY(school_id,conversation_id,profile_kind,profile_id),
 FOREIGN KEY(school_id,conversation_id) REFERENCES conversations(school_id,id)
);
