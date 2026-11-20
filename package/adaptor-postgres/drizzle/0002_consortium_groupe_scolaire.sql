CREATE TABLE "consortiums" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"owner_subject_id" text NOT NULL,
	"shared_rules" jsonb DEFAULT '{"structureTemplateIds":[]}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "consortium_id" text;
--> statement-breakpoint
CREATE INDEX "consortiums_owner_subject_id_idx" ON "consortiums" USING btree ("owner_subject_id");
--> statement-breakpoint
CREATE INDEX "schools_consortium_id_idx" ON "schools" USING btree ("consortium_id");
