import type {
  AtomicExecutionPort,
  SchoolRepositories,
} from '@edaya/core'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  AcademicPeriod,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  AttendanceRecord,
  AttendanceSummary,
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
import { sql } from 'drizzle-orm'
import * as schema from './postgres-schema'
import { createDefaultMappers, deserializeJsonb, PostgresStore } from './postgres-store'

export const transactionContext = new AsyncLocalStorage<any>()

export class PostgresAtomicExecution implements AtomicExecutionPort {
  constructor(private readonly db: any) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const activeTransaction = transactionContext.getStore()
    if (activeTransaction) {
      return await operation()
    }

    return await this.db.transaction(async (tx: any) => {
      return await transactionContext.run(tx, async () => {
        return await operation()
      })
    })
  }
}

export class PostgresSchoolRepositories implements SchoolRepositories {
  public readonly schoolsStore: PostgresStore<School>
  public readonly academicYears: PostgresStore<AcademicYear>
  public readonly academicPeriods: PostgresStore<AcademicPeriod>
  public readonly periodDefinitions: PostgresStore<PeriodDefinition>
  public readonly gradeLevels: PostgresStore<GradeLevel>
  public readonly staffMembers: PostgresStore<StaffMember>
  public readonly staffAssignments: PostgresStore<StaffAssignment>
  public readonly attachments: PostgresStore<Attachment>
  public readonly resources: PostgresStore<Resource>
  public readonly resourceAssignments: PostgresStore<ResourceAssignment>

  public readonly fees: PostgresStore<Fee>
  public readonly studentFees: PostgresStore<StudentFee>
  public readonly payments: PostgresStore<Payment>

  public readonly schedules: PostgresStore<Schedule>
  public readonly sessions: PostgresStore<Session>
  public readonly calendarEvents: PostgresStore<CalendarEvent>
  public readonly attendance: PostgresStore<AttendanceRecord>

  public readonly announcements: PostgresStore<Announcement>
  public readonly announcementTargets: PostgresStore<AnnouncementTarget>
  public readonly messageDeliveries: PostgresStore<MessageDelivery>

  public readonly subjects: PostgresStore<Subject>
  public readonly subjectMatters: PostgresStore<SubjectMatter>
  public readonly classGroups: PostgresStore<ClassGroup>
  public readonly classSubjects: PostgresStore<ClassSubject>
  public readonly classSubjectMatters: PostgresStore<ClassSubjectMatter>
  public readonly classSubjectProgress: PostgresStore<ClassSubjectProgress>

  public readonly assessments: PostgresStore<Assessment>
  public readonly assessmentResults: PostgresStore<AssessmentResult>
  public readonly gradeScales: PostgresStore<GradeScale>
  public readonly definitions: PostgresStore<ReportCardDefinition>
  public readonly sections: PostgresStore<ReportCardDefinitionSection>
  public readonly results: PostgresStore<ReportCardResult>

  public readonly students: PostgresStore<Student>
  public readonly enrollments: PostgresStore<StudentClassEnrollment>
  public readonly guardians: PostgresStore<Guardian>
  public readonly guardianLinks: PostgresStore<GuardianStudentLink>
  public readonly studentNotes: PostgresStore<StudentNote>
  public readonly studentHealthProfiles: PostgresStore<StudentHealthProfile>
  public readonly studentDisciplinaryActions: PostgresStore<StudentDisciplinaryAction>
  public readonly disciplinaryActions: PostgresStore<DisciplinaryAction>
  public readonly studentIncidentInvolvements: PostgresStore<StudentIncidentInvolvement>
  public readonly incidents: PostgresStore<Incident>

  public readonly schools: SchoolRepositories['schools']

