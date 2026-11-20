CREATE TABLE "auth"."edaya_auth_rate_buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "edaya_auth_rate_buckets_expiry_idx" ON "auth"."edaya_auth_rate_buckets" USING btree ("expires_at");