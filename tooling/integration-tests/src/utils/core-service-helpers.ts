import type { Permission } from '@edaya/authorization'
import type { AttendanceJustificationStatus, SubjectInput } from '@edaya/core'
import type { SchoolRepositories, SchoolService } from '@edaya/service'
import { AuthorizationError, AuthorizationErrorCode, resolveAuditActorId } from '@edaya/authorization'
import { AcademicDiscipline, AcademicPeriod, Announcement, AnnouncementTarget, Assessment, Attachment, CalendarEvent, CatalogServiceStatus, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, GradeLevel, Guardian, GuardianStudentLink, Incident, IncidentStatus, LessonSession, OccurrenceStatus, permissionScope, ResourceAssignment, Schedule, School, StaffAssignment, StaffMember, StaffPermissionAssignment, Student, StudentHealthProfile, StudentNote } from '@edaya/core'

type ArgsOf<T extends abstract new (...args: any) => any> = ConstructorParameters<T>[0]

export async function seedStaffPermissionTemplate(
  repositories: SchoolRepositories,
  input: {
    staffId: string
    schoolId: string
    academicYearId: string
    permissions: readonly Permission[]
    idPrefix?: string
  },
): Promise<void> {
  const rows = input.permissions.map((permission) => {
    const grain = permissionScope(permission)
    if (grain === 'platform')
      throw new Error('School fixtures cannot grant platform authority')
    return {
      staffId: input.staffId,
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      permission,
      scopes: grain ? [{ kind: 'all' as const, grain }] : [{ kind: 'school' as const }],
    }
  })

  for (const [index, row] of rows.entries()) {
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: `${input.idPrefix ?? `spa-${input.staffId}`}-${index}`,
      ...row,
      status: 'active',
    }))
  }
}

/** Explicit synthetic catalogue fixture; production schools start empty. */
export function withFixtureDiscipline(input: SubjectInput): SubjectInput {
  return { ...input, disciplineId: input.disciplineId ?? `fixture-discipline-${input.schoolId}` }
}

export async function saveSchool(app: SchoolService, input: ArgsOf<typeof School>): Promise<School> {
  const existing = await app.baseService.repositories.schools.findById(input.id)
  const school = new School({ ...input, ownerSubjectId: input.ownerSubjectId ?? existing?.ownerSubjectId })
  await app.baseService.entities.schools.save(school)
  await app.baseService.repositories.academicDisciplines.save(new AcademicDiscipline({ id: `fixture-discipline-${school.id}`, schoolId: school.id, code: 'FIXTURE', name: 'Synthetic test curriculum' }))
  return school
}