  constructor(private readonly db: any) {
    // 1. Schools Store
    this.schoolsStore = new PostgresStore(
      db,
      schema.schools,
      createDefaultMappers(School).toRow,
      createDefaultMappers(School).toDomain,
    )

    // 2. Academic Years Store (Custom isActive mapping)
    this.academicYears = new PostgresStore(
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
      row => new AcademicYear({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        isActive: row.isActive,
        createdAt: row.createdAt,
      }),
    )

    // 3. Academic Periods Store
    this.academicPeriods = new PostgresStore(
      db,
      schema.academicPeriods,
      createDefaultMappers(AcademicPeriod).toRow,
      createDefaultMappers(AcademicPeriod).toDomain,
    )

    // 4. Period Definitions Store
    this.periodDefinitions = new PostgresStore(
      db,
      schema.periodDefinitions,
      createDefaultMappers(PeriodDefinition).toRow,
      createDefaultMappers(PeriodDefinition).toDomain,
    )

    // 5. Grade Levels Store
    this.gradeLevels = new PostgresStore(
      db,
      schema.gradeLevels,
      createDefaultMappers(GradeLevel).toRow,
      createDefaultMappers(GradeLevel).toDomain,
    )

    // 6. Staff Members Store (Custom roles & isActive mapping)
    this.staffMembers = new PostgresStore(
      db,
      schema.staffMembers,
      (entity: StaffMember) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        firstName: entity.firstName,
        lastName: entity.lastName,
        email: entity.email ?? null,
        subjectId: entity.subjectId ?? null,
        roles: entity.roles,
        isActive: entity.isActive,
        createdAt: entity.createdAt,
      }),
      row => new StaffMember({
        id: row.id,
        schoolId: row.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        subjectId: row.subjectId,
        roles: deserializeJsonb(row.roles),
        isActive: row.isActive,
        createdAt: row.createdAt,
      }),
    )

    // 7. Staff Assignments Store
    this.staffAssignments = new PostgresStore(
      db,
      schema.staffAssignments,
      createDefaultMappers(StaffAssignment).toRow,
      createDefaultMappers(StaffAssignment).toDomain,
    )

    // 8. Attachments Store
    this.attachments = new PostgresStore(
      db,
      schema.attachments,
      createDefaultMappers(Attachment).toRow,
      createDefaultMappers(Attachment).toDomain,
    )

    // 9. Resources Store (Custom kind & capacity mapping)
    this.resources = new PostgresStore(
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
      row => new Resource({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        description: row.description,
        kind: row.kind as any,
        capacity: row.capacity,
        createdAt: row.createdAt,
      }),
    )

    // 10. Resource Assignments Store
    this.resourceAssignments = new PostgresStore(
      db,
      schema.resourceAssignments,
      createDefaultMappers(ResourceAssignment).toRow,
      createDefaultMappers(ResourceAssignment).toDomain,
    )

    // 11. Fees Store (Custom defaultAmount & installments mapping)
    this.fees = new PostgresStore(
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
      row => new Fee({
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
    )

    // 12. Student Fees Store (Custom expectedAmount, paidAmount, adjustmentAmount, currency mapping, no schoolId)
    this.studentFees = new PostgresStore(
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
      row => new StudentFee({
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
    )

    // 13. Payments Store (Custom amount & currency mapping, no schoolId)
    this.payments = new PostgresStore(
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
      row => new Payment({
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
    )

    // 14. Schedules Store
    this.schedules = new PostgresStore(
      db,
      schema.schedules,
      createDefaultMappers(Schedule).toRow,
      createDefaultMappers(Schedule).toDomain,
    )

    // 15. Sessions Store
    this.sessions = new PostgresStore(
      db,
      schema.sessions,
      createDefaultMappers(Session).toRow,
      createDefaultMappers(Session).toDomain,
    )

    // 16. Calendar Events Store (Custom scope, kind mapping)
    this.calendarEvents = new PostgresStore(
      db,
      schema.calendarEvents,
      (entity: CalendarEvent) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        academicYearId: entity.academicYearId,
        title: entity.title,
        startDate: entity.startDate,
        endDate: entity.endDate,
        kind: entity.kind,
        isNonSchoolDay: entity.isNonSchoolDay,
        scopeKind: entity.scopeKind,
        scopeId: entity.scopeId ?? null,
        createdAt: entity.createdAt,
      }),
      row => new CalendarEvent({
        id: row.id,
        schoolId: row.schoolId,
        academicYearId: row.academicYearId,
        title: row.title,
        startDate: row.startDate,
        endDate: row.endDate,
        kind: row.kind as any,
        isNonSchoolDay: row.isNonSchoolDay,
        scopeKind: row.scopeKind as any,
        scopeId: row.scopeId,
        createdAt: row.createdAt,
      }),
    )

    // 17. Attendance Records Store (Custom justification status, no schoolId)
    this.attendance = new PostgresStore(
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
      row => new AttendanceRecord({
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
    )

    // 18. Announcements Store (Custom fields mapping)
    this.announcements = new PostgresStore(
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
      row => new Announcement({
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
    )

    // 19. Announcement Targets Store
    this.announcementTargets = new PostgresStore(
      db,
      schema.announcementTargets,
      createDefaultMappers(AnnouncementTarget).toRow,
      createDefaultMappers(AnnouncementTarget).toDomain,
    )

    // 20. Message Deliveries Store
    this.messageDeliveries = new PostgresStore(
      db,
      schema.messageDeliveries,
      createDefaultMappers(MessageDelivery).toRow,
      createDefaultMappers(MessageDelivery).toDomain,
    )

    // 21. Subjects Store
    this.subjects = new PostgresStore(
      db,
      schema.subjects,
      createDefaultMappers(Subject).toRow,
      createDefaultMappers(Subject).toDomain,
    )

    // 22. Subject Matters Store (Custom sequenceOrder, no schoolId)
    this.subjectMatters = new PostgresStore(
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
      row => new SubjectMatter({
        id: row.id,
        subjectId: row.subjectId,
        name: row.name,
        description: row.description,
        sequenceOrder: row.sequenceOrder,
        estimatedHours: row.estimatedHours,
        createdAt: row.createdAt,
      }),
    )

    // 23. Class Groups Store
    this.classGroups = new PostgresStore(
      db,
      schema.classGroups,
      createDefaultMappers(ClassGroup).toRow,
      createDefaultMappers(ClassGroup).toDomain,
    )

    // 24. Class Subjects Store (Custom completedPercentage, coefficient, no schoolId)
    this.classSubjects = new PostgresStore(
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
      row => new ClassSubject({
        id: row.id,
        classGroupId: row.classGroupId,
        subjectId: row.subjectId,
        coefficient: row.coefficient,
        completedPercentage: row.completedPercentage,
        createdAt: row.createdAt,
      }),
    )

    // 25. Class Subject Matters Store (Custom progress fields, no schoolId)
    this.classSubjectMatters = new PostgresStore(
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
      row => new ClassSubjectMatter({
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
    )

    // 26. Class Subject Progress Store (Custom progress mappings, no schoolId)
    this.classSubjectProgress = new PostgresStore(
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
      row => new ClassSubjectProgress({
        id: row.id,
        classSubjectMatterId: row.classSubjectMatterId,
        sessionId: row.sessionId,
        completedPercentage: row.completedPercentage,
        recordedByStaffId: row.recordedByStaffId,
        notes: row.notes,
        recordedAt: row.recordedAt,
      }),
    )

    // 27. Assessments Store (Custom titles/coefficients, no schoolId)
    this.assessments = new PostgresStore(
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
      row => new Assessment({
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
    )

    // 28. Assessment Results Store (Custom score/status, no schoolId)
    this.assessmentResults = new PostgresStore(
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
      row => new AssessmentResult({
        id: row.id,
        studentId: row.studentId,
        assessmentId: row.assessmentId,
        score: row.score,
        status: row.status as any,
        notes: row.notes,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      }),
    )

    // 29. Grade Scales Store (Custom bounds/ranges mapping)
    this.gradeScales = new PostgresStore(
      db,
      schema.gradeScales,
      (entity: GradeScale) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        minScore: entity.minScore,
        maxScore: entity.maxScore,
        ranges: entity.ranges,
        isDefault: entity.isDefault,
        createdAt: entity.createdAt,
      }),
      row => new GradeScale({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        minScore: row.minScore,
        maxScore: row.maxScore,
        ranges: deserializeJsonb(row.ranges) || [],
        isDefault: row.isDefault,
        createdAt: row.createdAt,
      }),
    )

    // 30. Report Card Definitions Store
    this.definitions = new PostgresStore(
      db,
      schema.reportCardDefinitions,
      createDefaultMappers(ReportCardDefinition).toRow,
      createDefaultMappers(ReportCardDefinition).toDomain,
    )

    // 31. Report Card Definition Sections Store (no schoolId)
    this.sections = new PostgresStore(
      db,
      schema.reportCardDefinitionSections,
      (entity: ReportCardDefinitionSection) => ({
        id: entity.id,
        definitionId: entity.reportCardDefinitionId,
        name: entity.name,
        order: entity.order,
        weight: entity.weight,
        parentSectionId: entity.parentSectionId ?? null,
        subjectId: entity.subjectId ?? null,
        createdAt: entity.createdAt,
      }),
      row => new ReportCardDefinitionSection({
        id: row.id,
        reportCardDefinitionId: row.definitionId,
        name: row.name,
        order: row.order,
        weight: row.weight,
        parentSectionId: row.parentSectionId,
        subjectId: row.subjectId,
        createdAt: row.createdAt,
      }),
    )

    // 32. Report Card Results Store (Custom sections/summary tree, no schoolId)
    this.results = new PostgresStore(
      db,
      schema.reportCardResults,
      (entity: ReportCardResult) => ({
        id: entity.id,
        studentId: entity.studentId,
        classGroupId: entity.classGroupId,
        periodId: entity.periodId,
        reportCardDefinitionId: entity.reportCardDefinitionId,
        sectionResults: entity.sectionResults,
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

        const mapSection = (s: any): ReportCardResultSection => {
          return new ReportCardResultSection({
            sectionId: s.sectionId,
            sectionKind: s.sectionKind,
            name: s.name,
            average: s.average,
            weight: s.weight,
            parentSectionId: s.parentSectionId,
            classSubjectId: s.classSubjectId,
            subResults: s.subResults?.map(mapSection),
          })
        }

        return new ReportCardResult({
          id: row.id,
          reportCardDefinitionId: row.reportCardDefinitionId,
          studentId: row.studentId,
          classGroupId: row.classGroupId,
          periodId: row.periodId,
          sectionResults: sectionsData.map(mapSection),
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
    )

    // 33. Students Store
    this.students = new PostgresStore(
      db,
      schema.students,
      createDefaultMappers(Student).toRow,
      createDefaultMappers(Student).toDomain,
    )

    // 34. Enrollments Store
    this.enrollments = new PostgresStore(
      db,
      schema.studentClassEnrollments,
      createDefaultMappers(StudentClassEnrollment).toRow,
      createDefaultMappers(StudentClassEnrollment).toDomain,
    )

    // 35. Guardians Store
    this.guardians = new PostgresStore(
      db,
      schema.guardians,
      createDefaultMappers(Guardian).toRow,
      row => new Guardian({
        id: row.id,
        schoolId: row.schoolId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        contactMethods: deserializeJsonb(row.contactMethods),
        createdAt: row.createdAt,
      }),
    )

    // 36. Guardian Links Store
    this.guardianLinks = new PostgresStore(
      db,
      schema.guardianStudentLinks,
      createDefaultMappers(GuardianStudentLink).toRow,
      createDefaultMappers(GuardianStudentLink).toDomain,
    )

    // 37. Student Notes Store
    this.studentNotes = new PostgresStore(
      db,
      schema.studentNotes,
      createDefaultMappers(StudentNote).toRow,
      createDefaultMappers(StudentNote).toDomain,
    )

    // 38. Student Health Profiles Store
    this.studentHealthProfiles = new PostgresStore(
      db,
      schema.studentHealthProfiles,
      createDefaultMappers(StudentHealthProfile).toRow,
      row => new StudentHealthProfile({
        id: row.id,
        schoolId: row.schoolId,
        studentId: row.studentId,
        bloodType: row.bloodType as any,
        allergies: deserializeJsonb(row.allergies),
        medicalConditions: deserializeJsonb(row.medicalConditions),
        createdAt: row.createdAt,
      }),
    )

    // 39. Student Disciplinary Actions Store
    this.studentDisciplinaryActions = new PostgresStore(
      db,
      schema.studentDisciplinaryActions,
      createDefaultMappers(StudentDisciplinaryAction).toRow,
      createDefaultMappers(StudentDisciplinaryAction).toDomain,
    )

    // 40. Disciplinary Actions Store
    this.disciplinaryActions = new PostgresStore(
      db,
      schema.disciplinaryActions,
      createDefaultMappers(DisciplinaryAction).toRow,
      createDefaultMappers(DisciplinaryAction).toDomain,
    )

    // 41. Student Incident Involvements Store
    this.studentIncidentInvolvements = new PostgresStore(
      db,
      schema.studentIncidentInvolvements,
      createDefaultMappers(StudentIncidentInvolvement).toRow,
      createDefaultMappers(StudentIncidentInvolvement).toDomain,
    )

    // 42. Incidents Store
    this.incidents = new PostgresStore(
      db,
      schema.incidents,
      createDefaultMappers(Incident).toRow,
      createDefaultMappers(Incident).toDomain,
    )

    // custom schools aggregate queries mapping
    this.schools = {
      findById: (id: string) => this.schoolsStore.findById(id),
      findOne: (options, last) => this.schoolsStore.findOne(options, last),
      findByIds: (ids: string[]) => this.schoolsStore.findByIds(ids),
      list: options => this.schoolsStore.list(options),
      count: filter => this.schoolsStore.count(filter),
      save: (entity: School) => this.schoolsStore.save(entity),
      delete: (id: string) => this.schoolsStore.delete(id),
      batchSave: (entities: School[]) => this.schoolsStore.batchSave(entities),
      batchDelete: (ids: string[]) => this.schoolsStore.batchDelete(ids),
      getOverdueFeeCount: async (schoolId: string): Promise<number> => {
        const schoolStudents = await this.students.list({ schoolId })
        const studentIds = new Set(schoolStudents.map(s => s.id))
        const allFees = await this.studentFees.list()
        return allFees.filter(f => studentIds.has(f.studentId) && f.status === 'overdue').length
      },
      getPublishedReportCardCount: async (schoolId: string): Promise<number> => {
        const schoolStudents = await this.students.list({ schoolId })
        const studentIds = new Set(schoolStudents.map(s => s.id))
        const rcs = await this.results.list()
        return rcs.filter(rc => studentIds.has(rc.studentId) && rc.status === 'published').length
      },
    }
  }

  async init(): Promise<void> {
    const createTableStatements = [
      `CREATE TABLE IF NOT EXISTS schools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        type TEXT,
        country TEXT,
        city TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS academic_years (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_active BOOLEAN NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS academic_periods (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS period_definitions (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS grade_levels (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        name TEXT NOT NULL,
        order_val INTEGER NOT NULL,
        cycle TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS staff_members (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        subject_id TEXT,
        roles JSONB NOT NULL,
        is_active BOOLEAN NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS staff_assignments (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        role TEXT NOT NULL,
        class_group_id TEXT,
        class_subject_id TEXT,
        session_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        owner_kind TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        uploaded_by_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        kind TEXT NOT NULL,
        capacity INTEGER,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS resource_assignments (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL,
        session_id TEXT,
        class_group_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS fees (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        default_amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        installments JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS student_fees (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        fee_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        expected_amount INTEGER NOT NULL,
        paid_amount INTEGER NOT NULL,
        adjustment_amount INTEGER NOT NULL,
        adjustment_reason TEXT,
        adjusted_by_id TEXT,
        adjusted_at TIMESTAMP,
        currency TEXT NOT NULL,
        due_date TIMESTAMP,
        status TEXT NOT NULL,
        cancellation_reason TEXT,
        cancelled_by_id TEXT,
        cancelled_at TIMESTAMP,
        installments JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        student_fee_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        payment_date TIMESTAMP NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        reference TEXT,
        notes TEXT,
        recorded_by_id TEXT,
        reversed_at TIMESTAMP,
        reversed_by_id TEXT,
        cancelled_at TIMESTAMP,
        cancelled_by_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        class_group_id TEXT NOT NULL,
        class_subject_id TEXT,
        title TEXT NOT NULL,
        is_recurring BOOLEAN NOT NULL,
        day_of_week TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        specific_date TIMESTAMP,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        class_group_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        starts_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        class_subject_id TEXT,
        schedule_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        title TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        kind TEXT NOT NULL,
        is_non_school_day BOOLEAN NOT NULL,
        scope_kind TEXT NOT NULL,
        scope_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        status TEXT NOT NULL,
        justification_status TEXT NOT NULL,
        reason TEXT,
        notes TEXT,
        justified_at TIMESTAMP,
        justified_by_staff_id TEXT,
        corrected_at TIMESTAMP,
        corrected_by_staff_id TEXT,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        premium_notification BOOLEAN NOT NULL,
        created_at TIMESTAMP NOT NULL,
        published_at TIMESTAMP,
        expires_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS announcement_targets (
        id TEXT PRIMARY KEY,
        announcement_id TEXT NOT NULL,
        target_kind TEXT NOT NULL,
        target_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS message_deliveries (
        id TEXT PRIMARY KEY,
        announcement_id TEXT NOT NULL,
        recipient_kind TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_message_id TEXT,
        failure_reason TEXT,
        sent_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT,
        default_coefficient INTEGER,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS subject_matters (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        sequence_order INTEGER NOT NULL,
        estimated_hours INTEGER,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS class_groups (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        grade_level_id TEXT NOT NULL,
        name TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS class_subjects (
        id TEXT PRIMARY KEY,
        class_group_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        coefficient INTEGER,
        created_at TIMESTAMP NOT NULL,
        completed_percentage INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS class_subject_matters (
        id TEXT PRIMARY KEY,
        class_subject_id TEXT NOT NULL,
        subject_matter_id TEXT NOT NULL,
        status TEXT NOT NULL,
        completed_percentage INTEGER NOT NULL,
        updated_by_staff_id TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        notes TEXT,
        updated_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS class_subject_progress (
        id TEXT PRIMARY KEY,
        class_subject_matter_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        completed_percentage INTEGER NOT NULL,
        recorded_by_staff_id TEXT,
        notes TEXT,
        recorded_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        class_group_id TEXT NOT NULL,
        class_subject_id TEXT NOT NULL,
        period_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        max_score INTEGER NOT NULL,
        coefficient INTEGER NOT NULL,
        session_id TEXT,
        due_at TIMESTAMP,
        met_at TIMESTAMP,
        date TIMESTAMP,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS assessment_results (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        assessment_id TEXT NOT NULL,
        score INTEGER,
        status TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS grade_scales (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        name TEXT NOT NULL,
        min_score INTEGER NOT NULL,
        max_score INTEGER NOT NULL,
        ranges JSONB NOT NULL,
        is_default BOOLEAN NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS report_card_definitions (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        grade_level_id TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        is_default BOOLEAN NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS report_card_definition_sections (
        id TEXT PRIMARY KEY,
        definition_id TEXT NOT NULL,
        name TEXT NOT NULL,
        order_val INTEGER NOT NULL,
        weight INTEGER NOT NULL,
        parent_section_id TEXT,
        subject_id TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS report_card_results (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        class_group_id TEXT NOT NULL,
        period_id TEXT NOT NULL,
        report_card_definition_id TEXT NOT NULL,
        section_results JSONB NOT NULL,
        attendance_summary JSONB NOT NULL,
        assessment_result_count INTEGER NOT NULL,
        overall_average INTEGER,
        rank INTEGER,
        class_size INTEGER,
        pass_threshold INTEGER,
        teacher_comment TEXT,
        principal_comment TEXT,
        status TEXT NOT NULL,
        generated_at TIMESTAMP NOT NULL,
        published_at TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        gender TEXT,
        birth_date TIMESTAMP,
        place_of_birth TEXT,
        nationality TEXT,
        matricule TEXT,
        photo_url TEXT,
        subject_id TEXT,
        status TEXT NOT NULL,
        enrollment_date TIMESTAMP,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS student_class_enrollments (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        class_group_id TEXT NOT NULL,
        academic_year_id TEXT NOT NULL,
        enrollment_index INTEGER NOT NULL,
        status TEXT NOT NULL,
        enrolled_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        end_reason TEXT,
        progression_decision TEXT,
        previous_enrollment_id TEXT,
        closed_by TEXT,
        progression_decided_at TIMESTAMP,
        progression_decided_by TEXT,
        progression_notes TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS guardians (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        subject_id TEXT,
        contact_methods JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS guardian_student_links (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        guardian_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        is_primary BOOLEAN NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS student_notes (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        author_staff_id TEXT NOT NULL,
        title TEXT,
        body TEXT NOT NULL,
        visibility TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS student_health_profiles (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        blood_type TEXT,
        allergies JSONB NOT NULL,
        medical_conditions JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS student_disciplinary_actions (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        incident_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        disciplinary_action_id TEXT NOT NULL,
        assigned_by_staff_id TEXT NOT NULL,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS disciplinary_actions (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS student_incident_involvements (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        incident_id TEXT NOT NULL,
        role TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        school_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        kind TEXT NOT NULL,
        reporter_id TEXT NOT NULL,
        class_group_id TEXT,
        session_id TEXT,
        status TEXT NOT NULL,
        resolution_notes TEXT,
        resolved_at TIMESTAMP,
        resolved_by_staff_id TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )`,
    ]

    for (const statement of createTableStatements) {
      await this.db.execute(sql.raw(statement))
    }
  }

  async clearAll(): Promise<void> {
    const tables = [
      'schools',
      'academic_years',
      'academic_periods',
      'period_definitions',
      'grade_levels',
      'staff_members',
      'staff_assignments',
      'attachments',
      'resources',
      'resource_assignments',
      'fees',
      'student_fees',
      'payments',
      'schedules',
      'sessions',
      'calendar_events',
      'attendance_records',
      'announcements',
      'announcement_targets',
      'message_deliveries',
      'subjects',
      'subject_matters',
      'class_groups',
      'class_subjects',
      'class_subject_matters',
      'class_subject_progress',
      'assessments',
      'assessment_results',
      'grade_scales',
      'report_card_definitions',
      'report_card_definition_sections',
      'report_card_results',
      'students',
      'student_class_enrollments',
      'guardians',
      'guardian_student_links',
      'student_notes',
      'student_health_profiles',
      'student_disciplinary_actions',
      'disciplinary_actions',
      'student_incident_involvements',
      'incidents',
    ]

    for (const table of tables) {
      await this.db.execute(sql.raw(`DELETE FROM ${table}`))
    }
  }
}
