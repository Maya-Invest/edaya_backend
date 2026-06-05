import type { AttendanceJustificationStatus, SchoolService, StaffRole, StudentFee } from '@edaya/core'
import {
  AcademicPeriod,
  Announcement,
  AnnouncementTarget,
  Assessment,
  Attachment,
  AuthorizationError,
  AuthorizationErrorCode,
  authorize,
  buildStudentFeeSummary,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectMatterStatus,
  createSystemActorMetadata,
  Fee,
  FeeStatus,
  Guardian,
  GuardianStudentLink,
  Incident,
  IncidentStatus,
  Permission,
  ReportCardDefinition,
  resolveAuditActorId,
  ResourceAssignment,
  Schedule,
  School,
  Session,
  StaffAssignment,
  StaffMember,
  Student,
  StudentHealthProfile,
  StudentNote,
  syncStaffSystemRoleAssignment,
} from '@edaya/core'

type ArgsOf<T extends abstract new (...args: any) => any> = ConstructorParameters<T>[0]

async function ensureActorStaffMember(app: SchoolService): Promise<void> {
  const actor = app.baseService.actor
  if (actor.kind !== 'staff') {
    return
  }
  const existing = await app.baseService.repositories.staffMembers.findById(actor.staffMemberId)
  if (!existing) {
    await app.baseService.repositories.staffMembers.save(new StaffMember({
      id: actor.staffMemberId,
      schoolId: actor.schoolId,
      firstName: 'Fixture',
      lastName: 'Administrator',
    }))
  }
  if (actor.roles) {
    await syncStaffSystemRoleAssignment({
      staffMemberId: actor.staffMemberId,
      schoolId: actor.schoolId,
      repositories: app.baseService.repositories,
      roleKeys: actor.roles,
    })
  }
}

export async function saveSchool(app: SchoolService, input: ArgsOf<typeof School>): Promise<School> {
  await ensureActorStaffMember(app)
  const school = new School(input)
  const registrationActor = createSystemActorMetadata({
    systemId: 'integration-fixture',
    schoolId: school.id,
    requestId: 'integration-school-registration',
    reason: 'Seed school fixture',
  })
  await authorize({
    actor: registrationActor,
    policy: app.baseService.authorizationPolicy,
    repositories: app.baseService.repositories,
    request: {
      actorId: resolveAuditActorId(registrationActor),
      schoolId: school.id,
      permission: Permission.PLATFORM_REGISTER_SCHOOL,
    },
  })
  await app.baseService.schools.save(school, { moduleChecked: true })
  return school
}

export async function updateSchool(app: SchoolService, input: { schoolId: string } & Partial<Omit<ArgsOf<typeof School>, 'id'>>): Promise<School> {
  const existing = await app.baseService.schools.findById(input.schoolId)
  if (!existing) {
    throw new Error(`School ${input.schoolId} not found`)
  }
  const school = new School({
    id: existing.id,
    name: input.name ?? existing.name,
    timeZone: input.timeZone ?? existing.timeZone,
    type: input.type ?? existing.type,
    country: input.country ?? existing.country,
    city: input.city ?? existing.city,
    createdAt: existing.createdAt,
  })
  await app.baseService.schools.save(school)
  return school
}

export async function createAcademicPeriod(app: SchoolService, input: ArgsOf<typeof AcademicPeriod>): Promise<AcademicPeriod> {
  const period = new AcademicPeriod(input)
  await app.baseService.academicPeriods.save(period)
  return period
}

export async function publishAcademicPeriod(app: SchoolService, academicPeriodId: string): Promise<AcademicPeriod> {
  const existing = await app.baseService.academicPeriods.findById(academicPeriodId)
  if (!existing) {
    throw new Error(`Academic period ${academicPeriodId} not found`)
  }
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
  })
  await authorizeCoreServiceHelperPermission(app, Permission.SCHOOL_LIFECYCLE_MANAGE)
  await app.baseService.academicPeriods.save(period, { moduleChecked: true })
  return period
}

