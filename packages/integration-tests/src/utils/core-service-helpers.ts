import type { AttendanceJustificationStatus, SchoolService, StudentFee } from '@edaya/core'
import {
  AcademicPeriod,
  Announcement,
  AnnouncementTarget,
  Assessment,
  Attachment,
  AuthorizationError,
  AuthorizationErrorCode,
  buildStudentFeeSummary,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectMatterStatus,
  Fee,
  FeeStatus,
  Guardian,
  GuardianStudentLink,
  Incident,
  IncidentStatus,
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
} from '@edaya/core'

type ArgsOf<T extends abstract new (...args: any) => any> = ConstructorParameters<T>[0]

async function ensureActorStaffMember(app: SchoolService): Promise<void> {
  const actor = app.base.actor
  if (actor.kind !== 'staff') {
    return
  }
  const existing = await app.base.repositories.staffMembers.findById(actor.staffMemberId)
  if (existing) {
    return
  }
  await app.base.repositories.staffMembers.save(new StaffMember({
    id: actor.staffMemberId,
    schoolId: actor.schoolId,
    firstName: 'Fixture',
    lastName: 'Administrator',
    roles: actor.roles,
  }))
}

export async function saveSchool(app: SchoolService, input: ArgsOf<typeof School>): Promise<School> {
  await ensureActorStaffMember(app)
  const school = new School(input)
  await app.base.authorizationPolicy.checkGlobalAction(app.base.actor, 'setup.register_school')
  await app.base.schools.save(school, { moduleChecked: true })
  return school
}

export async function updateSchool(app: SchoolService, input: { schoolId: string } & Partial<Omit<ArgsOf<typeof School>, 'id'>>): Promise<School> {
  const existing = await app.base.schools.findById(input.schoolId)
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
  await app.base.schools.save(school)
  return school
}

export async function createAcademicPeriod(app: SchoolService, input: ArgsOf<typeof AcademicPeriod>): Promise<AcademicPeriod> {
  const period = new AcademicPeriod(input)
  await app.base.academicPeriods.save(period)
  return period
}

export async function publishAcademicPeriod(app: SchoolService, academicPeriodId: string): Promise<AcademicPeriod> {
  const existing = await app.base.academicPeriods.findById(academicPeriodId)
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
  await app.base.authorizationPolicy.checkGlobalAction(app.base.actor, 'setup.manage_lifecycle')
  await app.base.academicPeriods.save(period, { moduleChecked: true })
  return period
}

export async function createClassGroup(app: SchoolService, input: ArgsOf<typeof ClassGroup>): Promise<ClassGroup> {
  const classGroup = new ClassGroup(input)
  await app.base.classGroups.save(classGroup)
  return classGroup
}

export async function updateClassGroup(app: SchoolService, input: { classGroupId: string } & Partial<Omit<ArgsOf<typeof ClassGroup>, 'id'>>): Promise<ClassGroup> {
  const existing = await app.base.classGroups.findById(input.classGroupId)
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
  await app.base.classGroups.save(classGroup)
  return classGroup
}

export async function saveStaffMember(app: SchoolService, input: ArgsOf<typeof StaffMember>): Promise<StaffMember> {
  const staffMember = new StaffMember(input)
  await app.base.staffMembers.save(staffMember)
  return staffMember
}

export async function updateStaffStatus(app: SchoolService, staffId: string, isActive: boolean): Promise<StaffMember> {
  const existing = await app.base.staffMembers.findById(staffId)
  if (!existing) {
    throw new Error(`Staff member ${staffId} not found`)
  }
  const staffMember = new StaffMember({
    id: existing.id,
    schoolId: existing.schoolId,
    firstName: existing.firstName,
    lastName: existing.lastName,
    roles: existing.roles,
    email: existing.email,
    subjectId: existing.subjectId,
    isActive,
    createdAt: existing.createdAt,
  })
  await app.base.staffMembers.save(staffMember)
  return staffMember
}

export async function saveStaffAssignment(app: SchoolService, input: ArgsOf<typeof StaffAssignment>): Promise<StaffAssignment> {
  const assignment = new StaffAssignment(input)
  await app.base.staffAssignments.save(assignment)
  return assignment
}

