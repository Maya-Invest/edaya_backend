DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM account_invitations GROUP BY token_hash HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate account_invitations.token_hash rows block unique index. Resolve duplicates before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM account_invitations
    WHERE status = 'pending'
    GROUP BY school_id, kind, target_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pending account_invitations per target block unique index. Resolve duplicates before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_members WHERE subject_id IS NOT NULL GROUP BY school_id, subject_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate staff_members (school_id, subject_id) rows block unique index. Resolve duplicates before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM guardians WHERE subject_id IS NOT NULL GROUP BY school_id, subject_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate guardians (school_id, subject_id) rows block unique index. Resolve duplicates before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM teachers WHERE subject_id IS NOT NULL GROUP BY school_id, subject_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate teachers (school_id, subject_id) rows block unique index. Resolve duplicates before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM students WHERE subject_id IS NOT NULL GROUP BY school_id, subject_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate students (school_id, subject_id) rows block unique index. Resolve duplicates before migrating.';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "account_invitations"
SET "status" = 'revoked'
WHERE "contact_channel" = 'phone' AND "status" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX "account_invitations_token_hash_uidx" ON "account_invitations" ("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_invitations_pending_target_uidx"
  ON "account_invitations" ("school_id", "kind", "target_id")
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_school_subject_uidx"
  ON "staff_members" ("school_id", "subject_id")
  WHERE "subject_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_school_subject_uidx"
  ON "guardians" ("school_id", "subject_id")
  WHERE "subject_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_school_subject_uidx"
  ON "teachers" ("school_id", "subject_id")
  WHERE "subject_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "students_school_subject_uidx"
  ON "students" ("school_id", "subject_id")
  WHERE "subject_id" IS NOT NULL;
