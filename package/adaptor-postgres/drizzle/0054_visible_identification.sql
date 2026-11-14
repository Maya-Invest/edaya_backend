ALTER TABLE students RENAME COLUMN matricule TO identifier;
--> statement-breakpoint
ALTER TABLE students RENAME COLUMN national_matricule TO global_identifier;
--> statement-breakpoint
ALTER TABLE teachers RENAME COLUMN code TO identifier;
--> statement-breakpoint
ALTER INDEX teachers_school_code_uidx RENAME TO teachers_school_identifier_uidx;
--> statement-breakpoint
ALTER TABLE guardians RENAME COLUMN code TO identifier;
--> statement-breakpoint
ALTER INDEX guardians_school_code_uidx RENAME TO guardians_school_identifier_uidx;
--> statement-breakpoint
ALTER TABLE staff_members RENAME COLUMN code TO identifier;
--> statement-breakpoint
ALTER INDEX staff_members_school_code_uidx RENAME TO staff_members_school_identifier_uidx;
--> statement-breakpoint
ALTER TABLE grade_levels RENAME COLUMN label TO short_name;
--> statement-breakpoint
ALTER TABLE period_definitions RENAME COLUMN label TO name;
--> statement-breakpoint
ALTER TABLE placement_statuses RENAME COLUMN label TO name;
--> statement-breakpoint
DROP INDEX IF EXISTS subject_categories_school_name_uidx;
--> statement-breakpoint
DROP INDEX IF EXISTS academic_disciplines_school_code_unique;
--> statement-breakpoint
DROP INDEX IF EXISTS placement_statuses_school_code_unique;
--> statement-breakpoint
-- The old codes are useful abbreviations. A subject could have both a code and
-- a separate short name, so keep its code available for historical lookups.
ALTER TABLE academic_disciplines RENAME COLUMN code TO short_name;
--> statement-breakpoint
ALTER TABLE placement_statuses RENAME COLUMN code TO short_name;
--> statement-breakpoint
ALTER TABLE subjects RENAME COLUMN code TO legacy_code;
--> statement-breakpoint
ALTER TABLE academic_years ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE academic_periods ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE period_definitions ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE subject_categories ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE subject_matters ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE class_groups ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE activities ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE grade_scales ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE report_modules ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE catalog_services ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE disciplinary_actions ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE resources ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE staff_permission_profiles ADD COLUMN short_name text;
--> statement-breakpoint
ALTER TABLE staff_members ADD COLUMN name text, ADD COLUMN short_name text;
--> statement-breakpoint
-- Service accounts used their first and last names for display. Keep a supplied
-- service code as its abbreviation. Service IDs and API key bindings are independent.
UPDATE staff_members
SET name = coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), service_id),
    short_name = identifier,
    identifier = NULL
