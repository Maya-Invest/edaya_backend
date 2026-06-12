import type {
  AcademicPeriod,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  AttendanceRecord,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  DisciplinaryAction,
  Fee,
  GradeLevel,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  Incident,
  MessageDelivery,
  Payment,
  PeriodDefinition,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  ReportCardResultSection,
  Resource,
  ResourceAssignment,
  Schedule,
  School,
  Session,
  StaffAssignment,
  StaffMember,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
  Subject,
  SubjectMatter,
} from '@edaya/core'
import type { PostgresStore } from '../postgres-store'
import {
  AcademicPeriod as AcademicPeriodCtor,
  AcademicYear as AcademicYearCtor,
  Announcement as AnnouncementCtor,
  AnnouncementTarget as AnnouncementTargetCtor,
  Assessment as AssessmentCtor,
  AssessmentResult as AssessmentResultCtor,
  Attachment as AttachmentCtor,
  AttendanceRecord as AttendanceRecordCtor,
  AttendanceSummary,
  CalendarEvent as CalendarEventCtor,
  ClassGroup as ClassGroupCtor,
  ClassSubject as ClassSubjectCtor,
  ClassSubjectMatter as ClassSubjectMatterCtor,
  ClassSubjectProgress as ClassSubjectProgressCtor,
  DisciplinaryAction as DisciplinaryActionCtor,
  Fee as FeeCtor,
  GradeLevel as GradeLevelCtor,
  GradeScale as GradeScaleCtor,
  Guardian as GuardianCtor,
  GuardianStudentLink as GuardianStudentLinkCtor,
  Incident as IncidentCtor,
  MessageDelivery as MessageDeliveryCtor,
  Payment as PaymentCtor,
  PeriodDefinition as PeriodDefinitionCtor,
  ReportCardDefinition as ReportCardDefinitionCtor,
  ReportCardDefinitionSection as ReportCardDefinitionSectionCtor,
  ReportCardDefinitionSectionKind,
  ReportCardResult as ReportCardResultCtor,
  ReportCardResultSection as ReportCardResultSectionCtor,
  ResourceAssignment as ResourceAssignmentCtor,
  Resource as ResourceCtor,
  Schedule as ScheduleCtor,
  School as SchoolCtor,
  Session as SessionCtor,
  StaffAssignment as StaffAssignmentCtor,
  StaffMember as StaffMemberCtor,
  StudentClassEnrollment as StudentClassEnrollmentCtor,
  Student as StudentCtor,
  StudentDisciplinaryAction as StudentDisciplinaryActionCtor,
  StudentFee as StudentFeeCtor,
  StudentHealthProfile as StudentHealthProfileCtor,
  StudentIncidentInvolvement as StudentIncidentInvolvementCtor,
  StudentNote as StudentNoteCtor,
  Subject as SubjectCtor,
  SubjectMatter as SubjectMatterCtor,
} from '@edaya/core'
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
  attachments: PostgresStore<Attachment>
  resources: PostgresStore<Resource>
  resourceAssignments: PostgresStore<ResourceAssignment>
  fees: PostgresStore<Fee>
  studentFees: PostgresStore<StudentFee>
  payments: PostgresStore<Payment>
  schedules: PostgresStore<Schedule>
  sessions: PostgresStore<Session>
  calendarEvents: PostgresStore<CalendarEvent>
  attendance: PostgresStore<AttendanceRecord>
  announcements: PostgresStore<Announcement>
  announcementTargets: PostgresStore<AnnouncementTarget>
  messageDeliveries: PostgresStore<MessageDelivery>
  subjects: PostgresStore<Subject>
  subjectMatters: PostgresStore<SubjectMatter>
  classGroups: PostgresStore<ClassGroup>
  classSubjects: PostgresStore<ClassSubject>
  classSubjectMatters: PostgresStore<ClassSubjectMatter>
  classSubjectProgress: PostgresStore<ClassSubjectProgress>
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
        email: entity.email ?? null,
        subjectId: entity.subjectId ?? null,
        isActive: entity.isActive,
        createdAt: entity.createdAt,
      }),
      row => new StaffMemberCtor({
        id: row.id,
        schoolId: row.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        subjectId: row.subjectId,
        isActive: row.isActive,
        createdAt: row.createdAt,
      }),
    ),

    staffAssignments: customStore(
      db,
      schema.staffAssignments,
      (entity: StaffAssignment) => ({
        id: entity.id,
        staffId: entity.staffId,
        role: entity.responsibility,
        classGroupId: entity.classGroupId ?? null,
        classSubjectId: entity.classSubjectId ?? null,
        sessionId: entity.sessionId ?? null,
        createdAt: entity.createdAt,
      }),
      row => new StaffAssignmentCtor({
        id: row.id,
        staffId: row.staffId,
        responsibility: row.role,
        classGroupId: row.classGroupId ?? undefined,
        classSubjectId: row.classSubjectId ?? undefined,
        sessionId: row.sessionId ?? undefined,
        createdAt: row.createdAt,
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
        kind: row.kind as any,
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
        category: row.category as any,
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
        status: row.status as any,
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
        method: row.method as any,
        status: row.status as any,
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
    sessions: defaultStore(db, schema.sessions, SessionCtor),

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
        kind: row.kind as any,
        isNonSchoolDay: row.isNonSchoolDay,
        scopeKind: row.scopeKind as any,
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
        sessionId: entity.sessionId,
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
        sessionId: row.sessionId,
        date: row.date,
        status: row.status as any,
        justificationStatus: row.justificationStatus as any,
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
        premiumNotification: entity.premiumNotification,
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
        status: row.status as any,
        priority: row.priority as any,
        premiumNotification: row.premiumNotification,
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

    classGroups: defaultStore(db, schema.classGroups, ClassGroupCtor),

    classSubjects: customStore(
      db,
      schema.classSubjects,
      (entity: ClassSubject) => ({
        id: entity.id,
        classGroupId: entity.classGroupId,
        subjectId: entity.subjectId,
        coefficient: entity.coefficient ?? null,
        completedPercentage: entity.completedPercentage,
        createdAt: entity.createdAt,
      }),
      row => new ClassSubjectCtor({
        id: row.id,
        classGroupId: row.classGroupId,
        subjectId: row.subjectId,
        coefficient: row.coefficient,
        completedPercentage: row.completedPercentage,
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
        status: row.status as any,
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
        sessionId: entity.sessionId,
        completedPercentage: entity.completedPercentage,
        recordedByStaffId: entity.recordedByStaffId ?? null,
        notes: entity.notes ?? null,
        recordedAt: entity.recordedAt,
      }),
      row => new ClassSubjectProgressCtor({
        id: row.id,
        classSubjectMatterId: row.classSubjectMatterId,
        sessionId: row.sessionId,
        completedPercentage: row.completedPercentage,
        recordedByStaffId: row.recordedByStaffId,
        notes: row.notes,
        recordedAt: row.recordedAt,
      }),
    ),

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
        sessionId: entity.sessionId ?? null,
        dueAt: entity.dueAt ?? null,
        metAt: entity.metAt ?? null,
        date: entity.date ?? null,
        createdAt: entity.createdAt,
      }),
      row => new AssessmentCtor({
        id: row.id,
        classGroupId: row.classGroupId,
        classSubjectId: row.classSubjectId,
        periodId: row.periodId,
        title: row.title,
        kind: row.kind as any,
        maxScore: row.maxScore,
        coefficient: row.coefficient,
        sessionId: row.sessionId,
        dueAt: row.dueAt,
        metAt: row.metAt,
        date: row.date,
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
        status: row.status as any,
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
          status: row.status as any,
          generatedAt: row.generatedAt,
          publishedAt: row.publishedAt,
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
        email: entity.email ?? null,
        phone: entity.phone ?? null,
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
        email: row.email,
        phone: row.phone,
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
        bloodType: row.bloodType as any,
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
