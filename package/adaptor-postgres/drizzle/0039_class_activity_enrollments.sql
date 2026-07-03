CREATE TABLE "class_activity_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "class_activity_enrollments_activity_id_idx" ON "class_activity_enrollments" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "class_activity_enrollments_class_group_id_idx" ON "class_activity_enrollments" USING btree ("class_group_id");
