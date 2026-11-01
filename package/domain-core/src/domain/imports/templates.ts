import type { ImportType } from './contracts'

export interface ImportColumn {
  key: string
  field?: string
  kind: 'text' | 'number' | 'boolean' | 'date' | 'json'
  nullable?: boolean
  aliases?: readonly string[]
}
export interface ImportTemplate {
  type: ImportType
  version: 1
  rank: number
  columns: readonly ImportColumn[]
}
const text = (key: string, field?: string, nullable = true, aliases: string[] = []): ImportColumn => ({ key, field, kind: 'text', nullable, aliases })
const bool = (key: string, field: string, nullable = false): ImportColumn => ({ key, field, kind: 'boolean', nullable })
const num = (key: string, field: string, nullable = true, aliases: string[] = []): ImportColumn => ({ key, field, kind: 'number', nullable, aliases })
const date = (key: string, field: string, aliases: string[] = []): ImportColumn => ({ key, field, kind: 'date', nullable: true, aliases })
const common = [text('row_id'), text('target_id'), text('source_id'), text('on_existing'), text('_outcome'), text('_issues'), text('_source_file'), text('_source_row')]
const name = [text('first_name', 'firstName', false, ['prenom', 'firstname']), text('last_name', 'lastName', false, ['nom', 'lastname'])]
const person = [...name, text('code', 'code'), text('email', 'email'), text('phone', 'phone', true, ['telephone'])]
const original = text('source_full_name', 'sourceFullName', true, ['nom_original', 'sourcefullname'])
const grade = text('grade', 'gradeLevelId', false, ['niveau', 'grade_level_id', 'gradelevelid'])
const classRef = text('class', 'classGroupId', true, ['classe', 'class_group_id', 'classgroupid'])
const subject = text('subject', 'subjectReference', false, ['matiere'])
const subjectId = text('subject_id', 'subjectId', true, ['subjectid'])
const student = text('student', 'studentId', false, ['matricule', 'student_id', 'studentid', 'eleve_matricule'])
const guardian = text('guardian', 'guardianId', false, ['guardian_code', 'guardian_id', 'guardiancode'])
const relationship = [text('relationship', 'relationship', false, ['relation']), bool('is_primary', 'isPrimary'), bool('is_billing_contact', 'isBillingContact'), bool('legal_guardian', 'legalGuardian'), bool('can_pickup', 'canPickup'), num('emergency_contact_priority', 'emergencyContactPriority'), bool('receives_academic_reports', 'receivesAcademicReports'), bool('receives_attendance_alerts', 'receivesAttendanceAlerts'), text('contact_restrictions', 'contactRestrictions'), text('notes', 'notes')]
const entry = (type: ImportType, rank: number, columns: ImportColumn[]): ImportTemplate => ({ type, version: 1, rank, columns: [...common, ...columns] })
/** The single catalogue used by staging, correction downloads and template presentation. */
export const IMPORT_TEMPLATES: Record<ImportType, ImportTemplate> = {
  academic_disciplines: entry('academic_disciplines', 0, [text('code', 'code', false), text('name', 'name', false, ['nom', 'label']), bool('is_active', 'isActive')]),
  placement_statuses: entry('placement_statuses', 0, [text('code', 'code', false), text('label', 'label', false, ['nom', 'name']), bool('is_active', 'isActive')]),
  classes: entry('classes', 1, [text('name', 'name', false, ['nom']), grade, num('capacity', 'capacity', true, ['capacite']), text('attendance_mode', 'attendanceMode', false)]),
  subjects: entry('subjects', 2, [text('name', 'name', false, ['nom']), grade, text('discipline_code', 'disciplineId', false), text('code', 'code'), text('short_name', 'shortName', true, ['abbreviation']), num('coefficient', 'coefficient'), text('category', 'categoryId'), bool('is_optional', 'isOptional'), text('color', 'color'), num('periods_per_week', 'periodsPerWeek'), num('min_period_span', 'minPeriodSpan'), num('max_period_span', 'maxPeriodSpan')]),
  students: entry('students', 3, [...name, original, text('matricule', 'matricule', false), text('national_matricule', 'nationalMatricule'), text('gender', 'gender', true, ['genre']), date('birth_date', 'birthDate', ['date_naissance']), text('birth_place', 'placeOfBirth', true, ['lieu_naissance']), text('nationality', 'nationality', true, ['nationalite']), date('entry_date', 'enrollmentDate', ['date_entree']), text('status', 'status'), classRef, date('enrollment_effective_date', 'enrolledAt'), text('placement_status_code', 'placementStatusId'), bool('is_repeating', 'isRepeating', true)]),
  guardians: entry('guardians', 4, [...person.map(column => column.field === 'firstName' ? { ...column, nullable: true } : column), original, text('occupation', 'occupation'), text('alternative_phone', 'alternativePhone'), bool('email_notifications_enabled', 'emailNotificationsEnabled'), bool('sms_notifications_enabled', 'smsNotificationsEnabled'), bool('push_notifications_enabled', 'pushNotificationsEnabled'), text('students', 'studentIds', true, ['eleve_matricule']), ...relationship]),
  teachers: entry('teachers', 3, [...person, original, bool('is_active', 'isActive'), text('discipline_codes', 'disciplineIds'), num('declared_hours', 'declaredHours'), text('hours_period', 'hoursPeriod'), text('hours_period_label', 'hoursPeriodLabel')]),
  staff: entry('staff', 3, [...person, text('profile_role', 'profileRole', true, ['role']), bool('is_active', 'isActive')]),
  guardian_relationships: entry('guardian_relationships', 5, [guardian, student, ...relationship, bool('complete_collection', 'completeCollection')]),
  class_offerings: entry('class_offerings', 4, [classRef, subject, subjectId, bool('is_offered', 'isOffered')]),
  teacher_assignments: entry('teacher_assignments', 5, [text('teacher', 'teacherId', false, ['code', 'teacher_id']), classRef, subject, subjectId, text('kind', 'kind'), text('responsibility', 'responsibility'), date('starts_at', 'startsAt'), date('ends_at', 'endsAt')]),
  chapters: entry('chapters', 4, [grade, subject, subjectId, text('title', 'name', false, ['titre']), num('sequence', 'sequenceOrder', false, ['ordre']), text('description', 'description')]),
  billing: entry('billing', 6, [student, text('catalog_service', 'catalogServiceId', false, ['type_frais', 'catalog_service_id']), num('amount', 'priceOverride', true, ['montant']), date('due_date', 'dueDate', ['date_echeance'])]),
  payments: entry('payments', 7, [student, text('catalog_service', 'catalogServiceId', true, ['type_frais']), text('reference', 'reference', false), num('amount', 'amount', false, ['montant']), date('payment_date', 'paymentDate', ['date']), text('method', 'method', false, ['mode']), text('notes', 'notes')]),
}
