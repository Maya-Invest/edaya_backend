# Mobile session history

The additive `get-student-session-history` and `get-teacher-session-history` school queries accept an authorized pupil or teacher identity, `academicYearId`, and inclusive school-calendar `startDate` / `endDate`. Teacher queries also accept class and class-subject filters. Windows cannot exceed 31 days; responses include the clamped bounds, school timezone, `hasMore`, and newest-first occurrence entries. Continue with the day before the returned start, stopping at the selected academic year's start.

History includes only ended, non-cancelled occurrences. Pupil history combines enrollment/subject participation at the occurrence time with retained attendance and assessment records. Missing attendance is `null`, not present or absent. Daily attendance has `kind: daily` and keeps its school-calendar date. Attendance summaries preserve justification status and reason. Teacher completion uses the saved attendance workflow (including legacy recorded calls) and saved logbook/chapter content, without comparing to today's class roster.

Every request reauthorizes the selected actor, pupil/teacher, school, and academic year. Existing timetable queries retain their Home behavior. These endpoints add no pupil identity grouping, account persistence or database migration.

Deploy this backend contract and regenerated API artifacts before publishing the mobile update. Older clients continue to use the existing timetable and attendance endpoints. Then release the mobile clients that use the new Agenda History tabs and Presence redirects. Do not release the mobile history UI against a backend lacking these queries.

Regression coverage: `package/domain-service/tests/services/queries/session-history.integration.test.ts` checks missing attendance, closed enrollments, daily records, school-day boundaries, saved completion, window limits, and revoked/foreign access. Mobile registered Agenda journeys cover route selection and backward loading.
