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
  order: integer('order_val').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isBreak: boolean('is_break').notNull().default(false),
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
  email: text('email'),
  notificationEmail: text('notification_email'),
  notificationPhone: text('notification_phone'),
  subjectId: text('subject_id'),
  accountKind: text('account_kind').notNull().default('human'),
  serviceId: text('service_id'),
  createdBySubjectId: text('created_by_subject_id'),
  serviceElevated: boolean('service_elevated').notNull().default(false),
  isActive: boolean('is_active').notNull(),
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
  role: text('role').notNull(),
  classGroupId: text('class_group_id'),
  classSubjectId: text('class_subject_id'),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('staff_assignments', table))

export const accessRoles = pgTable('access_roles', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('access_roles', table))

export const accessRolePermissions = pgTable('access_role_permissions', {
  roleId: text('role_id').notNull(),
  permission: text('permission').notNull(),
}, table => definePerformanceIndexes('access_role_permissions', table))

export const staffRoleAssignments = pgTable('staff_role_assignments', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id'),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('staff_role_assignments', table))

export const staffRoleAssignmentRoles = pgTable('staff_role_assignment_roles', {
  assignmentId: text('assignment_id').notNull(),
  roleId: text('role_id').notNull(),
}, table => definePerformanceIndexes('staff_role_assignment_roles', table))

export const staffRoleAssignmentScopeGrants = pgTable('staff_role_assignment_scope_grants', {
  assignmentId: text('assignment_id').notNull(),
  permission: text('permission').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeEntityIds: jsonb('scope_entity_ids').notNull(),
})

// 8. Attachment Table
export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  ownerKind: text('owner_kind').notNull(),
  ownerId: text('owner_id').notNull(),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
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
  sessionId: text('session_id'),
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
  classGroupId: text('class_group_id').notNull(),
  classSubjectId: text('class_subject_id'),
  title: text('title').notNull(),
  isRecurring: boolean('is_recurring').notNull(),
  dayOfWeek: text('day_of_week'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  specificDate: timestamp('specific_date', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('schedules', table))

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  classGroupId: text('class_group_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  classSubjectId: text('class_subject_id'),
  scheduleId: text('schedule_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('sessions', table))

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
  sessionId: text('session_id').notNull(),
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
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('class_groups', table))

// 24. Class Subject Table
export const classSubjects = pgTable('class_subjects', {
  id: text('id').primaryKey(),
  classGroupId: text('class_group_id').notNull(),
  subjectId: text('subject_id').notNull(),
  coefficient: integer('coefficient'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  completedPercentage: integer('completed_percentage').notNull(),
}, table => definePerformanceIndexes('class_subjects', table))

// 25. Homework Assignment Table
export const homeworkAssignments = pgTable('homework_assignments', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  classSubjectId: text('class_subject_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  dueDate: timestamp('due_date', { mode: 'date' }).notNull(),
  assignedDate: timestamp('assigned_date', { mode: 'date' }).notNull(),
  type: text('type').notNull(),
  attachments: jsonb('attachments').notNull().default([]),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('homework_assignments', table))

// 26. Class Logbook Entry Table
export const classLogbookEntries = pgTable('class_logbook_entries', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  classSubjectId: text('class_subject_id').notNull(),
  date: timestamp('date', { mode: 'date' }).notNull(),
  chapter: text('chapter').notNull(),
  content: text('content').notNull(),
  objectives: jsonb('objectives').notNull().default([]),
  homework: text('homework'),
  attachments: jsonb('attachments').notNull().default([]),
  progress: integer('progress').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('class_logbook_entries', table))

// 27. Homework Submission Table
export const homeworkSubmissions = pgTable('homework_submissions', {
  id: text('id').primaryKey(),
  homeworkAssignmentId: text('homework_assignment_id').notNull(),
  studentId: text('student_id').notNull(),
  status: text('status').notNull(),
  submittedAt: timestamp('submitted_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('homework_submissions', table))

// 28. Extracurricular Activity Table
export const extracurricularActivities = pgTable('extracurricular_activities', {
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
}, table => definePerformanceIndexes('extracurricular_activities', table))

// 29. Activity Enrollment Table
export const activityEnrollments = pgTable('activity_enrollments', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull(),
  studentId: text('student_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('activity_enrollments', table))

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
  sessionId: text('session_id').notNull(),
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
  sessionId: text('session_id'),
  dueAt: timestamp('due_at', { mode: 'date' }),
  metAt: timestamp('met_at', { mode: 'date' }),
  date: timestamp('date', { mode: 'date' }),
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
  sessionId: text('session_id'),
  status: text('status').notNull(),
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at', { mode: 'date' }),
  resolvedByStaffId: text('resolved_by_staff_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('incidents', table))
