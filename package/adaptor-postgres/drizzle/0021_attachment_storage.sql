ALTER TABLE "attachments" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "checksum" text;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "file_url" DROP NOT NULL;
