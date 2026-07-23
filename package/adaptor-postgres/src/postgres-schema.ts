import { boolean, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from './postgres-indexes'

// 1. School Table
export const schools = pgTable('schools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull(),
  ownerSubjectId: text('owner_subject_id'),
  type: text('type'),
  country: text('country'),
  city: text('city'),
  enforceScheduleConflicts: boolean('enforce_schedule_conflicts').notNull().default(false),
  timetableEnforceWorkloadFulfillment: boolean('timetable_enforce_workload_fulfillment').notNull().default(true),
  timetableExcludeBreakSlots: boolean('timetable_exclude_break_slots').notNull().default(true),
  timetableMinDayGapSameSubject: integer('timetable_min_day_gap_same_subject').notNull().default(1),
  timetablePreferredPeriodDefinitionIds: jsonb('timetable_preferred_period_definition_ids').notNull().default([]),
  timetableAllowUnassignedTeacherPlacements: boolean('timetable_allow_unassigned_teacher_placements').notNull().default(false),
  timetableUseHomeroomTeacherFallback: boolean('timetable_use_homeroom_teacher_fallback').notNull().default(false),
  timetableGenerationMode: text('timetable_generation_mode').notNull().default('weekly'),
  timetableMinPeriodSpan: integer('timetable_min_period_span').notNull().default(1),
  timetableMaxPeriodSpan: integer('timetable_max_period_span').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
})

// 2. Academic Year Table
export const academicYears = pgTable('academic_years', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('academic_years', table))

// 3. Academic Period Table
export const academicPeriods = pgTable('academic_periods', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('academic_periods', table))

// 4. Period Definition Table
export const periodDefinitions = pgTable('period_definitions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  label: text('label').notNull(),
  dayOfWeek: text('day_of_week').notNull(),
  order: integer('order_val').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isBreak: boolean('is_break').notNull().default(false),
  isTeachingSlot: boolean('is_teaching_slot').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('period_definitions', table))

