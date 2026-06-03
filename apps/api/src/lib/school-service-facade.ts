import type { ActorMetadata, SchoolRepositories, SchoolService } from "@edaya/core";
import {
  AcademicPeriod,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  AttendanceJustificationStatus,
  buildSessionAttendanceSummary,
  buildStudentFeeSummary,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectMatterStatus,
  SchoolApplication as CoreSchoolApplication,
  Fee,
  FeeStatus,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  Incident,
  IncidentStatus,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  resolveAuditActorId,
  ResourceAssignment,
  Schedule,
  School,
  Session,
  StaffAssignment,
  StaffMember,
  Student,
  StudentDisciplinaryAction,
  StudentHealthProfile,
  StudentNote,
} from "@edaya/core";

type CoreSchoolApplicationArgs = ConstructorParameters<typeof CoreSchoolApplication>[0];

export class ApiSchoolApplication {
  private readonly application: CoreSchoolApplication;

  constructor(args: CoreSchoolApplicationArgs) {
    this.application = new CoreSchoolApplication(args);
  }

  get repositories(): SchoolRepositories {
    return this.application.repositories;
  }

  forActor(actor: ActorMetadata): ApiSchoolServiceFacade {
    return new ApiSchoolServiceFacade(this.application.forActor(actor));
  }
}

export class ApiSchoolServiceFacade {
  readonly service: SchoolService;
  readonly baseService: SchoolService["baseService"];
  readonly queries: any;
  readonly config: any;
  readonly setup: any;
  readonly students: any;
  readonly academics: any;
  readonly assessments: any;
  readonly behavior: any;
  readonly finance: any;
  readonly scheduling: any;
  readonly communications: any;

  constructor(service: SchoolService) {
    this.service = service;
    this.baseService = service.baseService;
    this.queries = createQueryFacade(service);
    this.config = service.baseService;
    this.setup = createSetupFacade(service);
    this.students = createStudentsFacade(service);
    this.academics = createAcademicsFacade(service);
    this.assessments = createAssessmentsFacade(service);
    this.behavior = createBehaviorFacade(service);
    this.finance = createFinanceFacade(service);
    this.scheduling = createSchedulingFacade(service);
    this.communications = createCommunicationsFacade(service);
  }
}

function createQueryFacade(service: SchoolService): any {
  return new Proxy({}, {
    get(_target, property) {
      if (property === "getOverdueFeeCount") {
        return (schoolId: string) => service.getOverdueFeeCount(schoolId);
      }
      if (property === "getPublishedReportCardCount") {
        return (schoolId: string) => service.getPublishedReportCardCount(schoolId);
      }
      return (service.baseService as any)[property as string];
    },
  });
}

