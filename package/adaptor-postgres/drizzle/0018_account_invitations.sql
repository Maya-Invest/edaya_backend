CREATE TABLE "account_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "kind" text NOT NULL,
  "target_id" text NOT NULL,
  "contact_channel" text NOT NULL,
  "contact_value" text NOT NULL,
  "token_hash" text NOT NULL,
  "status" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "accepted_subject_id" text,
  "created_by_staff_id" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "last_sent_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "account_invitations_token_hash_idx" ON "account_invitations" ("token_hash");
--> statement-breakpoint
CREATE INDEX "account_invitations_school_target_idx" ON "account_invitations" ("school_id", "target_id", "kind");
--> statement-breakpoint
CREATE INDEX "account_invitations_status_expires_idx" ON "account_invitations" ("status", "expires_at");