WHERE account_kind = 'service';
--> statement-breakpoint
-- Match person writes: compatibility normalization, trimmed whitespace, ASCII
-- uppercasing. Refuse ambiguous identifiers before enforcing uniqueness.
CREATE FUNCTION pg_temp.visible_identifier(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT nullif(translate(btrim(normalize(value, NFKC),
                          U&' \0009\000A\000B\000C\000D\1680\2028\2029\FEFF'),
                          'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '')
$$;
--> statement-breakpoint
DO $$
DECLARE
  relation_name text;
  bad_id text;
  conflicting_ids text[];
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['students', 'teachers', 'guardians', 'staff_members'] LOOP
    EXECUTE format($q$
      SELECT id FROM %I
      WHERE length(pg_temp.visible_identifier(identifier)) > 20
         OR pg_temp.visible_identifier(identifier) COLLATE "C" !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
      LIMIT 1
    $q$, relation_name) INTO bad_id;
    IF bad_id IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid legacy identifier on % row %. Correct its matricule or code and retry.', relation_name, bad_id;
    END IF;

    EXECUTE format($q$
      SELECT ARRAY[min(id), max(id)] FROM %I
      WHERE pg_temp.visible_identifier(identifier) IS NOT NULL
      GROUP BY school_id, pg_temp.visible_identifier(identifier) HAVING count(*) > 1
      LIMIT 1
    $q$, relation_name) INTO conflicting_ids;
    IF conflicting_ids IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate legacy identifier on % rows % and % in the same school. Reconcile their matricule or code and retry.',
        relation_name, conflicting_ids[1], conflicting_ids[2];
    END IF;

    EXECUTE format('UPDATE %I SET identifier = pg_temp.visible_identifier(identifier)
                    WHERE identifier IS DISTINCT FROM pg_temp.visible_identifier(identifier)', relation_name);
  END LOOP;
END $$;
--> statement-breakpoint
UPDATE subjects SET short_name = legacy_code WHERE nullif(btrim(short_name), '') IS NULL;
--> statement-breakpoint
-- Generate missing abbreviations from the display name. Preserve curated labels.
CREATE FUNCTION pg_temp.visible_short_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT nullif(btrim(regexp_replace(normalize(value, NFC),
    U&'[[:space:][:cntrl:]\007F-\009F\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g')), '')
$$;
--> statement-breakpoint
DO $$
DECLARE
  relation_name text;
  bad_id text;
  applicable text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'schools', 'grade_levels', 'subjects', 'academic_years', 'academic_periods',
    'period_definitions', 'subject_categories', 'subject_matters', 'class_groups',
    'activities', 'grade_scales', 'report_modules', 'catalog_services', 'disciplinary_actions',
    'resources', 'staff_permission_profiles', 'academic_disciplines', 'placement_statuses', 'staff_members'
  ] LOOP
    applicable := CASE WHEN relation_name = 'staff_members' THEN 'account_kind = ''service''' ELSE 'true' END;
    EXECUTE format($q$
      UPDATE %I SET short_name = CASE
        WHEN pg_temp.visible_short_name(short_name) IS NULL
          OR pg_temp.visible_short_name(short_name) = pg_temp.visible_short_name(name)
          THEN rtrim(left(pg_temp.visible_short_name(name), 32))
        ELSE pg_temp.visible_short_name(short_name) END
      WHERE %s
    $q$, relation_name, applicable);
    EXECUTE format('SELECT id FROM %I WHERE (%s) AND (short_name IS NULL OR length(short_name) > 32) LIMIT 1',
                   relation_name, applicable) INTO bad_id;
    IF bad_id IS NOT NULL THEN
      RAISE EXCEPTION 'Missing or overlong display abbreviation on % row %. Correct its legacy name, label or code and retry.', relation_name, bad_id;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
DROP FUNCTION pg_temp.visible_identifier(text);
--> statement-breakpoint
DROP FUNCTION pg_temp.visible_short_name(text);
--> statement-breakpoint
ALTER TABLE students ADD CONSTRAINT students_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
ALTER TABLE teachers ADD CONSTRAINT teachers_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
ALTER TABLE guardians ADD CONSTRAINT guardians_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
ALTER TABLE staff_members ADD CONSTRAINT staff_members_identifier_format CHECK (identifier IS NULL OR (length(identifier) BETWEEN 1 AND 20 AND identifier ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'));
--> statement-breakpoint
CREATE UNIQUE INDEX students_school_identifier_uidx ON students (school_id, identifier);

--> statement-breakpoint
-- 0055 makes person identifiers optional. Allow missing IDs throughout the upgrade.
ALTER TABLE staff_members ADD CONSTRAINT staff_visible_identity CHECK (account_kind = 'human' OR (account_kind = 'service' AND identifier IS NULL AND name IS NOT NULL AND short_name IS NOT NULL));
--> statement-breakpoint
ALTER TABLE schools ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE grade_levels ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE academic_years ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE academic_periods ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE period_definitions ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE subject_categories ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE subjects ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE subject_matters ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE class_groups ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE activities ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE grade_scales ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE report_modules ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE catalog_services ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE disciplinary_actions ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE resources ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE staff_permission_profiles ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE academic_disciplines ALTER COLUMN short_name SET NOT NULL;
--> statement-breakpoint
ALTER TABLE placement_statuses ALTER COLUMN short_name SET NOT NULL;