function createSetupFacade(service: SchoolService): any {
  return {
    registerSchool: async (input: any) => {
      await service.baseService.authorizationPolicy.checkGlobalAction(service.baseService.actor, "setup.register_school");
      const school = new School(input);
      await service.baseService.schools.save(school, { moduleChecked: true });
      return school;
    },
    updateSchoolConfiguration: async ({ schoolId, ...changes }: any) => {
      const existing = await requireEntity(service.baseService.schools, schoolId);
      await service.baseService.authorizationPolicy.checkGlobalAction(service.baseService.actor, "setup.manage_lifecycle");
      const school = new School({
        id: existing.id,
        name: changes.name ?? existing.name,
        timeZone: changes.timeZone ?? existing.timeZone,
        type: changes.type === undefined ? existing.type : changes.type,
        country: changes.country === undefined ? existing.country : changes.country,
        city: changes.city === undefined ? existing.city : changes.city,
        createdAt: existing.createdAt,
      });
      await service.baseService.schools.save(school, { moduleChecked: true });
      return school;
    },
    createAcademicYear: (input: any) => service.createAcademicYear(input),
    activateAcademicYear: (input: any) => service.activateAcademicYear(input),
    createAcademicPeriod: async (input: any) => {
      const period = new AcademicPeriod(input);
      await service.baseService.academicPeriods.save(period);
      return period;
    },
    publishAcademicPeriod: async ({ academicPeriodId }: any) => {
      const existing = await requireEntity(service.baseService.academicPeriods, academicPeriodId);
      await service.baseService.authorizationPolicy.checkGlobalAction(service.baseService.actor, "setup.manage_lifecycle");
      const period = new AcademicPeriod({
        id: existing.id,
        schoolId: existing.schoolId,
        academicYearId: existing.academicYearId,
        name: existing.name,
        type: existing.type,
        startDate: existing.startDate,
        endDate: existing.endDate,
        isPublished: true,
        createdAt: existing.createdAt,
      });
      await service.baseService.academicPeriods.save(period, { moduleChecked: true });
      return period;
    },
    createClassGroup: async (input: any) => saveConstructed(service.baseService.classGroups, new ClassGroup(input)),
    updateClassGroupConfiguration: async ({ classGroupId, ...changes }: any) => {
      const existing = await requireEntity(service.baseService.classGroups, classGroupId);
      const classGroup = existing.copyWith(changes);
      await service.baseService.classGroups.save(classGroup);
      return classGroup;
    },
    registerStaffMember: async (input: any) => saveConstructed(service.baseService.staffMembers, new StaffMember(input)),
    updateStaffMemberStatus: async ({ staffId, isActive }: any) => {
      const existing = await requireEntity(service.baseService.staffMembers, staffId);
      return saveConstructed(service.baseService.staffMembers, new StaffMember({
        id: existing.id,
        schoolId: existing.schoolId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        roles: existing.roles,
        email: existing.email,
        subjectId: existing.subjectId,
        isActive,
        createdAt: existing.createdAt,
      }));
    },
    assignStaffToClass: (input: any) => saveConstructed(service.baseService.staffAssignments, new StaffAssignment(input)),
    assignStaffToClassSubject: (input: any) => saveConstructed(service.baseService.staffAssignments, new StaffAssignment(input)),
    assignStaffToSession: (input: any) => saveConstructed(service.baseService.staffAssignments, new StaffAssignment(input)),
    assignResourceToClass: (input: any) => saveConstructed(service.baseService.resourceAssignments, new ResourceAssignment(input)),
    assignResourceToSession: (input: any) => saveConstructed(service.baseService.resourceAssignments, new ResourceAssignment(input)),
    removeResourceAssignment: ({ resourceAssignmentId, id }: any) => service.baseService.resourceAssignments.delete(resourceAssignmentId ?? id),
    registerAttachment: (input: any) => saveConstructed(service.baseService.attachments, new Attachment(input)),
    removeAttachment: ({ attachmentId, id }: any) => service.baseService.attachments.delete(attachmentId ?? id),
  };
}

