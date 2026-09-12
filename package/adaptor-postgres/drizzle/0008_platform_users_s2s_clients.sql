CREATE TABLE "platform_users" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"email" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_subject_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "s2s_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"client_id" text NOT NULL,
	"access_class" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by_subject_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_subject_id_uidx" ON "platform_users" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_email_uidx" ON "platform_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "s2s_clients_key_hash_uidx" ON "s2s_clients" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "s2s_clients_school_id_idx" ON "s2s_clients" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "s2s_clients_school_client_idx" ON "s2s_clients" USING btree ("school_id","client_id");