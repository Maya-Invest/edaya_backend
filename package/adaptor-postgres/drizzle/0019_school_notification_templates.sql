CREATE TABLE "school_notification_templates" (
  "school_id" text PRIMARY KEY NOT NULL,
  "templates" jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