function createStudentsFacade(service: SchoolService): any {
  return {
    registerStudent: (input: any) => saveConstructed(service.baseService.students, new Student(input)),
    enrollStudent: (input: any) => service.enrollStudent(input),
    linkGuardianToStudent: (input: any) => service.linkGuardianToStudent(input),
    registerGuardian: (input: any) => saveConstructed(service.baseService.guardians, new Guardian(input)),
    promoteStudent: (input: any) => service.promoteStudent(input),
    transferStudent: (input: any) => service.transferStudent(input),
    graduateStudent: (input: any) => service.graduateStudent(input),
    closeEnrollment: async ({ enrollmentId, endReason, endedAt }: any) => {
      const existing = await requireEntity(service.baseService.enrollments, enrollmentId);
      const closed = existing.close({ endedAt: endedAt ?? new Date(), endReason, closedBy: resolveAuditActorId(service.baseService.actor) });
      await service.baseService.enrollments.save(closed);
      return closed;
    },
    recordProgressionDecision: async ({ enrollmentId, decision, decidedAt, notes }: any) => {
      const existing = await requireEntity(service.baseService.enrollments, enrollmentId);
      const decided = existing.recordProgressionDecision({
        decision,
        decidedAt: decidedAt ?? new Date(),
        decidedBy: resolveAuditActorId(service.baseService.actor),
        notes,
      });
      await service.baseService.enrollments.save(decided);
      return decided;
    },
    updateStudentProfile: async ({ studentId, ...changes }: any) => {
      const existing = await requireEntity(service.baseService.students, studentId);
      const student = existing.copyWith(changes);
      await service.baseService.students.save(student);
      return student;
    },
    updateStudentStatus: async ({ studentId, status }: any) => {
      const existing = await requireEntity(service.baseService.students, studentId);
      const student = existing.copyWith({ status });
      await service.baseService.students.save(student);
      return student;
    },
    upsertStudentHealthProfile: async (input: any) => {
      const student = await requireEntity(service.baseService.students, input.studentId);
      return saveConstructed(service.baseService.studentHealthProfiles, new StudentHealthProfile({
        ...input,
        schoolId: input.schoolId ?? student.schoolId,
      }));
    },
    createStudentNote: async (input: any) => {
      const student = await requireEntity(service.baseService.students, input.studentId);
      return saveConstructed(service.baseService.studentNotes, new StudentNote({
        ...input,
        schoolId: input.schoolId ?? student.schoolId,
        authorStaffId: input.authorStaffId ?? resolveAuditActorId(service.baseService.actor),
      }));
    },
    updateStudentNote: async ({ noteId, ...changes }: any) => {
      const existing = await requireEntity(service.baseService.studentNotes, noteId);
      return saveConstructed(service.baseService.studentNotes, new StudentNote({
        id: existing.id,
        schoolId: existing.schoolId,
        studentId: existing.studentId,
        authorStaffId: existing.authorStaffId,
        title: changes.title === undefined ? existing.title : changes.title,
        body: changes.body ?? existing.body,
        visibility: changes.visibility ?? existing.visibility,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      }));
    },
    updateGuardianContactMethods: async ({ guardianId, ...changes }: any) => {
      const existing = await requireEntity(service.baseService.guardians, guardianId);
      return saveConstructed(service.baseService.guardians, new Guardian({
        id: existing.id,
        schoolId: existing.schoolId,
        firstName: changes.firstName ?? existing.firstName,
        lastName: changes.lastName ?? existing.lastName,
        contactMethods: changes.contactMethods ?? existing.contactMethods,
        subjectId: existing.subjectId,
        hasAccess: changes.hasAccess ?? existing.hasAccess,
        premiumNotificationsEnabled: changes.premiumNotificationsEnabled ?? existing.premiumNotificationsEnabled,
        createdAt: existing.createdAt,
      }));
    },
    updateGuardianStudentLink: async ({ guardianId, studentId, ...changes }: any) => {
      const existing = await requireOne(service.baseService.guardianLinks, { guardianId, studentId });
      return saveConstructed(service.baseService.guardianLinks, new GuardianStudentLink({
        id: existing.id,
        schoolId: existing.schoolId,
        guardianId: existing.guardianId,
        studentId: existing.studentId,
        relationship: changes.relationship ?? existing.relationship,
        isPrimary: changes.isPrimary ?? existing.isPrimary,
        isBillingContact: changes.isBillingContact ?? existing.isBillingContact,
        legalGuardian: changes.legalGuardian ?? existing.legalGuardian,
        canPickup: changes.canPickup ?? existing.canPickup,
        emergencyContactPriority: changes.emergencyContactPriority ?? existing.emergencyContactPriority,
        receivesAcademicReports: changes.receivesAcademicReports ?? existing.receivesAcademicReports,
        receivesAttendanceAlerts: changes.receivesAttendanceAlerts ?? existing.receivesAttendanceAlerts,
        contactRestrictions: changes.contactRestrictions ?? existing.contactRestrictions,
        notes: changes.notes ?? existing.notes,
        createdAt: existing.createdAt,
      }));
    },
  };
}

function createAcademicsFacade(service: SchoolService): any {
  return {
    offerSubjectToClass: (input: any) => saveConstructed(service.baseService.classSubjects, new ClassSubject(input)),
    assignMatterToClassSubject: (input: any) => saveConstructed(service.baseService.classSubjectMatters, new ClassSubjectMatter({
      ...input,
      status: input.status ?? ClassSubjectMatterStatus.NotStarted,
      completedPercentage: input.completedPercentage ?? 0,
    })),
    listMatterProgress: (classSubjectMatterId: string) => service.baseService.classSubjectProgress.list({ classSubjectMatterId }),
    recordSessionProgress: (input: any) => service.recordSessionProgress(input),
  };
}