// 5. Grade Level Table
export const gradeLevels = pgTable('grade_levels', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  order: integer('order_val').notNull(),
  cycle: text('cycle'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('grade_levels', table))

// 6. Staff Member Table
export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  code: text('code'),
  photoUrl: text('photo_url'),
  email: text('email'),
  notificationEmail: text('notification_email'),
  notificationPhone: text('notification_phone'),
  subjectId: text('subject_id'),
  accountKind: text('account_kind').notNull().default('human'),
  serviceId: text('service_id'),
  createdBySubjectId: text('created_by_subject_id'),
  serviceElevated: boolean('service_elevated').notNull().default(false),
  isActive: boolean('is_active').notNull(),
  onboardingWizardCompletedAt: timestamp('onboarding_wizard_completed_at', { mode: 'date' }),
  onboardingMaxReachedStep: integer('onboarding_max_reached_step'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('staff_members', table))

export const serviceApiKeys = pgTable('service_api_keys', {
  id: text('id').primaryKey(),
  staffMemberId: text('staff_member_id').notNull(),
  schoolId: text('school_id').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  createdBySubjectId: text('created_by_subject_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  revokedAt: timestamp('revoked_at', { mode: 'date' }),
  lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
}, table => definePerformanceIndexes('service_api_keys', table))

export const cronJobSchedules = pgTable('cron_job_schedules', {
  id: text('id').primaryKey(),
  jobKey: text('job_key').notNull(),
  cronExpression: text('cron_expression').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  nextRunAt: timestamp('next_run_at', { mode: 'date' }).notNull(),
  lastDispatchedAt: timestamp('last_dispatched_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('cron_job_schedules', table))

export const accountInvitations = pgTable('account_invitations', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  kind: text('kind').notNull(),
  targetId: text('target_id').notNull(),
  contactChannel: text('contact_channel').notNull(),
  contactValue: text('contact_value').notNull(),
  tokenHash: text('token_hash').notNull(),
  status: text('status').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  acceptedAt: timestamp('accepted_at', { mode: 'date' }),
  acceptedSubjectId: text('accepted_subject_id'),
  createdByStaffId: text('created_by_staff_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  lastSentAt: timestamp('last_sent_at', { mode: 'date' }),
}, table => definePerformanceIndexes('account_invitations', table))

export const schoolNotificationTemplates = pgTable('school_notification_templates', {
  id: text('school_id').primaryKey(),
  templates: jsonb('templates').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
})

export const staffAssignments = pgTable('staff_assignments', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull(),
  academicYearId: text('academic_year_id'),
  role: text('role').notNull(),
  permissions: jsonb('permissions').notNull().default([]),
  classGroupId: text('class_group_id'),
  classSubjectId: text('class_subject_id'),
  lessonSessionId: text('lesson_session_id'),
  activitySessionId: text('activity_session_id'),
  assessmentId: text('assessment_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('staff_assignments', table))

export const staffPermissionAssignments = pgTable('staff_permission_assignments', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  permission: text('permission').notNull(),
  scopeIds: text('scope_ids').notNull().default(''),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  sourceStaffAssignmentId: text('source_staff_assignment_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('staff_permission_assignments', table))

// 8. Attachment Table
export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  ownerKind: text('owner_kind').notNull(),
  ownerId: text('owner_id').notNull(),
  fileName: text('file_name').notNull(),
  storageKey: text('storage_key'),
  fileUrl: text('file_url'),
  status: text('status').notNull().default('ready'),
  checksum: text('checksum'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  uploadedById: text('uploaded_by_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('attachments', table))

// 9. Resource Table
export const resources = pgTable('resources', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  kind: text('kind').notNull(),
  capacity: integer('capacity'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('resources', table))

export const resourceAssignments = pgTable('resource_assignments', {
  id: text('id').primaryKey(),
  resourceId: text('resource_id').notNull(),
  lessonSessionId: text('lesson_session_id'),
  activitySessionId: text('activity_session_id'),
  assessmentId: text('assessment_id'),
  classGroupId: text('class_group_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('resource_assignments', table))

// 11. Fee Table
export const fees = pgTable('fees', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  defaultAmount: integer('default_amount').notNull(),
  currency: text('currency').notNull(),
  installments: jsonb('installments').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('fees', table))

// 12. Student Fee Table
export const studentFees = pgTable('student_fees', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  feeId: text('fee_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  expectedAmount: integer('expected_amount').notNull(),
  paidAmount: integer('paid_amount').notNull(),
  adjustmentAmount: integer('adjustment_amount').notNull(),
  adjustmentReason: text('adjustment_reason'),
  adjustedById: text('adjusted_by_id'),
  adjustedAt: timestamp('adjusted_at', { mode: 'date' }),
  currency: text('currency').notNull(),
  dueDate: timestamp('due_date', { mode: 'date' }),
  status: text('status').notNull(),
  cancellationReason: text('cancellation_reason'),
  cancelledById: text('cancelled_by_id'),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  installments: jsonb('installments').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
}, table => definePerformanceIndexes('student_fees', table))

// 13. Payment Table
export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  studentFeeId: text('student_fee_id').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  paymentDate: timestamp('payment_date', { mode: 'date' }).notNull(),
  method: text('method').notNull(),
  status: text('status').notNull(),
  reference: text('reference'),
  notes: text('notes'),
  recordedById: text('recorded_by_id'),
  reversedAt: timestamp('reversed_at', { mode: 'date' }),
  reversedById: text('reversed_by_id'),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  cancelledById: text('cancelled_by_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('payments', table))

// 14. Schedule Table
export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  scheduleKind: text('schedule_kind').notNull(),
  classSubjectId: text('class_subject_id'),
  activityId: text('activity_id'),
  title: text('title').notNull(),
  isRecurring: boolean('is_recurring').notNull(),
  dayOfWeek: text('day_of_week'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  specificDate: timestamp('specific_date', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('schedules', table))

export const lessonSessions = pgTable('lesson_sessions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  scheduleId: text('schedule_id'),
  timetableGenerated: text('timetable_generated'),
  timetableTeacherIds: jsonb('timetable_teacher_ids').notNull().default([]),
  classSubjectId: text('class_subject_id').notNull(),
  status: text('status').notNull(),
  isException: boolean('is_exception').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  calendarDate: timestamp('calendar_date', { mode: 'date' }).notNull(),
  displayLabel: text('display_label').notNull(),
  sessionNote: text('session_note'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('lesson_sessions', table))

export const activitySessions = pgTable('activity_sessions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  scheduleId: text('schedule_id').notNull(),
  activityId: text('activity_id').notNull(),
  status: text('status').notNull(),
  isException: boolean('is_exception').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  calendarDate: timestamp('calendar_date', { mode: 'date' }).notNull(),
  displayLabel: text('display_label').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('activity_sessions', table))

export const attendances = pgTable('attendances', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  displayLabel: text('display_label').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('attendances', table))

// 16. Calendar Event Table
export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  kind: text('kind').notNull(),
  isNonSchoolDay: boolean('is_non_school_day').notNull(),
  scopeKind: text('scope_kind').notNull(),
  scopeId: text('scope_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('calendar_events', table))

// 17. Attendance Record Table
export const attendanceRecords = pgTable('attendance_records', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  attendanceId: text('attendance_id'),
  lessonSessionId: text('lesson_session_id'),
  activitySessionId: text('activity_session_id'),
  assessmentId: text('assessment_id'),
  date: timestamp('date', { mode: 'date' }).notNull(),
  status: text('status').notNull(),
  justificationStatus: text('justification_status').notNull(),
  reason: text('reason'),
  notes: text('notes'),
  justifiedAt: timestamp('justified_at', { mode: 'date' }),
  justifiedByStaffId: text('justified_by_staff_id'),
  correctedAt: timestamp('corrected_at', { mode: 'date' }),
  correctedByStaffId: text('corrected_by_staff_id'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('attendance_records', table))

// 18. Announcement Table
export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdBy: text('created_by'),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
}, table => definePerformanceIndexes('announcements', table))

export const announcementTargets = pgTable('announcement_targets', {
  id: text('id').primaryKey(),
  announcementId: text('announcement_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('announcement_targets', table))

// 20. Message Delivery Table
export const messageDeliveries = pgTable('message_deliveries', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  announcementId: text('announcement_id'),
  eventKey: text('event_key'),
  subjectId: text('subject_id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  recipientKind: text('recipient_kind'),
  recipientId: text('recipient_id'),
  status: text('status').notNull(),
  providerMessageId: text('provider_message_id'),
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at', { mode: 'date' }),
  readAt: timestamp('read_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('message_deliveries', table))

// 21. Subject Table
export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  code: text('code'),
  defaultCoefficient: integer('default_coefficient'),
  category: text('category').notNull().default('Scientifique'),
  color: text('color').notNull().default('mint'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('subjects', table))

// 22. Subject Matter Table
export const subjectMatters = pgTable('subject_matters', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sequenceOrder: integer('sequence_order').notNull(),
  estimatedHours: integer('estimated_hours'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('subject_matters', table))

// 23. Class Group Table
export const classGroups = pgTable('class_groups', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  gradeLevelId: text('grade_level_id').notNull(),
  name: text('name').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  capacity: integer('capacity'),
  attendanceMode: text('attendance_mode').notNull().default('session'),
  homeroomStaffId: text('homeroom_staff_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('class_groups', table))

export const teachers = pgTable('teachers', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  code: text('code'),
  photoUrl: text('photo_url'),
  email: text('email'),
  phone: text('phone'),
  notificationEmail: text('notification_email'),
  notificationPhone: text('notification_phone'),
  subjectId: text('subject_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('teachers', table))

export const teacherAssignments = pgTable('teacher_assignments', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  kind: text('kind').notNull(),
  classSubjectId: text('class_subject_id'),
  classGroupId: text('class_group_id'),
  responsibility: text('responsibility'),
  status: text('status').notNull().default('active'),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
}, table => definePerformanceIndexes('teacher_assignments', table))

export const teacherUnavailabilities = pgTable('teacher_unavailabilities', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  recurrence: text('recurrence').notNull(),
  dayOfWeek: text('day_of_week'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  effectiveFrom: timestamp('effective_from', { mode: 'date' }),
  effectiveUntil: timestamp('effective_until', { mode: 'date' }),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  reason: text('reason'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
}, table => definePerformanceIndexes('teacher_unavailabilities', table))

export const gradeLevelSubjects = pgTable('grade_level_subjects', {
  id: text('id').primaryKey(),
  gradeLevelId: text('grade_level_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  subjectId: text('subject_id').notNull(),
  coefficient: integer('coefficient'),
  periodsPerWeek: integer('periods_per_week'),
  minPeriodSpan: integer('min_period_span'),
  maxPeriodSpan: integer('max_period_span'),
  isOptional: boolean('is_optional').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('grade_level_subjects', table))

export const gradeLevelSubjectMatters = pgTable('grade_level_subject_matters', {
  id: text('id').primaryKey(),
  gradeLevelSubjectId: text('grade_level_subject_id').notNull(),
  subjectMatterId: text('subject_matter_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('grade_level_subject_matters', table))

// 24. Class Subject Table
export const classSubjects = pgTable('class_subjects', {
  id: text('id').primaryKey(),
  classGroupId: text('class_group_id').notNull(),
  subjectId: text('subject_id').notNull(),
  gradeLevelSubjectId: text('grade_level_subject_id'),
  coefficient: integer('coefficient'),
  periodsPerWeek: integer('periods_per_week'),
  minPeriodSpan: integer('min_period_span'),
  maxPeriodSpan: integer('max_period_span'),
  isOffered: boolean('is_offered').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  completedPercentage: integer('completed_percentage').notNull(),
}, table => definePerformanceIndexes('class_subjects', table))

// 28. Activity Table (school program / club)
export const activities = pgTable('activities', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  coach: text('coach').notNull(),
  schedule: text('schedule').notNull(),
  participants: integer('participants').notNull(),
  capacity: integer('capacity').notNull(),
  description: text('description').notNull(),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('activities', table))

// 29. Activity Enrollment Table
export const activityEnrollments = pgTable('activity_enrollments', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull(),
  studentId: text('student_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('activity_enrollments', table))

// 29b. Class Activity Enrollment Table
export const classActivityEnrollments = pgTable('class_activity_enrollments', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('class_activity_enrollments', table))

// 30. Class Subject Matter Table
export const classSubjectMatters = pgTable('class_subject_matters', {
  id: text('id').primaryKey(),
  classSubjectId: text('class_subject_id').notNull(),
  subjectMatterId: text('subject_matter_id').notNull(),
  status: text('status').notNull(),
  completedPercentage: integer('completed_percentage').notNull(),
  updatedByStaffId: text('updated_by_staff_id'),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('class_subject_matters', table))

// 26. Class Subject Progress Table
export const classSubjectProgress = pgTable('class_subject_progress', {
  id: text('id').primaryKey(),
  classSubjectMatterId: text('class_subject_matter_id').notNull(),
  lessonSessionId: text('lesson_session_id').notNull(),
  completedPercentage: integer('completed_percentage').notNull(),
  recordedByStaffId: text('recorded_by_staff_id'),
  notes: text('notes'),
  recordedAt: timestamp('recorded_at', { mode: 'date' }).notNull(),
})

// 27. Assessment Table
export const assessments = pgTable('assessments', {
  id: text('id').primaryKey(),
  classGroupId: text('class_group_id').notNull(),
  classSubjectId: text('class_subject_id').notNull(),
  periodId: text('period_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  maxScore: integer('max_score').notNull(),
  coefficient: integer('coefficient').notNull(),
  description: text('description'),
  attachments: jsonb('attachments').notNull().default([]),
  lessonSessionId: text('lesson_session_id'),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  dueAt: timestamp('due_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('assessments', table))

// 28. Assessment Result Table
export const assessmentResults = pgTable('assessment_results', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  assessmentId: text('assessment_id').notNull(),
  score: integer('score'),
  status: text('status'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('assessment_results', table))

// 29. Grade Scale Table
export const gradeScales = pgTable('grade_scales', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  minScore: integer('min_score').notNull(),
  maxScore: integer('max_score').notNull(),
  ranges: jsonb('ranges').notNull(),
  decimalPlaces: integer('decimal_places').notNull().default(1),
  description: text('description'),
  isDefault: boolean('is_default').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('grade_scales', table))

export const reportCardDefinitions = pgTable('report_card_definitions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  gradeLevelId: text('grade_level_id').notNull(),
  gradeScaleId: text('grade_scale_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('draft'),
  isDefault: boolean('is_default').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('report_card_definitions', table))

// 31. Report Card Definition Section Table
export const reportCardDefinitionSections = pgTable('report_card_definition_sections', {
  id: text('id').primaryKey(),
  definitionId: text('definition_id').notNull(),
  name: text('name').notNull(),
  role: text('role'),
  coefficient: real('coefficient'),
  order: integer('order_val').notNull(),
  weight: integer('weight').notNull(),
  parentSectionId: text('parent_section_id'),
  subjectId: text('subject_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('report_card_definition_sections', table))

// 32. Report Card Result Table
export const reportCardResults = pgTable('report_card_results', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  periodId: text('period_id').notNull(),
  reportCardDefinitionId: text('report_card_definition_id').notNull(),
  sectionResults: jsonb('section_results').notNull(),
  attendanceSummary: jsonb('attendance_summary').notNull(),
  assessmentResultCount: integer('assessment_result_count').notNull(),
  overallAverage: integer('overall_average'),
  rank: integer('rank'),
  classSize: integer('class_size'),
  passThreshold: integer('pass_threshold'),
  teacherComment: text('teacher_comment'),
  principalComment: text('principal_comment'),
  status: text('status').notNull(),
  generatedAt: timestamp('generated_at', { mode: 'date' }).notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  aggregation: jsonb('aggregation'),
}, table => definePerformanceIndexes('report_card_results', table))

// 33. Student Table
export const students = pgTable('students', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender'),
  birthDate: timestamp('birth_date', { mode: 'date' }),
  placeOfBirth: text('place_of_birth'),
  nationality: text('nationality'),
  matricule: text('matricule'),
  photoUrl: text('photo_url'),
  subjectId: text('subject_id'),
  status: text('status').notNull(),
  enrollmentDate: timestamp('enrollment_date', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('students', table))

// 34. Student Class Enrollment Table
export const studentClassEnrollments = pgTable('student_class_enrollments', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  enrollmentIndex: integer('enrollment_index').notNull(),
  status: text('status').notNull(),
  enrolledAt: timestamp('enrolled_at', { mode: 'date' }).notNull(),
  endedAt: timestamp('ended_at', { mode: 'date' }),
  endReason: text('end_reason'),
  progressionDecision: text('progression_decision'),
  previousEnrollmentId: text('previous_enrollment_id'),
  closedBy: text('closed_by'),
  progressionDecidedAt: timestamp('progression_decided_at', { mode: 'date' }),
  progressionDecidedBy: text('progression_decided_by'),
  progressionNotes: text('progression_notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('student_class_enrollments', table))

// 35. Guardian Table
export const guardians = pgTable('guardians', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  code: text('code'),
  photoUrl: text('photo_url'),
  email: text('email'),
  phone: text('phone'),
  notificationEmail: text('notification_email'),
  notificationPhone: text('notification_phone'),
  subjectId: text('subject_id'),
  contactMethods: jsonb('contact_methods').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('guardians', table))

// 36. Guardian Student Link Table
export const guardianStudentLinks = pgTable('guardian_student_links', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  guardianId: text('guardian_id').notNull(),
  studentId: text('student_id').notNull(),
  relationship: text('relationship').notNull(),
  isPrimary: boolean('is_primary').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('guardian_student_links', table))

// 37. Student Note Table
export const studentNotes = pgTable('student_notes', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  studentId: text('student_id').notNull(),
  authorStaffId: text('author_staff_id').notNull(),
  title: text('title'),
  category: text('category').notNull().default('work'),
  body: text('body').notNull(),
  visibility: text('visibility').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('student_notes', table))

// 38. Student Health Profile Table
export const studentHealthProfiles = pgTable('student_health_profiles', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  studentId: text('student_id').notNull(),
  bloodType: text('blood_type'),
  allergies: jsonb('allergies').notNull(),
  medicalConditions: jsonb('medical_conditions').notNull(),
  medications: text('medications'),
  clinicalNotes: text('clinical_notes'),
  lastVisit: timestamp('last_visit', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('student_health_profiles', table))

// 39. Student Disciplinary Action Table
export const studentDisciplinaryActions = pgTable('student_disciplinary_actions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  incidentId: text('incident_id').notNull(),
  studentId: text('student_id').notNull(),
  disciplinaryActionId: text('disciplinary_action_id').notNull(),
  assignedByStaffId: text('assigned_by_staff_id').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  status: text('status').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('student_disciplinary_actions', table))

// 40. Disciplinary Action Table
export const disciplinaryActions = pgTable('disciplinary_actions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('disciplinary_actions', table))

// 41. Student Incident Involvement Table
export const studentIncidentInvolvements = pgTable('student_incident_involvements', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  incidentId: text('incident_id').notNull(),
  role: text('role').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('student_incident_involvements', table))

// 42. Incident Table
export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  date: timestamp('date', { mode: 'date' }).notNull(),
  kind: text('kind').notNull(),
  reporterId: text('reporter_id').notNull(),
  classGroupId: text('class_group_id'),
  lessonSessionId: text('lesson_session_id'),
  status: text('status').notNull(),
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at', { mode: 'date' }),
  resolvedByStaffId: text('resolved_by_staff_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('incidents', table))
