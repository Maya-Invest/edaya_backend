import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

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
