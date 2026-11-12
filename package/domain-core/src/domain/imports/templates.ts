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
  version: 2
  rank: number
  columns: readonly ImportColumn[]
}
const text = (key: string, field?: string, nullable = true, aliases: string[] = []): ImportColumn => ({ key, field, kind: 'text', nullable, aliases })
const bool = (key: string, field: string, nullable = false): ImportColumn => ({ key, field, kind: 'boolean', nullable })
const num = (key: string, field: string, nullable = true, aliases: string[] = []): ImportColumn => ({ key, field, kind: 'number', nullable, aliases })
const date = (key: string, field: string, aliases: string[] = []): ImportColumn => ({ key, field, kind: 'date', nullable: true, aliases })
const common = [text('row_id'), text('target_id'), text('source_id'), text('on_existing'), text('_outcome'), text('_issues'), text('_source_file'), text('_source_row')]
const name = [text('first_name', 'firstName', false, ['prenom', 'firstname']), text('last_name', 'lastName', false, ['nom', 'lastname'])]
const person = [...name, text('identifier', 'identifier'), text('email', 'email'), text('phone', 'phone', true, ['telephone'])]
const original = text('source_full_name', 'sourceFullName', true, ['nom_original', 'sourcefullname'])
function reference(prefix: string, field: string, human = false): ImportColumn[] {
  return [
    text(`${prefix}_id`, field),
    ...(human ? [text(`${prefix}_identifier`, `${field}Identifier`)] : [text(`${prefix}_name`, `${field}Name`), text(`${prefix}_short_name`, `${field}ShortName`)]),
    text(`_${prefix}_label`),
  ]
}
const grade = reference('grade', 'gradeLevelId')
const classRef = reference('class', 'classGroupId')
const subject = reference('subject', 'subjectId')
const student = reference('student', 'studentId', true)
const guardian = reference('guardian', 'guardianId', true)
const relationship = [text('relationship', 'relationship', false, ['relation']), bool('is_primary', 'isPrimary'), bool('is_billing_contact', 'isBillingContact'), bool('legal_guardian', 'legalGuardian'), bool('can_pickup', 'canPickup'), num('emergency_contact_priority', 'emergencyContactPriority'), bool('receives_academic_reports', 'receivesAcademicReports'), bool('receives_attendance_alerts', 'receivesAttendanceAlerts'), text('contact_restrictions', 'contactRestrictions'), text('notes', 'notes')]
const entry = (type: ImportType, rank: number, columns: ImportColumn[]): ImportTemplate => ({ type, version: 2, rank, columns: [...common, ...columns] })
/** The single catalogue used by staging, correction downloads and template presentation. */
export const IMPORT_TEMPLATES: Record<ImportType, ImportTemplate> = {
  academic_disciplines: entry('academic_disciplines', 0, [text('name', 'name', false, ['nom']), text('short_name', 'shortName'), bool('is_active', 'isActive')]),
  placement_statuses: entry('placement_statuses', 0, [text('name', 'name', false, ['nom']), text('short_name', 'shortName'), bool('is_active', 'isActive')]),
  classes: entry('classes', 1, [text('name', 'name', false, ['nom']), text('short_name', 'shortName'), ...grade, num('capacity', 'capacity', true, ['capacite']), text('attendance_mode', 'attendanceMode', false)]),
  subjects: entry('subjects', 2, [text('name', 'name', false, ['nom']), ...grade, ...reference('discipline', 'disciplineId'), text('short_name', 'shortName', true, ['abbreviation']), num('coefficient', 'coefficient'), ...reference('category', 'categoryId'), bool('is_optional', 'isOptional'), text('color', 'color'), num('periods_per_week', 'periodsPerWeek'), num('min_period_span', 'minPeriodSpan'), num('max_period_span', 'maxPeriodSpan')]),
  students: entry('students', 3, [...name, original, text('identifier', 'identifier', false), text('global_identifier', 'globalIdentifier'), text('gender', 'gender', true, ['genre']), date('birth_date', 'birthDate', ['date_naissance']), text('birth_place', 'placeOfBirth', true, ['lieu_naissance']), text('nationality', 'nationality', true, ['nationalite']), date('entry_date', 'enrollmentDate', ['date_entree']), text('status', 'status'), ...classRef, date('enrollment_effective_date', 'enrolledAt'), ...reference('placement_status', 'placementStatusId'), bool('is_repeating', 'isRepeating', true)]),
  guardians: entry('guardians', 4, [...person.map(column => column.field === 'firstName' ? { ...column, nullable: true } : column), original, text('occupation', 'occupation'), text('alternative_phone', 'alternativePhone'), bool('email_notifications_enabled', 'emailNotificationsEnabled'), bool('sms_notifications_enabled', 'smsNotificationsEnabled'), bool('push_notifications_enabled', 'pushNotificationsEnabled'), text('student_ids', 'studentIds'), text('student_identifiers', 'studentIdentifiers'), ...relationship]),
  teachers: entry('teachers', 3, [...person, original, bool('is_active', 'isActive'), text('discipline_ids', 'disciplineIds'), text('discipline_names', 'disciplineNames'), text('discipline_short_names', 'disciplineShortNames'), num('declared_hours', 'declaredHours'), text('hours_period', 'hoursPeriod'), text('hours_period_label', 'hoursPeriodLabel')]),
  staff: entry('staff', 3, [...person, text('profile_role', 'profileRole', true, ['role']), bool('is_active', 'isActive')]),
  guardian_relationships: entry('guardian_relationships', 5, [...guardian, ...student, ...relationship, bool('complete_collection', 'completeCollection')]),
  class_offerings: entry('class_offerings', 4, [...classRef, ...subject, bool('is_offered', 'isOffered')]),
  teacher_assignments: entry('teacher_assignments', 5, [...reference('teacher', 'teacherId', true), ...classRef, ...subject, text('kind', 'kind'), text('responsibility', 'responsibility'), date('starts_at', 'startsAt'), date('ends_at', 'endsAt')]),
  chapters: entry('chapters', 4, [...grade, ...subject, text('name', 'name', false), text('short_name', 'shortName'), num('sequence', 'sequenceOrder', false, ['ordre']), text('description', 'description')]),
  billing: entry('billing', 6, [...student, ...reference('catalog_service', 'catalogServiceId'), num('amount', 'priceOverride', true, ['montant']), date('due_date', 'dueDate', ['date_echeance'])]),
  payments: entry('payments', 7, [...student, ...reference('catalog_service', 'catalogServiceId'), text('reference', 'reference', false), num('amount', 'amount', false, ['montant']), date('payment_date', 'paymentDate', ['date']), text('method', 'method', false, ['mode']), text('notes', 'notes')]),
}
