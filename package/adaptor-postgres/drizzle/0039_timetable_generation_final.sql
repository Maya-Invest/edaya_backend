ALTER TABLE lesson_sessions ALTER COLUMN timetable_generated TYPE boolean
  USING COALESCE(timetable_generated IN ('draft', 'published'), false);
--> statement-breakpoint
ALTER TABLE lesson_sessions ALTER COLUMN timetable_generated SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE lesson_sessions ALTER COLUMN timetable_generated SET NOT NULL;
--> statement-breakpoint
DELETE FROM staff_permission_assignments WHERE permission = 'TIMETABLE_PUBLISH';
--> statement-breakpoint
DELETE FROM staff_manual_permission_assignments WHERE permission = 'TIMETABLE_PUBLISH';
--> statement-breakpoint
UPDATE staff_assignments SET permissions = permissions - 'TIMETABLE_PUBLISH' WHERE permissions ? 'TIMETABLE_PUBLISH';
--> statement-breakpoint
UPDATE staff_permission_profiles SET permissions = permissions - 'TIMETABLE_PUBLISH' WHERE permissions ? 'TIMETABLE_PUBLISH';
