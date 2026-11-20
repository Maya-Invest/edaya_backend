ALTER TABLE "schools"
  ADD COLUMN "postal_address" text,
  ADD COLUMN "phone" text,
  ADD COLUMN "email" text,
  ADD COLUMN "school_code" text,
  ADD COLUMN "issuing_name" text,
  ADD COLUMN "logo_attachment_id" text,
  ADD COLUMN "crest_attachment_id" text,
  ADD COLUMN "stamp_attachment_id" text,
  ADD COLUMN "signature_attachment_id" text,
  ADD COLUMN "issuance_asset_version" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE "document_issuances" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "template_key" text NOT NULL,
  "template_version" text NOT NULL,
  "locale" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "source_version" text NOT NULL,
  "student_id" text,
  "class_group_id" text,
  "snapshot" jsonb NOT NULL,
  "issuer_actor_id" text NOT NULL,
  "audience" text NOT NULL,
  "request_id" text NOT NULL,
  "number" text,
  "status" text NOT NULL,
  "artifact_attachment_id" text,
  "artifact_sha256" text,
  "artifact_size" integer,
  "replaces_issuance_id" text,
  "replaced_by_issuance_id" text,
  "voided_at" timestamp,
  "void_reason" text,
  "failure_code" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "document_issuances_school_id_idx" ON "document_issuances" ("school_id");
--> statement-breakpoint
CREATE INDEX "document_issuances_student_id_idx" ON "document_issuances" ("student_id");
--> statement-breakpoint
CREATE INDEX "document_issuances_class_group_id_idx" ON "document_issuances" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "document_issuances_source_idx" ON "document_issuances" ("school_id", "template_key", "source_id");
--> statement-breakpoint
CREATE INDEX "document_issuances_status_idx" ON "document_issuances" ("school_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_issuances_request_uidx" ON "document_issuances" ("school_id", "template_key", "source_id", "request_id");
--> statement-breakpoint
CREATE TABLE "document_number_series" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "document_kind" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "next_value" integer NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "document_number_series_identity_uidx" ON "document_number_series" ("school_id", "document_kind", "academic_year_id");
--> statement-breakpoint
CREATE INDEX "document_number_series_school_id_idx" ON "document_number_series" ("school_id");
