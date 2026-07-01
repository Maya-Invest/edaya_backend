ALTER TABLE "staff_members" ADD COLUMN "onboarding_wizard_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "staff_members" ADD COLUMN "onboarding_max_reached_step" integer;