export async function saveStudent(app: SchoolService, input: ArgsOf<typeof Student>): Promise<Student> {
  const student = new Student(input)
  await app.base.students.save(student)
  return student
}

export async function updateStudent(app: SchoolService, input: { studentId: string } & Partial<Omit<ArgsOf<typeof Student>, 'id'>>): Promise<Student> {
  const existing = await app.base.students.findById(input.studentId)
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
  await app.base.students.save(student)
  return student
}

export async function saveGuardian(app: SchoolService, input: ArgsOf<typeof Guardian>): Promise<Guardian> {
  const guardian = new Guardian(input)
  await app.base.guardians.save(guardian)
  return guardian
}

export async function saveStudentNote(
  app: SchoolService,
  input: Omit<ArgsOf<typeof StudentNote>, 'schoolId' | 'authorStaffId'> & Partial<Pick<ArgsOf<typeof StudentNote>, 'schoolId' | 'authorStaffId'>>,
): Promise<StudentNote> {
  const student = await app.base.students.findById(input.studentId)
  if (!student) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const note = new StudentNote({
    ...input,
    schoolId: input.schoolId ?? student.schoolId,
    authorStaffId: input.authorStaffId ?? resolveAuditActorId(app.base.actor),
  })
  await app.base.studentNotes.save(note)
  return note
}

export async function saveStudentHealthProfile(app: SchoolService, input: ArgsOf<typeof StudentHealthProfile>): Promise<StudentHealthProfile> {
  const profile = new StudentHealthProfile(input)
  await app.base.studentHealthProfiles.save(profile)
  return profile
}

export async function saveStudentHealthProfileForStudent(
  app: SchoolService,
  input: Omit<ArgsOf<typeof StudentHealthProfile>, 'schoolId'> & Partial<Pick<ArgsOf<typeof StudentHealthProfile>, 'schoolId'>>,
): Promise<StudentHealthProfile> {
  const student = await app.base.students.findById(input.studentId)
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
  const existing = await app.base.studentNotes.findById(input.noteId)
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
  await app.base.studentNotes.save(note)
  return note
}

export async function updateGuardian(app: SchoolService, input: {
  guardianId: string
  firstName?: string
}): Promise<Guardian> {
  const existing = await app.base.guardians.findById(input.guardianId)
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
  await app.base.guardians.save(guardian)
  return guardian
}