function createAssessmentsFacade(service: SchoolService): any {
  return {
    createGradeScale: (input: any) => saveConstructed(service.baseService.gradeScales, new GradeScale(input)),
    createReportCardDefinition: (input: any) => saveConstructed(service.baseService.definitions, new ReportCardDefinition(input)),
    createReportCardDefinitionSection: (input: any) => saveConstructed(service.baseService.sections, new ReportCardDefinitionSection(input)),
    createAssessment: (input: any) => saveConstructed(service.baseService.assessments, new Assessment(input)),
    completeAssessment: async ({ assessmentId, metAt }: any) => {
      const existing = await requireEntity(service.baseService.assessments, assessmentId);
      return saveConstructed(service.baseService.assessments, new Assessment({ ...existing, metAt: metAt ?? new Date() }));
    },
    recordAssessmentResult: (input: any) => saveConstructed(service.baseService.assessmentResults, new AssessmentResult(input)),
    recordAssessmentResultCompliance: (input: any) => saveConstructed(service.baseService.assessmentResults, new AssessmentResult(input)),
    listClassSubjectAssessmentResultsForPeriod: async ({ classSubjectId, periodId }: any) => {
      await requireEntity(service.baseService.classSubjects, classSubjectId);
      await requireEntity(service.baseService.academicPeriods, periodId);
      const assessments = await service.baseService.assessments.list({ classSubjectId, periodId });
      const results = [];
      for (const assessment of assessments) {
        results.push(...await service.baseService.assessmentResults.list({ assessmentId: assessment.id }));
      }
      return results;
    },
    generateReportCardResult: (input: any) => service.generateReportCardResult(input),
    publishReportCardResult: (input: any) => service.publishReportCardResult(input),
  };
}

function createBehaviorFacade(service: SchoolService): any {
  return {
    recordIncident: (input: any) => saveConstructed(service.baseService.incidents, new Incident({
      ...input,
      reporterId: input.reporterId ?? resolveAuditActorId(service.baseService.actor),
    })),
    addStudentInvolvement: (input: any) => service.addStudentInvolvement(input),
    applyDisciplinaryAction: (input: any) => service.applyDisciplinaryAction(input),
    updateStudentDisciplinaryActionStatus: async ({ studentDisciplinaryActionId, actionId, status }: any) => {
      const existing = await requireEntity(service.baseService.studentDisciplinaryActions, studentDisciplinaryActionId ?? actionId);
      return saveConstructed(service.baseService.studentDisciplinaryActions, new StudentDisciplinaryAction({
        id: existing.id,
        schoolId: existing.schoolId,
        incidentId: existing.incidentId,
        studentId: existing.studentId,
        disciplinaryActionId: existing.disciplinaryActionId,
        assignedByStaffId: existing.assignedByStaffId,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
        status: status ?? existing.status,
        notes: existing.notes,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      }));
    },
    resolveIncident: async ({ incidentId, resolutionNotes }: any) => {
      const existing = await requireEntity(service.baseService.incidents, incidentId);
      return saveConstructed(service.baseService.incidents, new Incident({
        id: existing.id,
        schoolId: existing.schoolId,
        title: existing.title,
        description: existing.description,
        date: existing.date,
        kind: existing.kind,
        reporterId: existing.reporterId,
        classGroupId: existing.classGroupId,
        sessionId: existing.sessionId,
        status: IncidentStatus.Resolved,
        resolutionNotes: resolutionNotes ?? "Resolved",
        resolvedAt: new Date(),
        resolvedByStaffId: resolveAuditActorId(service.baseService.actor),
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      }));
    },
  };
}

