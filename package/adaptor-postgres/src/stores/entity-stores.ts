import type { AcademicPeriod, AcademicYear, Activity, ActivityEnrollment, ActivitySession, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, Attendance, AttendanceRecord, CalendarEvent, ClassActivityEnrollment, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, Fee, GradeLevel, GradeLevelSubject, GradeLevelSubjectMatter, GradeScale, Guardian, GuardianStudentLink, Incident, LessonSession, MessageDelivery, Payment, PeriodDefinition, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, ReportCardResultSection, Resource, ResourceAssignment, Schedule, School, StaffAssignment, StaffMember, Student, StudentClassEnrollment, StudentDisciplinaryAction, StudentFee, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, Subject, SubjectMatter, Teacher, TeacherAssignment, TeacherUnavailability } from '@edaya/core'
import type { PostgresStore } from '../postgres-store'
import { AcademicPeriod as AcademicPeriodCtor, AcademicYear as AcademicYearCtor, Activity as ActivityCtor, ActivityEnrollment as ActivityEnrollmentCtor, ActivitySession as ActivitySessionCtor, Announcement as AnnouncementCtor, AnnouncementPriority, AnnouncementStatus, AnnouncementTarget as AnnouncementTargetCtor, Assessment as AssessmentCtor, AssessmentKind, AssessmentResult as AssessmentResultCtor, Attachment as AttachmentCtor, Attendance as AttendanceCtor, AttendanceJustificationStatus, AttendanceRecord as AttendanceRecordCtor, AttendanceStatus, AttendanceSummary, CalendarEvent as CalendarEventCtor, CalendarEventKind, CalendarEventScopeKind, ClassActivityEnrollment as ClassActivityEnrollmentCtor, ClassGroup as ClassGroupCtor, ClassSubject as ClassSubjectCtor, ClassSubjectMatter as ClassSubjectMatterCtor, ClassSubjectMatterStatus, ClassSubjectProgress as ClassSubjectProgressCtor, DeadlineComplianceStatus, DisciplinaryAction as DisciplinaryActionCtor, FeeCategory, Fee as FeeCtor, FeeStatus, GradeLevel as GradeLevelCtor, GradeLevelSubject as GradeLevelSubjectCtor, GradeLevelSubjectMatter as GradeLevelSubjectMatterCtor, GradeScale as GradeScaleCtor, Guardian as GuardianCtor, GuardianStudentLink as GuardianStudentLinkCtor, Incident as IncidentCtor, LessonSession as LessonSessionCtor, MessageDelivery as MessageDeliveryCtor, OccurrenceStatus, Payment as PaymentCtor, PaymentMethod, PaymentStatus, PeriodDefinition as PeriodDefinitionCtor, ReportCardDefinition as ReportCardDefinitionCtor, ReportCardDefinitionSection as ReportCardDefinitionSectionCtor, ReportCardDefinitionSectionKind, ReportCardResult as ReportCardResultCtor, ReportCardResultSection as ReportCardResultSectionCtor, ReportCardResultStatus, ResourceAssignment as ResourceAssignmentCtor, Resource as ResourceCtor, ResourceKind, Schedule as ScheduleCtor, School as SchoolCtor, StaffAssignment as StaffAssignmentCtor, StaffMember as StaffMemberCtor, StudentClassEnrollment as StudentClassEnrollmentCtor, Student as StudentCtor, StudentDisciplinaryAction as StudentDisciplinaryActionCtor, StudentFee as StudentFeeCtor, StudentHealthProfile as StudentHealthProfileCtor, StudentIncidentInvolvement as StudentIncidentInvolvementCtor, StudentNote as StudentNoteCtor, Subject as SubjectCtor, SubjectMatter as SubjectMatterCtor, TeacherAssignment as TeacherAssignmentCtor, TeacherAssignmentKind, TeacherAssignmentStatus, Teacher as TeacherCtor, TeacherUnavailability as TeacherUnavailabilityCtor, TeacherUnavailabilityRecurrence, TimetableGenerated } from '@edaya/core'
import { createDefaultMappers, deserializeJsonb } from '../lib/mappers'
import { customStore, defaultStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'

interface StoredReportCardResultSection {
  sectionId: string
  sectionKind: ReportCardDefinitionSectionKind
  name: string
  average: number
  weight: number
  parentSectionId?: string | null
  classSubjectId?: string | null
  comment?: string | null
  subResults?: StoredReportCardResultSection[]
  data?: StoredReportCardResultSection
}

function enumValue<const T extends Record<string, string>>(
  values: T,
  value: unknown,
  fieldName: string,
): T[keyof T] {
  const allowedValues = Object.values(values)
  if (typeof value === 'string' && allowedValues.includes(value as T[keyof T])) {
    return value as T[keyof T]
  }
  throw new Error(`Invalid ${fieldName}: ${String(value)}`)
}

function serializeReportCardResultSection(section: ReportCardResultSection): StoredReportCardResultSection {
  return {
    sectionId: section.sectionId,
    sectionKind: section.sectionKind,
    name: section.name,
    average: section.average,
    weight: section.weight,
    parentSectionId: section.parentSectionId ?? null,
    classSubjectId: section.classSubjectId ?? null,
    comment: section.comment ?? null,
    subResults: section.subResults.map(serializeReportCardResultSection),
  }
}

function unwrapReportCardResultSection(raw: StoredReportCardResultSection): StoredReportCardResultSection {
  if (raw.data?.sectionId) {
    return {
      ...raw.data,
      subResults: raw.subResults ?? raw.data.subResults ?? [],
    }
  }
  return raw
}

function deserializeReportCardResultSection(raw: StoredReportCardResultSection): ReportCardResultSection {
  const section = unwrapReportCardResultSection(raw)
  return new ReportCardResultSectionCtor({
    sectionId: section.sectionId,
    sectionKind: section.sectionKind,
    name: section.name,
    average: section.average,
    weight: section.weight,
    parentSectionId: section.parentSectionId ?? undefined,
    classSubjectId: section.classSubjectId ?? undefined,
    comment: section.comment ?? undefined,
    subResults: (section.subResults ?? []).map(deserializeReportCardResultSection),
  })
}

export interface EntityStores {
  schoolsStore: PostgresStore<School>
  academicYears: PostgresStore<AcademicYear>
  academicPeriods: PostgresStore<AcademicPeriod>
  periodDefinitions: PostgresStore<PeriodDefinition>
  gradeLevels: PostgresStore<GradeLevel>
  staffMembers: PostgresStore<StaffMember>
  staffAssignments: PostgresStore<StaffAssignment>
  teachers: PostgresStore<Teacher>
  teacherAssignments: PostgresStore<TeacherAssignment>
  teacherUnavailabilities: PostgresStore<TeacherUnavailability>
  attachments: PostgresStore<Attachment>
  resources: PostgresStore<Resource>
  resourceAssignments: PostgresStore<ResourceAssignment>
  fees: PostgresStore<Fee>
  studentFees: PostgresStore<StudentFee>
  payments: PostgresStore<Payment>
  schedules: PostgresStore<Schedule>
  lessonSessions: PostgresStore<LessonSession>
  activitySessions: PostgresStore<ActivitySession>
  attendances: PostgresStore<Attendance>
  calendarEvents: PostgresStore<CalendarEvent>
  attendance: PostgresStore<AttendanceRecord>
  announcements: PostgresStore<Announcement>
  announcementTargets: PostgresStore<AnnouncementTarget>
  messageDeliveries: PostgresStore<MessageDelivery>
  subjects: PostgresStore<Subject>
  subjectMatters: PostgresStore<SubjectMatter>
  gradeLevelSubjects: PostgresStore<GradeLevelSubject>
  gradeLevelSubjectMatters: PostgresStore<GradeLevelSubjectMatter>
  classGroups: PostgresStore<ClassGroup>
  classSubjects: PostgresStore<ClassSubject>
  classSubjectMatters: PostgresStore<ClassSubjectMatter>
  classSubjectProgress: PostgresStore<ClassSubjectProgress>
  activities: PostgresStore<Activity>
  activityEnrollments: PostgresStore<ActivityEnrollment>
  classActivityEnrollments: PostgresStore<ClassActivityEnrollment>
  assessments: PostgresStore<Assessment>
  assessmentResults: PostgresStore<AssessmentResult>
  gradeScales: PostgresStore<GradeScale>
  definitions: PostgresStore<ReportCardDefinition>
  sections: PostgresStore<ReportCardDefinitionSection>
  results: PostgresStore<ReportCardResult>
  students: PostgresStore<Student>
  enrollments: PostgresStore<StudentClassEnrollment>
  guardians: PostgresStore<Guardian>
  guardianLinks: PostgresStore<GuardianStudentLink>
  studentNotes: PostgresStore<StudentNote>
  studentHealthProfiles: PostgresStore<StudentHealthProfile>
  studentDisciplinaryActions: PostgresStore<StudentDisciplinaryAction>
  disciplinaryActions: PostgresStore<DisciplinaryAction>
  studentIncidentInvolvements: PostgresStore<StudentIncidentInvolvement>
  incidents: PostgresStore<Incident>
}

export function createEntityStores(db: any): EntityStores {
  return {
    schoolsStore: defaultStore(db, schema.schools, SchoolCtor),

    academicYears: customStore(
      db,
      schema.academicYears,
      (entity: AcademicYear) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        startDate: entity.startDate,
        endDate: entity.endDate,
        isActive: entity.isActive,
        createdAt: entity.createdAt,
      }),
      row => new AcademicYearCtor({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        isActive: row.isActive,
        createdAt: row.createdAt,
      }),
    ),

    academicPeriods: customStore(
      db,
      schema.academicPeriods,
      (entity: AcademicPeriod) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        academicYearId: entity.academicYearId,
        name: entity.name,
        type: entity.type ?? null,
        startDate: entity.startDate,
        endDate: entity.endDate,
        isPublished: entity.isPublished,
        createdAt: entity.createdAt,
      }),
      row => new AcademicPeriodCtor({
        id: row.id,
        schoolId: row.schoolId,
        academicYearId: row.academicYearId,
        name: row.name,
        type: row.type ?? undefined,
        startDate: row.startDate,
        endDate: row.endDate,
        isPublished: row.isPublished,
        createdAt: row.createdAt,
      }),
    ),
    periodDefinitions: defaultStore(db, schema.periodDefinitions, PeriodDefinitionCtor),
    gradeLevels: defaultStore(db, schema.gradeLevels, GradeLevelCtor),

    staffMembers: customStore(
      db,
      schema.staffMembers,
      (entity: StaffMember) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        firstName: entity.firstName,
        lastName: entity.lastName,
        code: entity.code ?? null,
        photoUrl: entity.photoUrl ?? null,
        email: entity.email ?? null,
        notificationEmail: entity.notificationEmail ?? null,
        notificationPhone: entity.notificationPhone ?? null,
        subjectId: entity.subjectId ?? null,
        accountKind: entity.accountKind,
        serviceId: entity.serviceId ?? null,
        createdBySubjectId: entity.createdBySubjectId ?? null,
        serviceElevated: entity.serviceElevated,
        isActive: entity.isActive,
        onboardingWizardCompletedAt: entity.onboardingWizardCompletedAt ?? null,
        onboardingMaxReachedStep: entity.onboardingMaxReachedStep ?? null,
        createdAt: entity.createdAt,
      }),
      row => new StaffMemberCtor({
        id: row.id,
        schoolId: row.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        code: row.code,
        photoUrl: row.photoUrl,
        email: row.email,
        notificationEmail: row.notificationEmail,
        notificationPhone: row.notificationPhone,
        subjectId: row.subjectId,
        accountKind: row.accountKind ?? 'human',
        serviceId: row.serviceId,
        createdBySubjectId: row.createdBySubjectId,
        serviceElevated: row.serviceElevated ?? false,
        isActive: row.isActive,
        onboardingWizardCompletedAt: row.onboardingWizardCompletedAt,
        onboardingMaxReachedStep: row.onboardingMaxReachedStep,
        createdAt: row.createdAt,
      }),
    ),

    staffAssignments: customStore(
      db,
      schema.staffAssignments,
      (entity: StaffAssignment) => ({
        id: entity.id,
        staffId: entity.staffId,
        academicYearId: entity.academicYearId ?? null,
        role: entity.responsibility,
        permissions: [...entity.permissions],
        classGroupId: entity.classGroupId ?? null,
        classSubjectId: entity.classSubjectId ?? null,
        lessonSessionId: entity.lessonSessionId ?? null,
        activitySessionId: entity.activitySessionId ?? null,
        assessmentId: entity.assessmentId ?? null,
        createdAt: entity.createdAt,
      }),
      row => new StaffAssignmentCtor({
        id: row.id,
        staffId: row.staffId,
        academicYearId: row.academicYearId ?? undefined,
        responsibility: row.role,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
        classGroupId: row.classGroupId ?? undefined,
        classSubjectId: row.classSubjectId ?? undefined,
        lessonSessionId: row.lessonSessionId ?? undefined,
        activitySessionId: row.activitySessionId ?? undefined,
        assessmentId: row.assessmentId ?? undefined,
        createdAt: row.createdAt,
      }),
    ),

    teachers: customStore(
      db,
      schema.teachers,
      (entity: Teacher) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        firstName: entity.firstName,
        lastName: entity.lastName,
        code: entity.code ?? null,
        photoUrl: entity.photoUrl ?? null,
        email: entity.email ?? null,
        phone: entity.phone ?? null,
        notificationEmail: entity.notificationEmail ?? null,
        notificationPhone: entity.notificationPhone ?? null,
        subjectId: entity.subjectId ?? null,
        isActive: entity.isActive,
        createdAt: entity.createdAt,
      }),
      row => new TeacherCtor({
        id: row.id,
        schoolId: row.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        code: row.code,
        photoUrl: row.photoUrl,
        email: row.email,
        phone: row.phone,
        notificationEmail: row.notificationEmail,
        notificationPhone: row.notificationPhone,
        subjectId: row.subjectId,
        isActive: row.isActive,
        createdAt: row.createdAt,
      }),
    ),

    teacherAssignments: customStore(
      db,
      schema.teacherAssignments,
      (entity: TeacherAssignment) => ({
        id: entity.id,
        teacherId: entity.teacherId,
        academicYearId: entity.academicYearId,
        kind: entity.kind,
        classSubjectId: entity.classSubjectId ?? null,
        classGroupId: entity.classGroupId ?? null,
        responsibility: entity.responsibility ?? null,
        status: entity.status,
        startsAt: entity.startsAt ?? null,
        endsAt: entity.endsAt ?? null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt ?? null,
      }),
      row => new TeacherAssignmentCtor({
        id: row.id,
        teacherId: row.teacherId,
        academicYearId: row.academicYearId,
        kind: enumValue(TeacherAssignmentKind, row.kind, 'teacherAssignments.kind'),
        classSubjectId: row.classSubjectId ?? undefined,
        classGroupId: row.classGroupId ?? undefined,
        responsibility: row.responsibility ?? undefined,
        status: enumValue(TeacherAssignmentStatus, row.status, 'teacherAssignments.status'),
        startsAt: row.startsAt ?? undefined,
        endsAt: row.endsAt ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt ?? undefined,
      }),
    ),

    teacherUnavailabilities: customStore(
      db,
      schema.teacherUnavailabilities,
      (entity: TeacherUnavailability) => ({
        id: entity.id,
        teacherId: entity.teacherId,
        academicYearId: entity.academicYearId,
        recurrence: entity.recurrence,
        dayOfWeek: entity.dayOfWeek ?? null,
        startTime: entity.startTime ?? null,
        endTime: entity.endTime ?? null,
        effectiveFrom: entity.effectiveFrom ?? null,
        effectiveUntil: entity.effectiveUntil ?? null,
        startsAt: entity.startsAt ?? null,
        endsAt: entity.endsAt ?? null,
        reason: entity.reason ?? null,
        isActive: entity.isActive,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt ?? null,
      }),
      row => new TeacherUnavailabilityCtor({
        id: row.id,
        teacherId: row.teacherId,
        academicYearId: row.academicYearId,
        recurrence: enumValue(TeacherUnavailabilityRecurrence, row.recurrence, 'teacherUnavailabilities.recurrence'),
        dayOfWeek: row.dayOfWeek as TeacherUnavailability['dayOfWeek'],
        startTime: row.startTime ?? undefined,
        endTime: row.endTime ?? undefined,
        effectiveFrom: row.effectiveFrom ?? undefined,
        effectiveUntil: row.effectiveUntil ?? undefined,
        startsAt: row.startsAt ?? undefined,
        endsAt: row.endsAt ?? undefined,
        reason: row.reason ?? undefined,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt ?? undefined,
      }),
    ),

    attachments: defaultStore(db, schema.attachments, AttachmentCtor),

    resources: customStore(
      db,
      schema.resources,
      (entity: Resource) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        description: entity.description ?? null,
        kind: entity.kind,
        capacity: entity.capacity ?? null,
        createdAt: entity.createdAt,
      }),
      row => new ResourceCtor({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        description: row.description,
        kind: enumValue(ResourceKind, row.kind, 'resources.kind'),
        capacity: row.capacity,
        createdAt: row.createdAt,
      }),
    ),

    resourceAssignments: defaultStore(db, schema.resourceAssignments, ResourceAssignmentCtor),

    fees: customStore(
      db,
      schema.fees,
      (entity: Fee) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        academicYearId: entity.academicYearId,
        name: entity.name,
        category: entity.category,
        description: entity.description ?? null,
        defaultAmount: entity.defaultAmount.amount,
        currency: entity.defaultAmount.currency,
        installments: entity.installments,
        createdAt: entity.createdAt,
      }),
      row => new FeeCtor({
        id: row.id,
        schoolId: row.schoolId,
        academicYearId: row.academicYearId,
        name: row.name,
        category: enumValue(FeeCategory, row.category, 'fees.category'),
        description: row.description,
        defaultAmount: row.defaultAmount,
        currency: row.currency,
        installments: deserializeJsonb(row.installments),
        createdAt: row.createdAt,
      }),
    ),

    studentFees: customStore(
      db,
      schema.studentFees,
      (entity: StudentFee) => ({
        id: entity.id,
        studentId: entity.studentId,
        feeId: entity.feeId,
        academicYearId: entity.academicYearId,
        expectedAmount: entity.expectedAmount.amount,
        paidAmount: entity.paidAmount.amount,
        adjustmentAmount: entity.adjustmentAmount.amount,
        adjustmentReason: entity.adjustmentReason ?? null,
        adjustedById: entity.adjustedById ?? null,
        adjustedAt: entity.adjustedAt ?? null,
        currency: entity.expectedAmount.currency,
        dueDate: entity.dueDate ?? null,
        status: entity.status,
        cancellationReason: entity.cancellationReason ?? null,
        cancelledById: entity.cancelledById ?? null,
        cancelledAt: entity.cancelledAt ?? null,
        installments: entity.installments,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt ?? null,
      }),
      row => new StudentFeeCtor({
        id: row.id,
        studentId: row.studentId,
        feeId: row.feeId,
        academicYearId: row.academicYearId,
        expectedAmount: row.expectedAmount,
        paidAmount: row.paidAmount,
        adjustmentAmount: row.adjustmentAmount,
        adjustmentReason: row.adjustmentReason,
        adjustedById: row.adjustedById,
        adjustedAt: row.adjustedAt,
        currency: row.currency,
        dueDate: row.dueDate,
        status: enumValue(FeeStatus, row.status, 'studentFees.status'),
        cancellationReason: row.cancellationReason,
        cancelledById: row.cancelledById,
        cancelledAt: row.cancelledAt,
        installments: deserializeJsonb(row.installments),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    ),

    payments: customStore(
      db,
      schema.payments,
      (entity: Payment) => ({
        id: entity.id,
        studentFeeId: entity.studentFeeId,
        amount: entity.amount.amount,
        currency: entity.amount.currency,
        paymentDate: entity.paymentDate,
        method: entity.method,
        status: entity.status,
        reference: entity.reference ?? null,
        notes: entity.notes ?? null,
        recordedById: entity.recordedById ?? null,
        reversedAt: entity.reversedAt ?? null,
        reversedById: entity.reversedById ?? null,
        cancelledAt: entity.cancelledAt ?? null,
        cancelledById: entity.cancelledById ?? null,
        createdAt: entity.createdAt,
      }),
      row => new PaymentCtor({
        id: row.id,
        studentFeeId: row.studentFeeId,
        amount: row.amount,
        currency: row.currency,
        paymentDate: row.paymentDate,
        method: enumValue(PaymentMethod, row.method, 'payments.method'),
        status: enumValue(PaymentStatus, row.status, 'payments.status'),
        reference: row.reference,
        notes: row.notes,
        recordedById: row.recordedById,
        reversedAt: row.reversedAt,
        reversedById: row.reversedById,
        cancelledAt: row.cancelledAt,
        cancelledById: row.cancelledById,
        createdAt: row.createdAt,
      }),
    ),

    schedules: defaultStore(db, schema.schedules, ScheduleCtor),
    lessonSessions: customStore(
      db,
      schema.lessonSessions,
      (entity: LessonSession) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        classGroupId: entity.classGroupId,
        scheduleId: entity.scheduleId ?? null,
        timetableGenerated: entity.timetableGenerated ?? null,
        timetableTeacherIds: entity.timetableTeacherIds,
        classSubjectId: entity.classSubjectId,
        status: entity.status,
        isException: entity.isException,
        startsAt: entity.startsAt,
        endsAt: entity.endsAt,
        calendarDate: new Date(Date.UTC(
          entity.startsAt.getUTCFullYear(),
          entity.startsAt.getUTCMonth(),
          entity.startsAt.getUTCDate(),
        )),
        displayLabel: entity.displayLabel,
        sessionNote: entity.sessionNote ?? null,
        createdAt: entity.createdAt,
      }),
      row => new LessonSessionCtor({
        id: row.id,
        schoolId: row.schoolId,
        classGroupId: row.classGroupId,
        scheduleId: row.scheduleId ?? undefined,
        timetableGenerated: row.timetableGenerated
          ? enumValue(TimetableGenerated, row.timetableGenerated, 'lessonSessions.timetableGenerated')
          : undefined,
        timetableTeacherIds: row.timetableTeacherIds as string[],
        classSubjectId: row.classSubjectId,
        status: enumValue(OccurrenceStatus, row.status, 'lessonSessions.status'),
        isException: row.isException,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        displayLabel: row.displayLabel,
        sessionNote: row.sessionNote ?? undefined,
        createdAt: row.createdAt,
      }),
    ),
    activitySessions: customStore(
      db,
      schema.activitySessions,
      (entity: ActivitySession) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        classGroupId: entity.classGroupId,
        scheduleId: entity.scheduleId,
        activityId: entity.activityId,
        status: entity.status,
        isException: entity.isException,
        startsAt: entity.startsAt,
        endsAt: entity.endsAt,
        calendarDate: new Date(Date.UTC(
          entity.startsAt.getUTCFullYear(),
          entity.startsAt.getUTCMonth(),
          entity.startsAt.getUTCDate(),
        )),
        displayLabel: entity.displayLabel,
        notes: entity.notes ?? null,
        createdAt: entity.createdAt,
      }),
      row => new ActivitySessionCtor({
        id: row.id,
        schoolId: row.schoolId,
        classGroupId: row.classGroupId,
        scheduleId: row.scheduleId,
        activityId: row.activityId,
        status: enumValue(OccurrenceStatus, row.status, 'activitySessions.status'),
        isException: row.isException,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        displayLabel: row.displayLabel,
        notes: row.notes ?? undefined,
        createdAt: row.createdAt,
      }),
    ),
    attendances: defaultStore(db, schema.attendances, AttendanceCtor),

    calendarEvents: customStore(
      db,
      schema.calendarEvents,
      (entity: CalendarEvent) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        academicYearId: entity.academicYearId,
        title: entity.title,
        description: entity.description ?? null,
        startDate: entity.startDate,
        endDate: entity.endDate,
        kind: entity.kind,
        isNonSchoolDay: entity.isNonSchoolDay,
        scopeKind: entity.scopeKind,
        scopeId: entity.scopeId ?? null,
        createdAt: entity.createdAt,
      }),
      row => new CalendarEventCtor({
        id: row.id,
        schoolId: row.schoolId,
        academicYearId: row.academicYearId,
        title: row.title,
        description: row.description ?? undefined,
        startDate: row.startDate,
        endDate: row.endDate,
        kind: enumValue(CalendarEventKind, row.kind, 'calendarEvents.kind'),
        isNonSchoolDay: row.isNonSchoolDay,
        scopeKind: enumValue(CalendarEventScopeKind, row.scopeKind, 'calendarEvents.scopeKind'),
        scopeId: row.scopeId,
        createdAt: row.createdAt,
      }),
    ),

    attendance: customStore(
      db,
      schema.attendanceRecords,
      (entity: AttendanceRecord) => ({
        id: entity.id,
        studentId: entity.studentId,
        attendanceId: entity.attendanceId ?? null,
        lessonSessionId: entity.lessonSessionId ?? null,
        activitySessionId: entity.activitySessionId ?? null,
        assessmentId: entity.assessmentId ?? null,
        date: entity.date,
        status: entity.status,
        justificationStatus: entity.justificationStatus,
        reason: entity.reason ?? null,
        notes: entity.notes ?? null,
        justifiedAt: entity.justifiedAt ?? null,
        justifiedByStaffId: entity.justifiedByStaffId ?? null,
        correctedAt: entity.correctedAt ?? null,
        correctedByStaffId: entity.correctedByStaffId ?? null,
        createdBy: entity.createdBy ?? null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      }),
      row => new AttendanceRecordCtor({
        id: row.id,
        studentId: row.studentId,
        attendanceId: row.attendanceId ?? undefined,
        lessonSessionId: row.lessonSessionId ?? undefined,
        activitySessionId: row.activitySessionId ?? undefined,
        assessmentId: row.assessmentId ?? undefined,
        date: row.date,
        status: enumValue(AttendanceStatus, row.status, 'attendanceRecords.status'),
        justificationStatus: enumValue(AttendanceJustificationStatus, row.justificationStatus, 'attendanceRecords.justificationStatus'),
        reason: row.reason,
        notes: row.notes,
        justifiedAt: row.justifiedAt,
        justifiedByStaffId: row.justifiedByStaffId,
        correctedAt: row.correctedAt,
        correctedByStaffId: row.correctedByStaffId,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    ),

    announcements: customStore(
      db,
      schema.announcements,
      (entity: Announcement) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        title: entity.title,
        content: entity.content,
        createdBy: entity.createdBy ?? null,
        status: entity.status,
        priority: entity.priority,
        createdAt: entity.createdAt,
        publishedAt: entity.publishedAt ?? null,
        expiresAt: entity.expiresAt ?? null,
      }),
      row => new AnnouncementCtor({
        id: row.id,
        schoolId: row.schoolId,
        title: row.title,
        content: row.content,
        createdBy: row.createdBy,
        status: enumValue(AnnouncementStatus, row.status, 'announcements.status'),
        priority: enumValue(AnnouncementPriority, row.priority, 'announcements.priority'),
        createdAt: row.createdAt,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
      }),
    ),

    announcementTargets: defaultStore(db, schema.announcementTargets, AnnouncementTargetCtor),
    messageDeliveries: defaultStore(db, schema.messageDeliveries, MessageDeliveryCtor),
    subjects: defaultStore(db, schema.subjects, SubjectCtor),

    subjectMatters: customStore(
      db,
      schema.subjectMatters,
      (entity: SubjectMatter) => ({
        id: entity.id,
        subjectId: entity.subjectId,
        name: entity.name,
        description: entity.description ?? null,
        sequenceOrder: entity.sequenceOrder,
        estimatedHours: entity.estimatedHours ?? null,
        createdAt: entity.createdAt,
      }),
      row => new SubjectMatterCtor({
        id: row.id,
        subjectId: row.subjectId,
        name: row.name,
        description: row.description,
        sequenceOrder: row.sequenceOrder,
        estimatedHours: row.estimatedHours,
        createdAt: row.createdAt,
      }),
    ),

    gradeLevelSubjects: customStore(
      db,
      schema.gradeLevelSubjects,
      (entity: GradeLevelSubject) => ({
        id: entity.id,
        gradeLevelId: entity.gradeLevelId,
        academicYearId: entity.academicYearId,
        subjectId: entity.subjectId,
        coefficient: entity.coefficient ?? null,
        periodsPerWeek: entity.periodsPerWeek ?? null,
        minPeriodSpan: entity.minPeriodSpan ?? null,
        maxPeriodSpan: entity.maxPeriodSpan ?? null,
        isOptional: entity.isOptional,
        createdAt: entity.createdAt,
      }),
      row => new GradeLevelSubjectCtor({
        id: row.id,
        gradeLevelId: row.gradeLevelId,
        academicYearId: row.academicYearId,
        subjectId: row.subjectId,
        coefficient: row.coefficient,
        periodsPerWeek: row.periodsPerWeek,
        minPeriodSpan: row.minPeriodSpan,
        maxPeriodSpan: row.maxPeriodSpan,
        isOptional: row.isOptional,
        createdAt: row.createdAt,
      }),
    ),

    gradeLevelSubjectMatters: defaultStore(db, schema.gradeLevelSubjectMatters, GradeLevelSubjectMatterCtor),

    classGroups: defaultStore(db, schema.classGroups, ClassGroupCtor),

    classSubjects: customStore(
      db,
      schema.classSubjects,
      (entity: ClassSubject) => ({
        id: entity.id,
        classGroupId: entity.classGroupId,
        subjectId: entity.subjectId,
        gradeLevelSubjectId: entity.gradeLevelSubjectId ?? null,
        coefficient: entity.coefficient ?? null,
        periodsPerWeek: entity.periodsPerWeek ?? null,
        minPeriodSpan: entity.minPeriodSpan ?? null,
        maxPeriodSpan: entity.maxPeriodSpan ?? null,
        completedPercentage: entity.completedPercentage,
        isOffered: entity.isOffered,
        createdAt: entity.createdAt,
      }),
      row => new ClassSubjectCtor({
        id: row.id,
        classGroupId: row.classGroupId,
        subjectId: row.subjectId,
        gradeLevelSubjectId: row.gradeLevelSubjectId,
        coefficient: row.coefficient,
        periodsPerWeek: row.periodsPerWeek,
        minPeriodSpan: row.minPeriodSpan,
        maxPeriodSpan: row.maxPeriodSpan,
        completedPercentage: row.completedPercentage,
        isOffered: row.isOffered,
        createdAt: row.createdAt,
      }),
    ),

    classSubjectMatters: customStore(
      db,
      schema.classSubjectMatters,
      (entity: ClassSubjectMatter) => ({
        id: entity.id,
        classSubjectId: entity.classSubjectId,
        subjectMatterId: entity.subjectMatterId,
        status: entity.status,
        completedPercentage: entity.completedPercentage,
        updatedByStaffId: entity.updatedByStaffId ?? null,
        startedAt: entity.startedAt ?? null,
        completedAt: entity.completedAt ?? null,
        notes: entity.notes ?? null,
        updatedAt: entity.updatedAt,
      }),
      row => new ClassSubjectMatterCtor({
        id: row.id,
        classSubjectId: row.classSubjectId,
        subjectMatterId: row.subjectMatterId,
        status: enumValue(ClassSubjectMatterStatus, row.status, 'classSubjectMatters.status'),
        completedPercentage: row.completedPercentage,
        updatedByStaffId: row.updatedByStaffId,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        notes: row.notes,
        updatedAt: row.updatedAt,
      }),
    ),

    classSubjectProgress: customStore(
      db,
      schema.classSubjectProgress,
      (entity: ClassSubjectProgress) => ({
        id: entity.id,
        classSubjectMatterId: entity.classSubjectMatterId,
        lessonSessionId: entity.lessonSessionId,
        completedPercentage: entity.completedPercentage,
        recordedByStaffId: entity.recordedByStaffId ?? null,
        notes: entity.notes ?? null,
        recordedAt: entity.recordedAt,
      }),
      row => new ClassSubjectProgressCtor({
        id: row.id,
        classSubjectMatterId: row.classSubjectMatterId,
        lessonSessionId: row.lessonSessionId,
        completedPercentage: row.completedPercentage,
        recordedByStaffId: row.recordedByStaffId,
        notes: row.notes,
        recordedAt: row.recordedAt,
      }),
    ),

    activities: customStore(
      db,
      schema.activities,
      (entity: Activity) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        category: entity.category,
        coach: entity.coach,
        schedule: entity.schedule,
        participants: entity.participants,
        capacity: entity.capacity,
        description: entity.description,
        startDate: entity.startDate,
        endDate: entity.endDate,
        createdAt: entity.createdAt,
      }),
      row => new ActivityCtor({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        category: row.category as Activity['category'],
        coach: row.coach,
        schedule: row.schedule,
        participants: row.participants,
        capacity: row.capacity,
        description: row.description,
        startDate: row.startDate,
        endDate: row.endDate,
        createdAt: row.createdAt,
      }),
    ),

    activityEnrollments: defaultStore(db, schema.activityEnrollments, ActivityEnrollmentCtor),

    classActivityEnrollments: defaultStore(db, schema.classActivityEnrollments, ClassActivityEnrollmentCtor),

    assessments: customStore(
      db,
      schema.assessments,
      (entity: Assessment) => ({
        id: entity.id,
        classGroupId: entity.classGroupId,
        classSubjectId: entity.classSubjectId,
        periodId: entity.periodId,
        title: entity.title,
        kind: entity.kind,
        maxScore: entity.maxScore,
        coefficient: entity.coefficient,
        description: entity.description ?? null,
        attachments: entity.attachments,
        lessonSessionId: entity.lessonSessionId ?? null,
        startsAt: entity.startsAt ?? null,
        endsAt: entity.endsAt ?? null,
        dueAt: entity.dueAt ?? null,
        completedAt: entity.completedAt ?? null,
        createdAt: entity.createdAt,
      }),
      row => new AssessmentCtor({
        id: row.id,
        classGroupId: row.classGroupId,
        classSubjectId: row.classSubjectId,
        periodId: row.periodId,
        title: row.title,
        kind: enumValue(AssessmentKind, row.kind, 'assessments.kind'),
        maxScore: row.maxScore,
        coefficient: row.coefficient,
        description: row.description ?? undefined,
        attachments: deserializeJsonb(row.attachments) ?? [],
        lessonSessionId: row.lessonSessionId ?? undefined,
        startsAt: row.startsAt ?? undefined,
        endsAt: row.endsAt ?? undefined,
        dueAt: row.dueAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
      }),
    ),

    assessmentResults: customStore(
      db,
      schema.assessmentResults,
      (entity: AssessmentResult) => ({
        id: entity.id,
        studentId: entity.studentId,
        assessmentId: entity.assessmentId,
        score: entity.score ?? null,
        status: entity.status ?? null,
        notes: entity.notes ?? null,
        createdBy: entity.createdBy ?? null,
        createdAt: entity.createdAt,
      }),
      row => new AssessmentResultCtor({
        id: row.id,
        studentId: row.studentId,
        assessmentId: row.assessmentId,
        score: row.score,
        status: row.status === null ? undefined : enumValue(DeadlineComplianceStatus, row.status, 'assessmentResults.status'),
        notes: row.notes,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      }),
    ),

    gradeScales: customStore(
      db,
      schema.gradeScales,
      (entity: GradeScale) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        minScore: entity.minScore,
        maxScore: entity.maxScore,
        ranges: entity.ranges,
        decimalPlaces: entity.decimalPlaces,
        description: entity.description,
        isDefault: entity.isDefault,
        createdAt: entity.createdAt,
      }),
      row => new GradeScaleCtor({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        minScore: row.minScore,
        maxScore: row.maxScore,
        ranges: deserializeJsonb(row.ranges) || [],
        decimalPlaces: row.decimalPlaces,
        description: row.description,
        isDefault: row.isDefault,
        createdAt: row.createdAt,
      }),
    ),

    definitions: defaultStore(db, schema.reportCardDefinitions, ReportCardDefinitionCtor),

    sections: customStore(
      db,
      schema.reportCardDefinitionSections,
      (entity: ReportCardDefinitionSection) => ({
        id: entity.id,
        definitionId: entity.reportCardDefinitionId,
        name: entity.name,
        role: entity.role ?? null,
        coefficient: entity.coefficient ?? null,
        order: entity.order,
        weight: entity.weight,
        parentSectionId: entity.parentSectionId ?? null,
        subjectId: entity.subjectId ?? null,
        createdAt: entity.createdAt,
      }),
      row => new ReportCardDefinitionSectionCtor({
        id: row.id,
        reportCardDefinitionId: row.definitionId,
        name: row.name,
        kind: row.subjectId
          ? ReportCardDefinitionSectionKind.Subject
          : ReportCardDefinitionSectionKind.Group,
        role: row.role ?? undefined,
        coefficient: row.coefficient ?? undefined,
        order: row.order,
        weight: row.weight,
        parentSectionId: row.parentSectionId,
        subjectId: row.subjectId,
        createdAt: row.createdAt,
      }),
    ),

    results: customStore(
      db,
      schema.reportCardResults,
      (entity: ReportCardResult) => ({
        id: entity.id,
        studentId: entity.studentId,
        classGroupId: entity.classGroupId,
        periodId: entity.periodId,
        reportCardDefinitionId: entity.reportCardDefinitionId,
        sectionResults: entity.sectionResults.map(serializeReportCardResultSection),
        attendanceSummary: entity.attendanceSummary,
        assessmentResultCount: entity.assessmentResultCount,
        overallAverage: entity.overallAverage ?? null,
        rank: entity.rank ?? null,
        classSize: entity.classSize ?? null,
        passThreshold: entity.passThreshold ?? null,
        teacherComment: entity.teacherComment ?? null,
        principalComment: entity.principalComment ?? null,
        status: entity.status,
        generatedAt: entity.generatedAt,
        publishedAt: entity.publishedAt ?? null,
        aggregation: entity.aggregation ?? null,
      }),
      (row) => {
        const sectionsData = deserializeJsonb(row.sectionResults) || []
        const attendanceData = deserializeJsonb(row.attendanceSummary)

        return new ReportCardResultCtor({
          id: row.id,
          reportCardDefinitionId: row.reportCardDefinitionId,
          studentId: row.studentId,
          classGroupId: row.classGroupId,
          periodId: row.periodId,
          sectionResults: (sectionsData as StoredReportCardResultSection[]).map(deserializeReportCardResultSection),
          attendanceSummary: new AttendanceSummary(attendanceData),
          assessmentResultCount: row.assessmentResultCount,
          overallAverage: row.overallAverage,
          rank: row.rank,
          classSize: row.classSize,
          passThreshold: row.passThreshold,
          teacherComment: row.teacherComment,
          principalComment: row.principalComment,
          status: enumValue(ReportCardResultStatus, row.status, 'reportCardResults.status'),
          generatedAt: row.generatedAt,
          publishedAt: row.publishedAt,
          aggregation: row.aggregation ?? undefined,
        })
      },
    ),

    students: defaultStore(db, schema.students, StudentCtor),
    enrollments: defaultStore(db, schema.studentClassEnrollments, StudentClassEnrollmentCtor),

    guardians: customStore(
      db,
      schema.guardians,
      (entity: Guardian) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        firstName: entity.firstName,
        lastName: entity.lastName,
        code: entity.code ?? null,
        photoUrl: entity.photoUrl ?? null,
        email: entity.email ?? null,
        phone: entity.phone ?? null,
        notificationEmail: entity.notificationEmail ?? null,
        notificationPhone: entity.notificationPhone ?? null,
        subjectId: entity.subjectId ?? null,
        contactMethods: entity.contactMethods.map(method => ({
          type: method.type,
          value: method.value,
          label: method.label,
          isPrimary: method.isPrimary,
          allowsNotifications: method.allowsNotifications,
        })),
        createdAt: entity.createdAt,
      }),
      row => new GuardianCtor({
        id: row.id,
        schoolId: row.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        code: row.code,
        photoUrl: row.photoUrl,
        email: row.email,
        phone: row.phone,
        notificationEmail: row.notificationEmail,
        notificationPhone: row.notificationPhone,
        subjectId: row.subjectId,
        contactMethods: deserializeJsonb(row.contactMethods),
        createdAt: row.createdAt,
      }),
    ),

    guardianLinks: defaultStore(db, schema.guardianStudentLinks, GuardianStudentLinkCtor),
    studentNotes: defaultStore(db, schema.studentNotes, StudentNoteCtor),

    studentHealthProfiles: customStore(
      db,
      schema.studentHealthProfiles,
      createDefaultMappers(StudentHealthProfileCtor).toRow,
      row => new StudentHealthProfileCtor({
        id: row.id,
        schoolId: row.schoolId,
        studentId: row.studentId,
        bloodType: row.bloodType,
        allergies: deserializeJsonb(row.allergies),
        medicalConditions: deserializeJsonb(row.medicalConditions),
        medications: row.medications ?? undefined,
        clinicalNotes: row.clinicalNotes ?? undefined,
        lastVisit: row.lastVisit ?? undefined,
        createdAt: row.createdAt,
      }),
    ),

    studentDisciplinaryActions: defaultStore(db, schema.studentDisciplinaryActions, StudentDisciplinaryActionCtor),
    disciplinaryActions: defaultStore(db, schema.disciplinaryActions, DisciplinaryActionCtor),
    studentIncidentInvolvements: defaultStore(db, schema.studentIncidentInvolvements, StudentIncidentInvolvementCtor),
    incidents: defaultStore(db, schema.incidents, IncidentCtor),
  }
}
