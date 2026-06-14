ALTER TABLE "staff_members" ADD COLUMN "account_kind" text DEFAULT 'human' NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "service_id" text;
--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "created_by_subject_id" text;
--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "service_elevated" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "service_api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "staff_member_id" text NOT NULL,
  "school_id" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "created_by_subject_id" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "last_used_at" timestamp
);
