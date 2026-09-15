import type { EventNotificationTemplateEntry, InvitationNotificationTemplateEntry } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { boolean, check, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const consortiums = pgTable('consortiums', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  country: text('country'),
  ownerSubjectId: text('owner_subject_id').notNull(),
  sharedRules: jsonb('shared_rules').notNull().default({ structureTemplateIds: [] }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
})

// 1. School Table

export const schools = pgTable('schools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull(),
  ownerSubjectId: text('owner_subject_id'),
  consortiumId: text('consortium_id'),
  pendingOwnerStaffId: text('pending_owner_staff_id'),
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
  postalAddress: text('postal_address'),
  phone: text('phone'),
  email: text('email'),
  schoolCode: text('school_code'),
  issuingName: text('issuing_name'),
  logoAttachmentId: text('logo_attachment_id'),
  crestAttachmentId: text('crest_attachment_id'),
  stampAttachmentId: text('stamp_attachment_id'),
  signatureAttachmentId: text('signature_attachment_id'),
  issuanceAssetVersion: integer('issuance_asset_version').notNull().default(0),
  publicBrandingPurposes: jsonb('public_branding_purposes').notNull().default([]),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
})

// 2. Academic Year Table

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
  profileRole: text('profile_role'),
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
  invitationSmsEnabled: boolean('invitation_sms_enabled').notNull().default(false),
  announcementPublished: jsonb('announcement_published').$type<EventNotificationTemplateEntry>().notNull(),
  reportCardPublished: jsonb('report_card_published').$type<EventNotificationTemplateEntry>().notNull(),
  attendanceRecorded: jsonb('attendance_recorded').$type<EventNotificationTemplateEntry>().notNull(),
  assessmentResultRecorded: jsonb('assessment_result_recorded').$type<EventNotificationTemplateEntry>().notNull(),
  incidentRecorded: jsonb('incident_recorded').$type<EventNotificationTemplateEntry>().notNull(),
  assessmentDueSoon: jsonb('assessment_due_soon').$type<EventNotificationTemplateEntry>().notNull(),
  activityReminder: jsonb('activity_reminder').$type<EventNotificationTemplateEntry>().notNull(),
  calendarEventReminder: jsonb('calendar_event_reminder').$type<EventNotificationTemplateEntry>().notNull(),
  studentPhotoApproved: jsonb('student_photo_approved').$type<EventNotificationTemplateEntry>(),
  studentPhotoRejected: jsonb('student_photo_rejected').$type<EventNotificationTemplateEntry>(),
  accountInvitation: jsonb('account_invitation').$type<InvitationNotificationTemplateEntry>().notNull(),
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
  scopes: jsonb('scopes').$type<import('@edaya/core').GrantScope[]>().notNull(),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => ({
  ...definePerformanceIndexes('staff_permission_assignments', table),
  scopesNonempty: check('staff_grant_scopes_nonempty', sql`jsonb_typeof(${table.scopes}) = 'array' AND jsonb_array_length(${table.scopes}) > 0`),
}))

// 8. Attachment Table

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  ownerKind: text('owner_kind').notNull(),
  ownerId: text('owner_id').notNull(),
  purpose: text('purpose').notNull().default('general'),
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

export const platformUsers = pgTable('platform_users', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  email: text('email').notNull(),
  permissions: jsonb('permissions').notNull().$type<string[]>(),
  isActive: boolean('is_active').notNull().default(true),
  createdBySubjectId: text('created_by_subject_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('platform_users', table))

export const s2sClients = pgTable('s2s_clients', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  clientId: text('client_id').notNull(),
  accessClass: text('access_class').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  createdBySubjectId: text('created_by_subject_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  revokedAt: timestamp('revoked_at', { mode: 'date' }),
  lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
}, table => definePerformanceIndexes('s2s_clients', table))
