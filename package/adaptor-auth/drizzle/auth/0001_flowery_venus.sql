
CREATE TABLE "auth"."edaya_access_tokens" (
	"digest" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."edaya_access_tokens" ADD CONSTRAINT "edaya_access_tokens_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "auth"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edaya_access_tokens_session_idx" ON "auth"."edaya_access_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "edaya_access_tokens_expiry_idx" ON "auth"."edaya_access_tokens" USING btree ("expires_at");