function createFinanceFacade(service: SchoolService): any {
  return {
    createFee: (input: any) => saveConstructed(service.baseService.fees, new Fee(input)),
    assignFeeToStudent: (input: any) => service.assignFeeToStudent(input),
    recordPayment: (input: any) => service.recordPayment(input),
    reversePayment: (input: any) => service.reversePayment(input),
    cancelPayment: (input: any) => service.cancelPayment(input),
    adjustStudentFee: async ({ studentFeeId, adjustmentAmount, reason }: any) => {
      const existing = await requireEntity(service.baseService.studentFees, studentFeeId);
      return saveConstructed(service.baseService.studentFees, existing.copyWith({
        adjustmentAmount,
        adjustmentReason: reason,
        adjustedById: resolveAuditActorId(service.baseService.actor),
        adjustedAt: new Date(),
        updatedAt: new Date(),
      }));
    },
    cancelStudentFee: async ({ studentFeeId, reason }: any) => {
      const existing = await requireEntity(service.baseService.studentFees, studentFeeId);
      return saveConstructed(service.baseService.studentFees, existing.copyWith({
        status: FeeStatus.Cancelled,
        cancellationReason: reason,
        cancelledById: resolveAuditActorId(service.baseService.actor),
        cancelledAt: new Date(),
        updatedAt: new Date(),
      }));
    },
    buildFeeSummary: async (studentId: string) => buildStudentFeeSummary(await service.baseService.studentFees.list({ studentId })),
  };
}

function createSchedulingFacade(service: SchoolService): any {
  return {
    createSchedule: (input: any) => saveConstructed(service.baseService.schedules, new Schedule(input)),
    createCalendarEvent: (input: any) => saveConstructed(service.baseService.calendarEvents, new CalendarEvent(input)),
    createSession: (input: any) => saveConstructed(service.baseService.sessions, new Session(input)),
    generateSessions: (input: any) => service.generateSessions(input),
    recordAttendance: (input: any) => service.recordAttendance(input),
    recordDailyAttendance: (input: any) => service.recordDailyAttendance(input),
    recordSessionAttendance: (input: any) => service.recordSessionAttendance(input),
    recordClassDailyAttendance: (input: any) => service.recordClassDailyAttendance(input),
    reviewAttendanceJustification: async ({ studentId, sessionId, decision, reason }: any) => {
      const existing = await requireOne(service.baseService.attendance, { studentId, sessionId });
      return saveConstructed(service.baseService.attendance, existing.copyWith({
        justificationStatus: decision ?? AttendanceJustificationStatus.Excused,
        reason,
        justifiedAt: new Date(),
        justifiedByStaffId: resolveAuditActorId(service.baseService.actor),
      }));
    },
    buildAttendanceSummary: async ({ sessionId, expectedTotal }: any) => {
      const records = await service.baseService.attendance.list({ sessionId });
      return buildSessionAttendanceSummary(records, expectedTotal ?? records.length);
    },
    listSessionAttendance: (sessionId: string) => service.baseService.attendance.list({ sessionId }),
  };
}

function createCommunicationsFacade(service: SchoolService): any {
  return {
    createAnnouncement: (input: any) => saveConstructed(service.baseService.announcements, new Announcement(input)),
    addTarget: (input: any) => saveConstructed(service.baseService.announcementTargets, new AnnouncementTarget(input)),
    publishAnnouncement: (input: any) => service.publishAnnouncement(input),
    recordDelivery: (input: any) => service.recordDelivery(input),
    materializeDeliveries: (input: any) => service.materializeDeliveries(input),
  };
}

async function saveConstructed<T extends { id: string }>(managedService: { save: (entity: T, options?: any) => Promise<void> }, entity: T): Promise<T> {
  await managedService.save(entity);
  return entity;
}

async function requireEntity<T>(managedService: { findById: (id: string) => Promise<T | undefined> }, id: string): Promise<T> {
  const entity = await managedService.findById(id);
  if (!entity) {
    throw new Error(`Entity ${id} not found`);
  }
  return entity;
}

async function requireOne<T>(managedService: { findOne: (filter: Record<string, unknown>) => Promise<T | undefined> }, filter: Record<string, unknown>): Promise<T> {
  const entity = await managedService.findOne(filter);
  if (!entity) {
    throw new Error("Entity not found");
  }
  return entity;
}