async function authorizeCoreServiceHelperPermission(
  app: SchoolService,
  permission: Permission,
): Promise<void> {
  await authorize({
    actor: app.baseService.actor,
    policy: app.baseService.authorizationPolicy,
    repositories: app.baseService.repositories,
    request: {
      actorId: resolveAuditActorId(app.baseService.actor),
      schoolId: app.baseService.actor.schoolId,
      permission,
    },
  })
}

export async function createClassGroup(app: SchoolService, input: ArgsOf<typeof ClassGroup>): Promise<ClassGroup> {
  const classGroup = new ClassGroup(input)
  await app.baseService.classGroups.save(classGroup)
  return classGroup
}

export async function updateClassGroup(app: SchoolService, input: { classGroupId: string } & Partial<Omit<ArgsOf<typeof ClassGroup>, 'id'>>): Promise<ClassGroup> {
  const existing = await app.baseService.classGroups.findById(input.classGroupId)
  if (!existing) {
    throw new Error(`Class group ${input.classGroupId} not found`)
  }
  const classGroup = existing.copyWith({
    schoolId: input.schoolId ?? existing.schoolId,
    academicYearId: input.academicYearId ?? existing.academicYearId,
    gradeLevelId: input.gradeLevelId ?? existing.gradeLevelId,
    name: input.name ?? existing.name,
    capacity: input.capacity !== undefined ? input.capacity : existing.capacity,
    attendanceMode: input.attendanceMode ?? existing.attendanceMode,
    homeroomStaffId: input.homeroomStaffId !== undefined ? input.homeroomStaffId : existing.homeroomStaffId,
  })
  await app.baseService.classGroups.save(classGroup)
  return classGroup
}

export async function saveStaffMember(
  app: SchoolService,
  input: ArgsOf<typeof StaffMember> & { roles?: readonly StaffRole[] },
): Promise<StaffMember> {
  const { roles, ...staffMemberInput } = input
  const staffMember = new StaffMember(staffMemberInput)
  await app.baseService.staffMembers.save(staffMember)
  if (roles) {
    await syncStaffSystemRoleAssignment({
      staffMemberId: staffMember.id,
      schoolId: staffMember.schoolId,
      repositories: app.baseService.repositories,
      roleKeys: roles,
    })
  }
  return staffMember
}

export async function updateStaffStatus(app: SchoolService, staffId: string, isActive: boolean): Promise<StaffMember> {
  const existing = await app.baseService.staffMembers.findById(staffId)
  if (!existing) {
    throw new Error(`Staff member ${staffId} not found`)
  }
  const staffMember = new StaffMember({
    id: existing.id,
    schoolId: existing.schoolId,
    firstName: existing.firstName,
    lastName: existing.lastName,
    email: existing.email,
    subjectId: existing.subjectId,
    isActive,
    createdAt: existing.createdAt,
  })
  await app.baseService.staffMembers.save(staffMember)
  await syncStaffSystemRoleAssignment({
    staffMemberId: staffMember.id,
    schoolId: staffMember.schoolId,
    repositories: app.baseService.repositories,
  })
  return staffMember
}

export async function saveStaffAssignment(app: SchoolService, input: ArgsOf<typeof StaffAssignment>): Promise<StaffAssignment> {
  const assignment = new StaffAssignment(input)
  await app.baseService.staffAssignments.save(assignment)
  const staffMember = await app.baseService.staffMembers.findById(assignment.staffId)
  if (staffMember) {
    await syncStaffSystemRoleAssignment({
      staffMemberId: staffMember.id,
      schoolId: staffMember.schoolId,
      repositories: app.baseService.repositories,
    })
  }
  return assignment
}

export async function saveStudent(app: SchoolService, input: ArgsOf<typeof Student>): Promise<Student> {
  const student = new Student(input)
  await app.baseService.students.save(student)
  return student
}

