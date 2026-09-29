CREATE TABLE "auth"."edaya_delegation_children" (
	"grant_id" text NOT NULL,
	"student_id" text NOT NULL,
	CONSTRAINT "edaya_delegation_children_grant_id_student_id_pk" PRIMARY KEY("grant_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."edaya_delegation_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"client_id" text NOT NULL,
	"guardian_id" text NOT NULL,
	"school_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth"."edaya_delegation_scopes" (
	"grant_id" text NOT NULL,
	"scope" text NOT NULL,
	CONSTRAINT "edaya_delegation_scopes_grant_id_scope_pk" PRIMARY KEY("grant_id","scope")
);
--> statement-breakpoint
ALTER TABLE "auth"."edaya_delegation_children" ADD CONSTRAINT "edaya_delegation_children_grant_id_edaya_delegation_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "auth"."edaya_delegation_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."edaya_delegation_grants" ADD CONSTRAINT "edaya_delegation_grants_subject_id_user_id_fk" FOREIGN KEY ("subject_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."edaya_delegation_grants" ADD CONSTRAINT "edaya_delegation_grants_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_client"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."edaya_delegation_scopes" ADD CONSTRAINT "edaya_delegation_scopes_grant_id_edaya_delegation_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "auth"."edaya_delegation_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edaya_delegation_grants_subject_idx" ON "auth"."edaya_delegation_grants" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "edaya_delegation_grants_client_idx" ON "auth"."edaya_delegation_grants" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "edaya_delegation_grants_expiry_idx" ON "auth"."edaya_delegation_grants" USING btree ("expires_at");