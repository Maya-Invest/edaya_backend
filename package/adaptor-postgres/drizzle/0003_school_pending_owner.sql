ALTER TABLE "schools" ADD COLUMN "pending_owner_staff_id" text;
--> statement-breakpoint
CREATE INDEX "schools_pending_owner_staff_id_idx" ON "schools" USING btree ("pending_owner_staff_id");