export async function updateStudent(app: SchoolService, input: { studentId: string } & Partial<Omit<ArgsOf<typeof Student>, 'id'>>): Promise<Student> {
  const existing = await app.baseService.students.findById(input.studentId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const student = existing.copyWith({
    schoolId: input.schoolId ?? existing.schoolId,
    firstName: input.firstName ?? existing.firstName,
    lastName: input.lastName ?? existing.lastName,
    gender: input.gender !== undefined ? input.gender : existing.gender,
    birthDate: input.birthDate ?? existing.birthDate,
    placeOfBirth: input.placeOfBirth !== undefined ? input.placeOfBirth : existing.placeOfBirth,
    nationality: input.nationality !== undefined ? input.nationality : existing.nationality,
    matricule: input.matricule !== undefined ? input.matricule : existing.matricule,
    photoUrl: input.photoUrl !== undefined ? input.photoUrl : existing.photoUrl,
    subjectId: input.subjectId !== undefined ? input.subjectId : existing.subjectId,
    status: input.status ?? existing.status,
    enrollmentDate: input.enrollmentDate !== undefined ? input.enrollmentDate : existing.enrollmentDate,
  })
  await app.baseService.students.save(student)
  return student
}

export async function saveGuardian(app: SchoolService, input: ArgsOf<typeof Guardian>): Promise<Guardian> {
  const guardian = new Guardian(input)
  await app.baseService.guardians.save(guardian)
  return guardian
}

export async function saveStudentNote(
  app: SchoolService,
  input: Omit<ArgsOf<typeof StudentNote>, 'schoolId' | 'authorStaffId'> & Partial<Pick<ArgsOf<typeof StudentNote>, 'schoolId' | 'authorStaffId'>>,
): Promise<StudentNote> {
  const student = await app.baseService.students.findById(input.studentId)
  if (!student) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const note = new StudentNote({
    ...input,
    schoolId: input.schoolId ?? student.schoolId,
    authorStaffId: input.authorStaffId ?? resolveAuditActorId(app.baseService.actor),
  })
  await app.baseService.studentNotes.save(note)
  return note
}

export async function saveStudentHealthProfile(app: SchoolService, input: ArgsOf<typeof StudentHealthProfile>): Promise<StudentHealthProfile> {
  const profile = new StudentHealthProfile(input)
  await app.baseService.studentHealthProfiles.save(profile)
  return profile
}

export async function saveStudentHealthProfileForStudent(
  app: SchoolService,
  input: Omit<ArgsOf<typeof StudentHealthProfile>, 'schoolId'> & Partial<Pick<ArgsOf<typeof StudentHealthProfile>, 'schoolId'>>,
): Promise<StudentHealthProfile> {
  const student = await app.baseService.students.findById(input.studentId)
  if (!student) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  return saveStudentHealthProfile(app, {
    ...input,
    schoolId: input.schoolId ?? student.schoolId,
  })
}

export async function updateStudentNote(app: SchoolService, input: {
  noteId: string
  body: string
}): Promise<StudentNote> {
  const existing = await app.baseService.studentNotes.findById(input.noteId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const note = new StudentNote({
    id: existing.id,
    schoolId: existing.schoolId,
    studentId: existing.studentId,
    authorStaffId: existing.authorStaffId,
    title: existing.title,
    body: input.body,
    visibility: existing.visibility,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  })
  await app.baseService.studentNotes.save(note)
  return note
}

export async function updateGuardian(app: SchoolService, input: {
  guardianId: string
  firstName?: string
}): Promise<Guardian> {
  const existing = await app.baseService.guardians.findById(input.guardianId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const guardian = new Guardian({
    id: existing.id,
    schoolId: existing.schoolId,
    firstName: input.firstName ?? existing.firstName,
    lastName: existing.lastName,
    contactMethods: existing.contactMethods,
    subjectId: existing.subjectId,
    hasAccess: existing.hasAccess,
    premiumNotificationsEnabled: existing.premiumNotificationsEnabled,
    createdAt: existing.createdAt,
  })
  await app.baseService.guardians.save(guardian)
  return guardian
}

export async function updateGuardianStudentLink(app: SchoolService, input: {
  guardianId: string
  studentId: string
  isBillingContact?: boolean
}): Promise<GuardianStudentLink> {
  const existing = await app.baseService.guardianLinks.findOne({
    guardianId: input.guardianId,
    studentId: input.studentId,
  })
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const link = new GuardianStudentLink({
    id: existing.id,
    schoolId: existing.schoolId,
    guardianId: existing.guardianId,
    studentId: existing.studentId,
    relationship: existing.relationship,
    isPrimary: existing.isPrimary,
    isBillingContact: input.isBillingContact ?? existing.isBillingContact,
    legalGuardian: existing.legalGuardian,
    canPickup: existing.canPickup,
    emergencyContactPriority: existing.emergencyContactPriority,
    receivesAcademicReports: existing.receivesAcademicReports,
    receivesAttendanceAlerts: existing.receivesAttendanceAlerts,
    contactRestrictions: existing.contactRestrictions,
    notes: existing.notes,
    createdAt: existing.createdAt,
  })
  await app.baseService.guardianLinks.save(link)
  return link
}

export async function saveClassSubject(app: SchoolService, input: ArgsOf<typeof ClassSubject>): Promise<ClassSubject> {
  const classSubject = new ClassSubject(input)
  await app.baseService.classSubjects.save(classSubject)
  return classSubject
}

export async function saveClassSubjectMatter(
  app: SchoolService,
  input: Omit<ArgsOf<typeof ClassSubjectMatter>, 'status' | 'completedPercentage'> & Partial<Pick<ArgsOf<typeof ClassSubjectMatter>, 'status' | 'completedPercentage'>>,
): Promise<ClassSubjectMatter> {
  const matter = new ClassSubjectMatter({
    ...input,
    status: input.status ?? ClassSubjectMatterStatus.NotStarted,
    completedPercentage: input.completedPercentage ?? 0,
  })
  await app.baseService.classSubjectMatters.save(matter)
  return matter
}

export async function listMatterProgress(app: SchoolService, classSubjectMatterId: string) {
  return app.baseService.classSubjectProgress.list({ classSubjectMatterId })
}

export async function saveSession(app: SchoolService, input: ArgsOf<typeof Session> & { schoolId?: string }): Promise<Session> {
  const { schoolId: _schoolId, ...sessionInput } = input
  const session = new Session(sessionInput)
  await app.baseService.sessions.save(session)
  return session
}

export async function saveSchedule(app: SchoolService, input: ArgsOf<typeof Schedule>): Promise<Schedule> {
  const schedule = new Schedule(input)
  await app.baseService.schedules.save(schedule)
  return schedule
}

export async function saveCalendarEvent(app: SchoolService, input: ArgsOf<typeof CalendarEvent>): Promise<CalendarEvent> {
  const event = new CalendarEvent(input)
  await app.baseService.calendarEvents.save(event)
  return event
}

export async function saveFee(app: SchoolService, input: ArgsOf<typeof Fee>): Promise<Fee> {
  const fee = new Fee(input)
  await app.baseService.fees.save(fee)
  return fee
}

export async function adjustStudentFee(app: SchoolService, input: {
  studentFeeId: string
  adjustmentAmount: number
  reason: string
}): Promise<StudentFee> {
  const existing = await app.baseService.studentFees.findById(input.studentFeeId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const studentFee = existing.copyWith({
    adjustmentAmount: input.adjustmentAmount,
    adjustmentReason: input.reason,
    adjustedById: resolveAuditActorId(app.baseService.actor),
    adjustedAt: new Date(),
    updatedAt: new Date(),
  })
  await app.baseService.studentFees.save(studentFee)
  return studentFee
}

export async function cancelStudentFee(app: SchoolService, input: {
  studentFeeId: string
  reason: string
}): Promise<StudentFee> {
  const existing = await app.baseService.studentFees.findById(input.studentFeeId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const studentFee = existing.copyWith({
    status: FeeStatus.Cancelled,
    cancellationReason: input.reason,
    cancelledById: resolveAuditActorId(app.baseService.actor),
    cancelledAt: new Date(),
    updatedAt: new Date(),
  })
  await app.baseService.studentFees.save(studentFee)
  return studentFee
}

export async function buildFeeSummary(app: SchoolService, studentId: string) {
  return buildStudentFeeSummary(await app.baseService.studentFees.list({ studentId }))
}

export async function saveResourceAssignment(app: SchoolService, input: ArgsOf<typeof ResourceAssignment>): Promise<ResourceAssignment> {
  const assignment = new ResourceAssignment(input)
  await app.baseService.resourceAssignments.save(assignment)
  return assignment
}

export async function saveAttachment(app: SchoolService, input: ArgsOf<typeof Attachment>): Promise<Attachment> {
  const attachment = new Attachment(input)
  await app.baseService.attachments.save(attachment)
  return attachment
}

export async function saveReportCardDefinition(app: SchoolService, input: ArgsOf<typeof ReportCardDefinition>): Promise<ReportCardDefinition> {
  const definition = new ReportCardDefinition(input)
  await app.baseService.definitions.save(definition)
  return definition
}

export async function saveAssessment(app: SchoolService, input: ArgsOf<typeof Assessment>): Promise<Assessment> {
  const assessment = new Assessment(input)
  await app.baseService.assessments.save(assessment)
  return assessment
}

export async function saveIncident(
  app: SchoolService,
  input: Omit<ArgsOf<typeof Incident>, 'reporterId'> & Partial<Pick<ArgsOf<typeof Incident>, 'reporterId'>>,
): Promise<Incident> {
  const incident = new Incident({
    ...input,
    reporterId: input.reporterId ?? resolveAuditActorId(app.baseService.actor),
  })
  await app.baseService.incidents.save(incident)
  return incident
}

export async function resolveIncident(app: SchoolService, incidentId: string): Promise<Incident> {
  const existing = await app.baseService.incidents.findById(incidentId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const incident = new Incident({
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
    resolutionNotes: 'Resolved',
    resolvedAt: new Date(),
    resolvedByStaffId: resolveAuditActorId(app.baseService.actor),
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  })
  await app.baseService.incidents.save(incident)
  return incident
}

export async function reviewAttendanceJustification(app: SchoolService, input: {
  studentId: string
  sessionId: string
  decision: AttendanceJustificationStatus
  reason?: string
}) {
  const existing = await app.baseService.attendance.findOne({
    studentId: input.studentId,
    sessionId: input.sessionId,
  })
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const record = existing.copyWith({
    justificationStatus: input.decision,
    reason: input.reason,
    justifiedAt: new Date(),
    justifiedByStaffId: resolveAuditActorId(app.baseService.actor),
  })
  await app.baseService.attendance.save(record)
  return record
}

export async function saveAnnouncement(app: SchoolService, input: ArgsOf<typeof Announcement>): Promise<Announcement> {
  const announcement = new Announcement(input)
  await app.baseService.announcements.save(announcement)
  return announcement
}

export async function saveAnnouncementTarget(app: SchoolService, input: ArgsOf<typeof AnnouncementTarget>): Promise<AnnouncementTarget> {
  const target = new AnnouncementTarget(input)
  await app.baseService.announcementTargets.save(target)
  return target
}

export async function listClassSubjectAssessmentResultsForPeriod(app: SchoolService, input: {
  classSubjectId: string
  periodId: string
}) {
  const classSubject = await app.baseService.classSubjects.findById(input.classSubjectId)
  const period = await app.baseService.academicPeriods.findById(input.periodId)
  if (!classSubject || !period) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const assessments = await app.baseService.assessments.list({
    classSubjectId: input.classSubjectId,
    periodId: input.periodId,
  })
  const results = []
  for (const assessment of assessments) {
    results.push(...await app.baseService.assessmentResults.list({ assessmentId: assessment.id }))
  }
  return results
}