export async function updateGuardianStudentLink(app: SchoolService, input: {
  guardianId: string
  studentId: string
  isBillingContact?: boolean
}): Promise<GuardianStudentLink> {
  const existing = await app.base.guardianLinks.findOne({
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
  await app.base.guardianLinks.save(link)
  return link
}

export async function saveClassSubject(app: SchoolService, input: ArgsOf<typeof ClassSubject>): Promise<ClassSubject> {
  const classSubject = new ClassSubject(input)
  await app.base.classSubjects.save(classSubject)
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
  await app.base.classSubjectMatters.save(matter)
  return matter
}

export async function listMatterProgress(app: SchoolService, classSubjectMatterId: string) {
  return app.base.classSubjectProgress.list({ classSubjectMatterId })
}

export async function saveSession(app: SchoolService, input: ArgsOf<typeof Session> & { schoolId?: string }): Promise<Session> {
  const { schoolId: _schoolId, ...sessionInput } = input
  const session = new Session(sessionInput)
  await app.base.sessions.save(session)
  return session
}

export async function saveSchedule(app: SchoolService, input: ArgsOf<typeof Schedule>): Promise<Schedule> {
  const schedule = new Schedule(input)
  await app.base.schedules.save(schedule)
  return schedule
}

export async function saveCalendarEvent(app: SchoolService, input: ArgsOf<typeof CalendarEvent>): Promise<CalendarEvent> {
  const event = new CalendarEvent(input)
  await app.base.calendarEvents.save(event)
  return event
}

export async function saveFee(app: SchoolService, input: ArgsOf<typeof Fee>): Promise<Fee> {
  const fee = new Fee(input)
  await app.base.fees.save(fee)
  return fee
}

export async function adjustStudentFee(app: SchoolService, input: {
  studentFeeId: string
  adjustmentAmount: number
  reason: string
}): Promise<StudentFee> {
  const existing = await app.base.studentFees.findById(input.studentFeeId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const studentFee = existing.copyWith({
    adjustmentAmount: input.adjustmentAmount,
    adjustmentReason: input.reason,
    adjustedById: resolveAuditActorId(app.base.actor),
    adjustedAt: new Date(),
    updatedAt: new Date(),
  })
  await app.base.studentFees.save(studentFee)
  return studentFee
}

export async function cancelStudentFee(app: SchoolService, input: {
  studentFeeId: string
  reason: string
}): Promise<StudentFee> {
  const existing = await app.base.studentFees.findById(input.studentFeeId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const studentFee = existing.copyWith({
    status: FeeStatus.Cancelled,
    cancellationReason: input.reason,
    cancelledById: resolveAuditActorId(app.base.actor),
    cancelledAt: new Date(),
    updatedAt: new Date(),
  })
  await app.base.studentFees.save(studentFee)
  return studentFee
}

export async function buildFeeSummary(app: SchoolService, studentId: string) {
  return buildStudentFeeSummary(await app.base.studentFees.list({ studentId }))
}

export async function saveResourceAssignment(app: SchoolService, input: ArgsOf<typeof ResourceAssignment>): Promise<ResourceAssignment> {
  const assignment = new ResourceAssignment(input)
  await app.base.resourceAssignments.save(assignment)
  return assignment
}

export async function saveAttachment(app: SchoolService, input: ArgsOf<typeof Attachment>): Promise<Attachment> {
  const attachment = new Attachment(input)
  await app.base.attachments.save(attachment)
  return attachment
}

export async function saveReportCardDefinition(app: SchoolService, input: ArgsOf<typeof ReportCardDefinition>): Promise<ReportCardDefinition> {
  const definition = new ReportCardDefinition(input)
  await app.base.definitions.save(definition)
  return definition
}

export async function saveAssessment(app: SchoolService, input: ArgsOf<typeof Assessment>): Promise<Assessment> {
  const assessment = new Assessment(input)
  await app.base.assessments.save(assessment)
  return assessment
}

export async function saveIncident(
  app: SchoolService,
  input: Omit<ArgsOf<typeof Incident>, 'reporterId'> & Partial<Pick<ArgsOf<typeof Incident>, 'reporterId'>>,
): Promise<Incident> {
  const incident = new Incident({
    ...input,
    reporterId: input.reporterId ?? resolveAuditActorId(app.base.actor),
  })
  await app.base.incidents.save(incident)
  return incident
}

export async function resolveIncident(app: SchoolService, incidentId: string): Promise<Incident> {
  const existing = await app.base.incidents.findById(incidentId)
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
    resolvedByStaffId: resolveAuditActorId(app.base.actor),
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  })
  await app.base.incidents.save(incident)
  return incident
}

export async function reviewAttendanceJustification(app: SchoolService, input: {
  studentId: string
  sessionId: string
  decision: AttendanceJustificationStatus
  reason?: string
}) {
  const existing = await app.base.attendance.findOne({
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
    justifiedByStaffId: resolveAuditActorId(app.base.actor),
  })
  await app.base.attendance.save(record)
  return record
}

export async function saveAnnouncement(app: SchoolService, input: ArgsOf<typeof Announcement>): Promise<Announcement> {
  const announcement = new Announcement(input)
  await app.base.announcements.save(announcement)
  return announcement
}

export async function saveAnnouncementTarget(app: SchoolService, input: ArgsOf<typeof AnnouncementTarget>): Promise<AnnouncementTarget> {
  const target = new AnnouncementTarget(input)
  await app.base.announcementTargets.save(target)
  return target
}

export async function listClassSubjectAssessmentResultsForPeriod(app: SchoolService, input: {
  classSubjectId: string
  periodId: string
}) {
  const classSubject = await app.base.classSubjects.findById(input.classSubjectId)
  const period = await app.base.academicPeriods.findById(input.periodId)
  if (!classSubject || !period) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const assessments = await app.base.assessments.list({
    classSubjectId: input.classSubjectId,
    periodId: input.periodId,
  })
  const results = []
  for (const assessment of assessments) {
    results.push(...await app.base.assessmentResults.list({ assessmentId: assessment.id }))
  }
  return results
}
