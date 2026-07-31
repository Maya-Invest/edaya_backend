ALTER TABLE "guardians" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_school_code_uidx" ON "guardians" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_school_code_uidx" ON "staff_members" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "teachers_school_id_idx" ON "teachers" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_school_code_uidx" ON "teachers" USING btree ("school_id","code");