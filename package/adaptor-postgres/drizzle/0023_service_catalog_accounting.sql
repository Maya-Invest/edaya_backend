DROP TABLE IF EXISTS "payments";
--> statement-breakpoint
DROP TABLE IF EXISTS "student_fees";
--> statement-breakpoint
DROP TABLE IF EXISTS "fees";
--> statement-breakpoint
CREATE TABLE "catalog_services" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "enrollment_mode" text NOT NULL,
  "billing_kind" text NOT NULL,
  "default_price" integer NOT NULL,
  "currency" text NOT NULL,
  "billing_terms" jsonb NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "catalog_services_school_id_idx" ON "catalog_services" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX "catalog_services_academic_year_id_idx" ON "catalog_services" USING btree ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "catalog_services_school_status_idx" ON "catalog_services" USING btree ("school_id", "status");
--> statement-breakpoint
CREATE TABLE "student_service_enrollments" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "student_id" text NOT NULL,
  "catalog_service_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "status" text NOT NULL,
  "source" text NOT NULL,
  "accepted_terms" jsonb NOT NULL,
  "enrolled_at" timestamp NOT NULL,
  "cancelled_at" timestamp,
  "cancellation_reason" text,
  "cancelled_by_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "student_service_enrollments_school_id_idx" ON "student_service_enrollments" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX "student_service_enrollments_student_id_idx" ON "student_service_enrollments" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX "student_service_enrollments_catalog_service_id_idx" ON "student_service_enrollments" USING btree ("catalog_service_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "student_service_enrollments_active_uidx"
  ON "student_service_enrollments" ("student_id", "catalog_service_id", "academic_year_id")
  WHERE "status" = 'active';
--> statement-breakpoint
CREATE TABLE "student_charges" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "student_id" text NOT NULL,
  "enrollment_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "label" text NOT NULL,
  "expected_amount" integer NOT NULL,
  "allocated_amount" integer NOT NULL,
  "adjustment_amount" integer NOT NULL,
  "adjustment_reason" text,
  "adjusted_by_id" text,
  "adjusted_at" timestamp,
  "waiver_amount" integer NOT NULL,
  "waiver_reason" text,
  "waived_by_id" text,
  "waived_at" timestamp,
  "currency" text NOT NULL,
  "due_date" timestamp,
  "status" text NOT NULL,
  "cancellation_reason" text,
  "cancelled_by_id" text,
  "cancelled_at" timestamp,
  "installments" jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "student_charges_school_id_idx" ON "student_charges" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX "student_charges_student_id_idx" ON "student_charges" USING btree ("student_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "student_charges_enrollment_uidx" ON "student_charges" USING btree ("enrollment_id");
--> statement-breakpoint
CREATE INDEX "student_charges_academic_year_id_idx" ON "student_charges" USING btree ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "student_charges_status_idx" ON "student_charges" USING btree ("school_id", "status");
--> statement-breakpoint
CREATE TABLE "student_year_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "student_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "currency" text NOT NULL,
  "available_balance" integer NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "student_year_accounts_school_id_idx" ON "student_year_accounts" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX "student_year_accounts_student_id_idx" ON "student_year_accounts" USING btree ("student_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "student_year_accounts_identity_uidx"
  ON "student_year_accounts" ("school_id", "student_id", "academic_year_id", "currency");
--> statement-breakpoint
CREATE TABLE "payments" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "account_id" text NOT NULL,
  "academic_year_id" text NOT NULL,
  "kind" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL,
  "payment_date" timestamp NOT NULL,
  "method" text NOT NULL,
  "status" text NOT NULL,
  "reference" text,
  "notes" text,
  "recorded_by_id" text,
  "reverses_payment_id" text,
  "reversed_by_payment_id" text,
  "reversed_at" timestamp,
  "reversed_by_id" text,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payments_school_id_idx" ON "payments" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX "payments_account_id_idx" ON "payments" USING btree ("account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reference_uidx"
  ON "payments" ("school_id", "academic_year_id", "reference")
  WHERE "reference" is not null;
--> statement-breakpoint
CREATE TABLE "allocations" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "account_id" text NOT NULL,
  "charge_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL,
  "kind" text NOT NULL,
  "caused_by_payment_id" text,
  "reverses_allocation_id" text,
  "effective_at" timestamp NOT NULL,
  "recorded_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "allocations_school_id_idx" ON "allocations" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX "allocations_account_id_idx" ON "allocations" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "allocations_charge_id_idx" ON "allocations" USING btree ("charge_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_reverse_uidx"
  ON "allocations" ("reverses_allocation_id")
  WHERE "kind" = 'reverse';
--> statement-breakpoint
CREATE TABLE "student_account_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "school_id" text NOT NULL,
  "account_id" text NOT NULL,
  "direction" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL,
  "source_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "command_id" text,
  "effective_at" timestamp NOT NULL,
  "recorded_at" timestamp NOT NULL,
  "resulting_available_balance" integer NOT NULL,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "student_account_entries_school_id_idx" ON "student_account_entries" USING btree ("school_id");
--> statement-breakpoint
CREATE INDEX "student_account_entries_account_id_idx" ON "student_account_entries" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "student_account_entries_recorded_at_idx" ON "student_account_entries" USING btree ("account_id", "recorded_at");