export async function updateSchool(app: SchoolService, input: { schoolId: string } & Partial<Omit<ArgsOf<typeof School>, 'id'>>): Promise<School> {
  const existing = await app.baseService.entities.schools.findById(input.schoolId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const school = new School({
    id: existing.id,
    name: input.name ?? existing.name,
    timeZone: input.timeZone ?? existing.timeZone,
    ownerSubjectId: input.ownerSubjectId ?? existing.ownerSubjectId,
    financeCurrency: input.financeCurrency ?? existing.financeCurrency,
    shortName: input.shortName ?? existing.shortName,
    country: input.country ?? existing.country,
    city: input.city ?? existing.city,
    createdAt: existing.createdAt,
  })
  await app.baseService.entities.schools.save(school)
  return school
}

export async function createAcademicPeriod(app: SchoolService, input: ArgsOf<typeof AcademicPeriod>): Promise<AcademicPeriod> {
  const period = new AcademicPeriod(input)
  await app.baseService.entities.academicPeriods.save(period)
  return period
}

export async function publishAcademicPeriod(app: SchoolService, academicPeriodId: string): Promise<AcademicPeriod> {
  return app.setupWorkflow.publishAcademicPeriod({ academicPeriodId })
}

export async function createClassGroup(app: SchoolService, input: ArgsOf<typeof ClassGroup>): Promise<ClassGroup> {
  const classGroup = new ClassGroup(input)
  await app.baseService.entities.classGroups.save(classGroup)
  return classGroup
}

export async function updateClassGroup(app: SchoolService, input: { classGroupId: string } & Partial<Omit<ArgsOf<typeof ClassGroup>, 'id'>>): Promise<ClassGroup> {
  const existing = await app.baseService.entities.classGroups.findById(input.classGroupId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
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
  await app.baseService.entities.classGroups.save(classGroup)
  return classGroup
}

export async function saveStaffMember(app: SchoolService, input: ArgsOf<typeof StaffMember>): Promise<StaffMember> {
  const staffMember = new StaffMember(input)
  await app.baseService.entities.staffMembers.save(staffMember)
  return staffMember
}

export async function updateStaffStatus(app: SchoolService, staffId: string, isActive: boolean): Promise<StaffMember> {
  const existing = await app.baseService.entities.staffMembers.findById(staffId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
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
  await app.baseService.entities.staffMembers.save(staffMember)
  return staffMember
}

export async function saveStaffAssignment(app: SchoolService, input: ArgsOf<typeof StaffAssignment>): Promise<StaffAssignment> {
  const assignment = new StaffAssignment(input)
  await app.baseService.entities.staffAssignments.save(assignment)
  return assignment
}

export async function saveStudent(app: SchoolService, input: ArgsOf<typeof Student>): Promise<Student> {
  const student = new Student(input)
  await app.baseService.entities.students.save(student)
  return student
}

export async function updateStudent(app: SchoolService, input: { studentId: string } & Partial<Omit<ArgsOf<typeof Student>, 'id'>>): Promise<Student> {
  const existing = await app.baseService.entities.students.findById(input.studentId)
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
  await app.baseService.entities.students.save(student)
  return student
}

export async function saveGuardian(app: SchoolService, input: ArgsOf<typeof Guardian>): Promise<Guardian> {
  const guardian = new Guardian(input)
  await app.baseService.entities.guardians.save(guardian)
  return guardian
}

export async function saveStudentNote(
  app: SchoolService,
  input: Omit<ArgsOf<typeof StudentNote>, 'schoolId' | 'authorStaffId'> & Partial<Pick<ArgsOf<typeof StudentNote>, 'schoolId' | 'authorStaffId'>>,
): Promise<StudentNote> {
  const student = await app.baseService.entities.students.findById(input.studentId)
  if (!student) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const note = new StudentNote({
    ...input,
    schoolId: input.schoolId ?? student.schoolId,
    authorStaffId: input.authorStaffId ?? resolveAuditActorId(app.baseService.actor),
  })
  await app.baseService.entities.studentNotes.save(note)
  return note
}

export async function saveStudentHealthProfile(app: SchoolService, input: ArgsOf<typeof StudentHealthProfile>): Promise<StudentHealthProfile> {
  const profile = new StudentHealthProfile(input)
  await app.baseService.entities.studentHealthProfiles.save(profile)
  return profile
}

export async function saveStudentHealthProfileForStudent(
  app: SchoolService,
  input: Omit<ArgsOf<typeof StudentHealthProfile>, 'schoolId'> & Partial<Pick<ArgsOf<typeof StudentHealthProfile>, 'schoolId'>>,
): Promise<StudentHealthProfile> {
  const student = await app.baseService.entities.students.findById(input.studentId)
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
  const existing = await app.baseService.entities.studentNotes.findById(input.noteId)
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
  await app.baseService.entities.studentNotes.save(note)
  return note
}

export async function updateGuardian(app: SchoolService, input: {
  guardianId: string
  firstName?: string
}): Promise<Guardian> {
  const existing = await app.baseService.entities.guardians.findById(input.guardianId)
  if (!existing) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const guardian = new Guardian({
    id: existing.id,
    schoolId: existing.schoolId,
    firstName: input.firstName ?? existing.firstName,
    lastName: existing.lastName,
    subjectId: existing.subjectId,
    hasAccess: existing.hasAccess,
    createdAt: existing.createdAt,
  })
  await app.baseService.entities.guardians.save(guardian)
  return guardian
}

export async function updateGuardianStudentLink(app: SchoolService, input: {
  guardianId: string
  studentId: string
  isBillingContact?: boolean
}): Promise<GuardianStudentLink> {
  const existing = await app.baseService.entities.guardianLinks.findOne({
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
  await app.baseService.entities.guardianLinks.save(link)
  return link
}

export async function saveClassSubject(
  app: SchoolService,
  input: ArgsOf<typeof ClassSubject>,
): Promise<ClassSubject> {
  await app.academicsWorkflow.syncSubjectsToClassGroup(input.classGroupId, { [input.subjectId]: { classSubjectId: input.id } })
  const classSubject = await app.baseService.repositories.classSubjects.findOne({ classGroupId: input.classGroupId, subjectId: input.subjectId })
  if (!classSubject)
    throw new Error(`Missing offering for ${input.subjectId}`)
  if (input.coefficient !== undefined)
    await app.academicsWorkflow.updateSubject({ subjectId: input.subjectId, coefficient: input.coefficient })
  if (input.isOffered !== undefined)
    await app.academicsWorkflow.setClassSubjectOffered({ classSubjectId: classSubject.id, expectedParticipationRevision: classSubject.participationRevision, isOffered: input.isOffered })
  if (input.completedPercentage !== undefined)
    await app.baseService.entities.classSubjects.save(new ClassSubject({ ...classSubject.data, completedPercentage: input.completedPercentage }))
  return (await app.baseService.repositories.classSubjects.findById(classSubject.id))!
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
  await app.baseService.entities.classSubjectMatters.save(matter)
  return matter
}

export async function listMatterProgress(app: SchoolService, classSubjectMatterId: string) {
  return app.baseService.entities.classSubjectProgress.list({ classSubjectMatterId })
}

export interface SaveLessonSessionInput {
  id: string
  schoolId?: string
  classGroupId: string
  classSubjectId?: string
  scheduleId?: string
  displayLabel?: string
  startsAt: Date
  endsAt: Date
  status?: OccurrenceStatus
  isException?: boolean
}

export async function saveLessonSession(
  app: SchoolService,
  input: SaveLessonSessionInput,
): Promise<LessonSession> {
  if (!input.classSubjectId) {
    throw new Error('saveLessonSession requires classSubjectId')
  }
  const lessonSession = new LessonSession({
    id: input.id,
    schoolId: input.schoolId ?? 'school',
    classGroupId: input.classGroupId,
    classSubjectId: input.classSubjectId,
    scheduleId: input.scheduleId,
    displayLabel: input.displayLabel ?? 'Lesson',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status ?? OccurrenceStatus.Pending,
    isException: input.isException ?? false,
  })
  await app.baseService.entities.lessonSessions.save(lessonSession)
  return lessonSession
}

export async function saveSchedule(
  app: SchoolService,
  input: Omit<ArgsOf<typeof Schedule>, 'schoolId'> & { schoolId?: string },
): Promise<Schedule> {
  const schoolId = input.schoolId
    ?? (await app.baseService.repositories.classGroups.findById(input.classGroupId))?.schoolId
  if (!schoolId) {
    throw new Error(`saveSchedule could not resolve schoolId for class group ${input.classGroupId}`)
  }
  const schedule = new Schedule({ ...input, schoolId })
  await app.baseService.entities.schedules.save(schedule)
  return schedule
}

export async function saveCalendarEvent(app: SchoolService, input: ArgsOf<typeof CalendarEvent>): Promise<CalendarEvent> {
  const event = new CalendarEvent(input)
  await app.baseService.entities.calendarEvents.save(event)
  return event
}

export async function saveFee(app: SchoolService, input: {
  id: string
  schoolId: string
  academicYearId: string
  name: string
  defaultAmount: number
  currency: string
}) {
  return app.financeWorkflow.createCatalogService({
    id: input.id,
    academicYearId: input.academicYearId,
    name: input.name,
    defaultPrice: input.defaultAmount,
    currency: input.currency,
    billingTerms: { kind: 'one_time', installments: [] },
    status: CatalogServiceStatus.Active,
  })
}

export async function assignCatalogService(app: SchoolService, input: {
  id: string
  studentId: string
  catalogServiceId: string
}) {
  return app.financeWorkflow.enrollStudentInService(input)
}

export async function adjustStudentFee(app: SchoolService, input: {
  studentFeeId: string
  adjustmentAmount: number
  reason: string
}) {
  return app.financeWorkflow.adjustStudentCharge({
    requestId: crypto.randomUUID(),
    chargeId: input.studentFeeId,
    adjustmentAmount: input.adjustmentAmount,
    reason: input.reason,
  })
}

export async function cancelStudentFee(app: SchoolService, input: {
  studentFeeId: string
  reason: string
}) {
  return app.financeWorkflow.cancelStudentCharge({
    requestId: crypto.randomUUID(),
    chargeId: input.studentFeeId,
    reason: input.reason,
  })
}

export async function buildFeeSummary(app: SchoolService, studentId: string, academicYearId: string) {
  return app.getStudentFinanceSummary({ studentId, academicYearId })
}

export async function saveResourceAssignment(app: SchoolService, input: ArgsOf<typeof ResourceAssignment>): Promise<ResourceAssignment> {
  const assignment = new ResourceAssignment(input)
  await app.baseService.entities.resourceAssignments.save(assignment)
  return assignment
}

export async function saveAttachment(app: SchoolService, input: ArgsOf<typeof Attachment>): Promise<Attachment> {
  const attachment = new Attachment(input)
  await app.baseService.entities.attachments.save(attachment)
  return attachment
}

export async function seedReportGradingPolicy(app: SchoolService, input: { gradeLevelId: string, academicYearId: string, gradeScaleId: string }): Promise<void> {
  const level = (await app.baseService.repositories.gradeLevels.findById(input.gradeLevelId))!
  const scale = (await app.baseService.repositories.gradeScales.findById(input.gradeScaleId))!
  await app.baseService.repositories.gradeLevels.save(new GradeLevel({ ...level.data, gradingPolicies: [{ academicYearId: input.academicYearId, revision: 1, mode: 'numeric-first', aggregateLabel: 'Average', status: 'completed', scale: { ...scale.data, ranges: [...scale.ranges] } }] }))
}

export async function saveAssessment(app: SchoolService, input: ArgsOf<typeof Assessment>): Promise<Assessment> {
  const assessment = new Assessment(input)
  await app.baseService.entities.assessments.save(assessment)
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
  await app.baseService.entities.incidents.save(incident)
  return incident
}

export async function resolveIncident(app: SchoolService, incidentId: string): Promise<Incident> {
  const existing = await app.baseService.entities.incidents.findById(incidentId)
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
    lessonSessionId: existing.lessonSessionId,
    status: IncidentStatus.Resolved,
    resolutionNotes: 'Resolved',
    resolvedAt: new Date(),
    resolvedByStaffId: resolveAuditActorId(app.baseService.actor),
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  })
  await app.baseService.entities.incidents.save(incident)
  return incident
}

export async function reviewAttendanceJustification(app: SchoolService, input: {
  studentId: string
  lessonSessionId: string
  decision: AttendanceJustificationStatus
  reason?: string
}) {
  const existing = await app.baseService.entities.attendance.findOne({
    studentId: input.studentId,
    lessonSessionId: input.lessonSessionId,
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
  await app.baseService.entities.attendance.save(record)
  return record
}

export async function saveAnnouncement(app: SchoolService, input: ArgsOf<typeof Announcement>): Promise<Announcement> {
  const announcement = new Announcement(input)
  await app.baseService.entities.announcements.save(announcement)
  return announcement
}

export async function saveAnnouncementTarget(app: SchoolService, input: ArgsOf<typeof AnnouncementTarget>): Promise<AnnouncementTarget> {
  const target = new AnnouncementTarget(input)
  await app.baseService.entities.announcementTargets.save(target)
  return target
}

export async function listClassSubjectAssessmentResultsForPeriod(app: SchoolService, input: {
  classSubjectId: string
  periodId: string
}) {
  const classSubject = await app.baseService.entities.classSubjects.findById(input.classSubjectId)
  const period = await app.baseService.entities.academicPeriods.findById(input.periodId)
  if (!classSubject || !period) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const assessments = await app.baseService.entities.assessments.list({
    classSubjectId: input.classSubjectId,
    periodId: input.periodId,
  })
  const results = []
  for (const assessment of assessments) {
    results.push(...await app.baseService.entities.assessmentResults.list({ assessmentId: assessment.id }))
  }
  return results
}
