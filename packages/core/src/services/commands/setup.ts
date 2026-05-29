import type { AcademicPeriodType } from '../../entities/school/academic-period'
import type { AttachmentOwnerKind } from '../../entities/school/attachment'
import type { AttendanceMode } from '../../entities/school/class-group'
import type { ResourceKind } from '../../entities/school/resource'
import type { SchoolType } from '../../entities/school/school'
import type { StaffRole } from '../../entities/school/staff-member'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizationAction, AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { AcademicPeriod } from '../../entities/school/academic-period'
import { AcademicYear } from '../../entities/school/academic-year'
import { Attachment, AttachmentOwnerKind as OwnerKind } from '../../entities/school/attachment'
import { ClassGroup } from '../../entities/school/class-group'
import { GradeLevel } from '../../entities/school/grade-level'
import { Resource } from '../../entities/school/resource'
import { ResourceAssignment } from '../../entities/school/resource-assignment'
import { School } from '../../entities/school/school'
import { StaffAssignment } from '../../entities/school/staff-assignment'
import { StaffMember } from '../../entities/school/staff-member'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { requireSchool } from '../shared/require-school'

export class SetupService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.repositories = args.repositories
  }

  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly repositories: SchoolRepositories

  async registerSchool({
    id,
    name,
    timeZone,
    type,
    country,
    city,
    createdAt,
  }: {
    id: string
    name: string
    timeZone: string
    type?: SchoolType
    country?: string
    city?: string
    createdAt?: Date
  }): Promise<School> {
    await this.authorize('setup.register_school', id)
    const school = new School({ id, name, timeZone, type, country, city, createdAt })
    await this.repositories.schools.save(school)
    return school
  }

  async updateSchoolConfiguration({
    schoolId,
    name,
    timeZone,
    type,
    country,
    city,
  }: {
    schoolId: string
    name?: string
    timeZone?: string
    type?: SchoolType | null
    country?: string | null
    city?: string | null
  }): Promise<School> {
    const existing = await requireSchool(this.repositories.schools, schoolId)
    await this.authorize('setup.manage_lifecycle', schoolId)
    const school = new School({
      id: existing.id,
      name: name ?? existing.name,
      timeZone: timeZone ?? existing.timeZone,
      type: type === undefined ? existing.type : type,
      country: country === undefined ? existing.country : country,
      city: city === undefined ? existing.city : city,
      createdAt: existing.createdAt,
    })
    await this.repositories.schools.save(school)
    return school
  }

  async createAcademicYear({
    id,
    schoolId,
    name,
    startDate,
    endDate,
    isActive = true,
    createdAt,
  }: {
    id: string
    schoolId: string
    name: string
    startDate: Date
    endDate: Date
    isActive?: boolean
    createdAt?: Date
  }): Promise<AcademicYear> {
    await this.authorize('setup.manage', schoolId)
    await requireSchool(this.repositories.schools, schoolId)
    return this.atomicCreateAcademicYear({ id, schoolId, name, startDate, endDate, isActive, createdAt })
  }

  private async atomicCreateAcademicYear({
    id,
    schoolId,
    name,
    startDate,
    endDate,
    isActive,
    createdAt,
  }: {
    id: string
    schoolId: string
    name: string
    startDate: Date
    endDate: Date
    isActive: boolean
    createdAt?: Date
  }): Promise<AcademicYear> {
    const academicYear = new AcademicYear({ id, schoolId, name, startDate, endDate, isActive, createdAt })
    if (!academicYear.isActive) {
      await this.repositories.academicYears.save(academicYear)
      return academicYear
    }
    await this.deactivateOtherAcademicYears(schoolId, academicYear.id)
    await this.repositories.academicYears.save(academicYear)
    return academicYear
  }

  async activateAcademicYear({ academicYearId }: { academicYearId: string }): Promise<AcademicYear> {
    const academicYear = await this.repositories.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    await this.authorize('setup.manage_lifecycle', academicYear.schoolId, { academicYearId: academicYear.id })
    await this.deactivateOtherAcademicYears(academicYear.schoolId, academicYear.id)
    const activated = new AcademicYear({
      id: academicYear.id,
      schoolId: academicYear.schoolId,
      name: academicYear.name,
      startDate: academicYear.startDate,
      endDate: academicYear.endDate,
      isActive: true,
      createdAt: academicYear.createdAt,
    })
    await this.repositories.academicYears.save(activated)
    return activated
  }

  async publishAcademicPeriod({ academicPeriodId }: { academicPeriodId: string }): Promise<AcademicPeriod> {
    const period = await this.repositories.academicPeriods.findById(academicPeriodId)
    if (!period) {
      denyResourceAccess()
    }
    await this.authorize('setup.manage_lifecycle', period.schoolId, { academicYearId: period.academicYearId })
    const academicYear = await this.requireResourceInSchool(
      this.repositories.academicYears.findById(period.academicYearId),
      period.schoolId,
    )
    if (period.startDate.getTime() < academicYear.startDate.getTime() || period.endDate.getTime() > academicYear.endDate.getTime()) {
      throw new BusinessRuleViolationError('ACADEMIC_PERIOD_OUTSIDE_YEAR', `Academic period ${period.id} must fit within academic year ${academicYear.id}`)
    }
    const published = new AcademicPeriod({
      id: period.id,
      schoolId: period.schoolId,
      academicYearId: period.academicYearId,
      name: period.name,
      type: period.type,
      startDate: period.startDate,
      endDate: period.endDate,
      isPublished: true,
      createdAt: period.createdAt,
    })
    await this.repositories.academicPeriods.save(published)
    return published
  }

  async createAcademicPeriod({
    id,
    schoolId,
    academicYearId,
    name,
    type,
    startDate,
    endDate,
    isPublished = false,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    name: string
    type: AcademicPeriodType
    startDate: Date
    endDate: Date
    isPublished?: boolean
    createdAt?: Date
  }): Promise<AcademicPeriod> {
    await this.authorize('setup.manage', schoolId)
    await requireSchool(this.repositories.schools, schoolId)
    const academicYear = await this.requireResourceInSchool(
      this.repositories.academicYears.findById(academicYearId),
      schoolId,
    )
    if (startDate.getTime() < academicYear.startDate.getTime() || endDate.getTime() > academicYear.endDate.getTime()) {
      throw new BusinessRuleViolationError('ACADEMIC_PERIOD_OUTSIDE_YEAR', `Academic period ${id} must fit within academic year ${academicYearId}`)
    }
    const period = new AcademicPeriod({
      id,
      schoolId,
      academicYearId,
      name,
      type,
      startDate,
      endDate,
      isPublished,
      createdAt,
    })
    await this.repositories.academicPeriods.save(period)
    return period
  }

  async createGradeLevel({
    id,
    schoolId,
    name,
    order,
    cycle,
    createdAt,
  }: {
    id: string
    schoolId: string
    name: string
    order: number
    cycle?: string
    createdAt?: Date
  }): Promise<GradeLevel> {
    await this.authorize('setup.manage', schoolId)
    await requireSchool(this.repositories.schools, schoolId)
    const gradeLevel = new GradeLevel({ id, schoolId, name, order, cycle, createdAt })
    await this.repositories.gradeLevels.save(gradeLevel)
    return gradeLevel
  }

  async createClassGroup({
    id,
    schoolId,
    academicYearId,
    gradeLevelId,
    name,
    capacity,
    attendanceMode,
    homeroomStaffId,
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    gradeLevelId: string
    name: string
    capacity?: number
    attendanceMode?: AttendanceMode
    homeroomStaffId?: string | null
    createdAt?: Date
  }): Promise<ClassGroup> {
    await this.authorize('setup.manage', schoolId)
    await requireSchool(this.repositories.schools, schoolId)
    await Promise.all([
      this.requireResourceInSchool(this.repositories.academicYears.findById(academicYearId), schoolId),
      this.requireResourceInSchool(this.repositories.gradeLevels.findById(gradeLevelId), schoolId),
    ])
    if (homeroomStaffId) {
      await this.requireStaffMemberInSchool(homeroomStaffId, schoolId)
    }
    const classGroup = new ClassGroup({
      id,
      schoolId,
      academicYearId,
      gradeLevelId,
      name,
      capacity,
      attendanceMode,
      homeroomStaffId,
      createdAt,
    })
    await this.repositories.classGroups.save(classGroup)
    return classGroup
  }

  async updateClassGroupConfiguration({
    classGroupId,
    name,
    capacity,
    attendanceMode,
    homeroomStaffId,
  }: {
    classGroupId: string
    name?: string
    capacity?: number | null
    attendanceMode?: AttendanceMode
    homeroomStaffId?: string | null
  }): Promise<ClassGroup> {
    const existing = await this.requireClassGroup(classGroupId)
    await this.authorize('setup.manage_lifecycle', existing.schoolId, { classGroupId: existing.id })
    if (capacity !== undefined && capacity !== null) {
      await this.requireCapacityCanFitCurrentEnrollment(existing.id, capacity)
    }
    if (homeroomStaffId) {
      await this.requireStaffMemberInSchool(homeroomStaffId, existing.schoolId)
    }
    const classGroup = new ClassGroup({
      id: existing.id,
      schoolId: existing.schoolId,
      academicYearId: existing.academicYearId,
      gradeLevelId: existing.gradeLevelId,
      name: name ?? existing.name,
      capacity: capacity === undefined ? existing.capacity : capacity,
      attendanceMode: attendanceMode ?? existing.attendanceMode,
      homeroomStaffId: homeroomStaffId === undefined ? existing.homeroomStaffId : homeroomStaffId,
      createdAt: existing.createdAt,
    })
    await this.repositories.classGroups.save(classGroup)
    return classGroup
  }

  async registerStaffMember({
    id,
    schoolId,
    firstName,
    lastName,
    roles,
    email,
    isActive = true,
    createdAt,
  }: {
    id: string
    schoolId: string
    firstName: string
    lastName: string
    roles: readonly StaffRole[]
    email?: string
    isActive?: boolean
    createdAt?: Date
  }): Promise<StaffMember> {
    await this.authorize('setup.manage', schoolId)
    await requireSchool(this.repositories.schools, schoolId)

    const existing = await this.repositories.staffMembers.findById(id)
    const mergedRoles = [...new Set([...(existing?.roles ?? []), ...roles])]
    const staffMember = new StaffMember({
      id,
      schoolId,
      firstName,
      lastName,
      roles: mergedRoles,
      email: email ?? existing?.email,
      isActive,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.repositories.staffMembers.save(staffMember)
    return staffMember
  }

  async updateStaffMemberStatus({
    staffId,
    isActive,
  }: {
    staffId: string
    isActive: boolean
  }): Promise<StaffMember> {
    const staffMember = await this.repositories.staffMembers.findById(staffId)
    if (!staffMember) {
      denyResourceAccess()
    }
    await this.authorize('setup.manage_lifecycle', staffMember.schoolId)
    if (!isActive && this.actor.kind === 'staff' && staffMember.id === this.actor.staffMemberId) {
      throw new BusinessRuleViolationError('SELF_DEACTIVATION_BLOCKED', 'Staff members cannot deactivate their own account')
    }
    const updated = new StaffMember({
      id: staffMember.id,
      schoolId: staffMember.schoolId,
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      roles: staffMember.roles,
      email: staffMember.email,
      isActive,
      createdAt: staffMember.createdAt,
    })
    await this.repositories.staffMembers.save(updated)
    return updated
  }

  async assignStaffToClass({
    id,
    staffId,
    classGroupId,
    role,
    createdAt,
  }: {
    id: string
    staffId: string
    classGroupId: string
    role: StaffRole
    createdAt?: Date
  }): Promise<StaffAssignment> {
    const classGroup = await this.requireClassGroup(classGroupId)
    await this.authorize('setup.assign_staff', classGroup.schoolId, { classGroupId: classGroup.id })
    await this.requireStaffMemberInSchool(staffId, classGroup.schoolId)
    const assignment = new StaffAssignment({ id, classGroupId, staffId, role, createdAt })
    await this.repositories.staffAssignments.save(assignment)
    return assignment
  }

  async assignStaffToClassSubject({
    id,
    staffId,
    classSubjectId,
    role,
    createdAt,
  }: {
    id: string
    staffId: string
    classSubjectId: string
    role: StaffRole
    createdAt?: Date
  }): Promise<StaffAssignment> {
    const classSubject = await this.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorize('setup.assign_staff', classGroup.schoolId, {
      classGroupId: classGroup.id,
      classSubjectId: classSubject.id,
    })
    await this.requireStaffMemberInSchool(staffId, classGroup.schoolId)
    const assignment = new StaffAssignment({ id, classSubjectId, staffId, role, createdAt })
    await this.repositories.staffAssignments.save(assignment)
    return assignment
  }

  async assignStaffToSession({
    id,
    staffId,
    sessionId,
    role,
    createdAt,
  }: {
    id: string
    staffId: string
    sessionId: string
    role: StaffRole
    createdAt?: Date
  }): Promise<StaffAssignment> {
    const session = await this.repositories.sessions.findById(sessionId)
    if (!session) {
      denyResourceAccess()
    }
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('setup.assign_staff', classGroup.schoolId, {
      classGroupId: classGroup.id,
      sessionId: session.id,
    })
    await this.requireStaffMemberInSchool(staffId, classGroup.schoolId)
    const assignment = new StaffAssignment({ id, sessionId, staffId, role, createdAt })
    await this.repositories.staffAssignments.save(assignment)
    return assignment
  }

  async createResource({
    id,
    schoolId,
    name,
    description,
    kind,
    capacity,
    createdAt,
  }: {
    id: string
    schoolId: string
    name: string
    description?: string
    kind: ResourceKind
    capacity?: number
    createdAt?: Date
  }): Promise<Resource> {
    await this.authorize('resources.manage', schoolId)
    await requireSchool(this.repositories.schools, schoolId)
    const resource = new Resource({ id, schoolId, name, description, kind, capacity, createdAt })
    await this.repositories.resources.save(resource)
    return resource
  }

  async assignResourceToClass({
    id,
    resourceId,
    classGroupId,
    createdAt,
  }: {
    id: string
    resourceId: string
    classGroupId: string
    createdAt?: Date
  }): Promise<ResourceAssignment> {
    const { resource, classGroup } = await this.requireResourceAndClass(resourceId, classGroupId)
    await this.authorize('resources.manage', resource.schoolId, { classGroupId: classGroup.id, resourceId: resource.id })
    await this.ensureResourceCanBeAssignedToClass(resource.id, classGroup.id)
    const assignment = new ResourceAssignment({ id, resourceId: resource.id, classGroupId: classGroup.id, createdAt })
    await this.repositories.resourceAssignments.save(assignment)
    return assignment
  }

  async assignResourceToSession({
    id,
    resourceId,
    sessionId,
    createdAt,
  }: {
    id: string
    resourceId: string
    sessionId: string
    createdAt?: Date
  }): Promise<ResourceAssignment> {
    const { resource, session, classGroup } = await this.requireResourceAndSession(resourceId, sessionId)
    await this.authorize('resources.manage', resource.schoolId, {
      classGroupId: classGroup.id,
      sessionId: session.id,
      resourceId: resource.id,
    })
    await this.ensureResourceCanBeAssignedToSession(resource.id, session.id)
    const assignment = new ResourceAssignment({ id, resourceId: resource.id, sessionId: session.id, createdAt })
    await this.repositories.resourceAssignments.save(assignment)
    return assignment
  }

  async removeResourceAssignment({ assignmentId }: { assignmentId: string }): Promise<void> {
    const assignment = await this.repositories.resourceAssignments.findById(assignmentId)
    if (!assignment) {
      denyResourceAccess()
    }
    const context = await this.resolveResourceAssignmentContext(assignment)
    await this.authorize('resources.manage', context.schoolId, {
      classGroupId: context.classGroupId,
      sessionId: context.sessionId,
      resourceId: assignment.resourceId,
    })
  }

  async registerAttachment({
    id,
    schoolId,
    ownerKind,
    ownerId,
    fileName,
    fileUrl,
    mimeType,
    sizeBytes,
    createdAt,
  }: {
    id: string
    schoolId: string
    ownerKind: AttachmentOwnerKind
    ownerId: string
    fileName: string
    fileUrl: string
    mimeType?: string
    sizeBytes?: number
    createdAt?: Date
  }): Promise<Attachment> {
    const context = await this.resolveAttachmentOwnerContext(ownerKind, ownerId)
    if (context.schoolId !== schoolId) {
      denyResourceAccess()
    }
    await this.authorize('attachments.manage', schoolId, context)
    const attachment = new Attachment({
      id,
      schoolId,
      ownerKind,
      ownerId,
      fileName,
      fileUrl,
      mimeType,
      sizeBytes,
      uploadedById: resolveAuditActorId(this.actor),
      createdAt,
    })
    await this.repositories.attachments.save(attachment)
    return attachment
  }

  async removeAttachment({ attachmentId }: { attachmentId: string }): Promise<void> {
    const attachment = await this.repositories.attachments.findById(attachmentId)
    if (!attachment) {
      denyResourceAccess()
    }
    const context = await this.resolveAttachmentOwnerContext(attachment.ownerKind, attachment.ownerId)
    if (context.schoolId !== attachment.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('attachments.manage', attachment.schoolId, { ...context, attachmentId: attachment.id })
  }

  private async authorize(
    action: AuthorizationAction,
    schoolId: string,
    resource: {
      academicYearId?: string
      attachmentId?: string
      classGroupId?: string
      classSubjectId?: string
      resourceId?: string
      sessionId?: string
      studentId?: string
    } = {},
  ): Promise<void> {
    if (schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    switch (action) {
      case 'setup.register_school':
      case 'setup.manage':
      case 'setup.manage_lifecycle':
      case 'setup.assign_staff':
      case 'resources.manage':
      case 'attachments.manage':
        await this.authorizationPolicy.checkGlobalAction(this.actor, action)
        if (resource.classGroupId) {
          await this.authorizationPolicy.checkClassGroupAccess(this.actor, [resource.classGroupId])
        }
        if (resource.sessionId) {
          await this.authorizationPolicy.checkSessionAccess(this.actor, [resource.sessionId])
        }
        if (resource.studentId) {
          await this.authorizationPolicy.checkStudentAccess(this.actor, [resource.studentId])
        }
        break
      default:
        await this.authorizationPolicy.checkGlobalAction(this.actor, action)
    }
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async requireCapacityCanFitCurrentEnrollment(classGroupId: string, capacity: number): Promise<void> {
    const activeEnrollmentCount = await this.repositories.enrollments.count({
      classGroupId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (capacity < activeEnrollmentCount) {
      throw new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_BELOW_ENROLLMENTS', `Class group ${classGroupId} capacity cannot be below current active enrollment count`)
    }
  }

  private async deactivateOtherAcademicYears(schoolId: string, activeAcademicYearId: string): Promise<void> {
    const activeAcademicYears = await this.repositories.academicYears.list({ schoolId, isActive: true })
    for (const academicYear of activeAcademicYears) {
      if (academicYear.id === activeAcademicYearId) {
        continue
      }
      await this.repositories.academicYears.save(new AcademicYear({
        id: academicYear.id,
        schoolId: academicYear.schoolId,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: false,
        createdAt: academicYear.createdAt,
      }))
    }
  }

  private async requireStaffMemberInSchool(staffId: string, schoolId: string): Promise<void> {
    const staffMember = await this.repositories.staffMembers.findById(staffId)
    if (!staffMember || staffMember.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireResourceInSchool<T extends { schoolId: string }>(
    resourcePromise: Promise<T | undefined>,
    schoolId: string,
  ): Promise<T> {
    const resource = await resourcePromise
    if (!resource || resource.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return resource
  }

  private async requireResourceAndClass(
    resourceId: string,
    classGroupId: string,
  ): Promise<{ resource: Resource, classGroup: ClassGroup }> {
    const [resource, classGroup] = await Promise.all([
      this.repositories.resources.findById(resourceId),
      this.repositories.classGroups.findById(classGroupId),
    ])
    if (!resource || !classGroup || resource.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    return { resource, classGroup }
  }

  private async requireResourceAndSession(
    resourceId: string,
    sessionId: string,
  ): Promise<{ resource: Resource, session: { id: string, classGroupId: string, startsAt: Date, endsAt: Date }, classGroup: ClassGroup }> {
    const [resource, session] = await Promise.all([
      this.repositories.resources.findById(resourceId),
      this.repositories.sessions.findById(sessionId),
    ])
    if (!resource || !session) {
      denyResourceAccess()
    }
    const classGroup = await this.requireClassGroup(session.classGroupId)
    if (resource.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    return { resource, session, classGroup }
  }

  private async ensureResourceCanBeAssignedToClass(resourceId: string, classGroupId: string): Promise<void> {
    const classAssignments = await this.repositories.resourceAssignments.list({
      resourceId,
      classGroupId: { $exists: true },
    })
    const duplicate = classAssignments.find(assignment => assignment.classGroupId === classGroupId)
    if (duplicate) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${resourceId} is already assigned to class ${classGroupId}`)
    }
    const conflicting = classAssignments.find(assignment => assignment.classGroupId !== classGroupId)
    if (conflicting) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${resourceId} is already assigned to class ${conflicting.classGroupId}`)
    }
  }

  private async ensureResourceCanBeAssignedToSession(resourceId: string, sessionId: string): Promise<void> {
    const session = await this.repositories.sessions.findById(sessionId)
    if (!session) {
      denyResourceAccess()
    }
    const assignments = await this.repositories.resourceAssignments.list({ resourceId })
    for (const assignment of assignments) {
      if (assignment.sessionId === sessionId) {
        throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_SESSION', `Resource ${resourceId} is already assigned to session ${sessionId}`)
      }
      if (assignment.classGroupId && assignment.classGroupId !== session.classGroupId) {
        throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${resourceId} is already assigned to class ${assignment.classGroupId}`)
      }
      if (!assignment.sessionId) {
        continue
      }
      const existingSession = await this.repositories.sessions.findById(assignment.sessionId)
      if (!existingSession) {
        denyResourceAccess()
      }
      if (this.sessionsOverlap(session, existingSession)) {
        throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_OVERLAPPING', `Resource ${resourceId} is already assigned to overlapping session ${existingSession.id}`)
      }
    }
  }

  private sessionsOverlap(
    left: { startsAt: Date, endsAt: Date },
    right: { startsAt: Date, endsAt: Date },
  ): boolean {
    return left.startsAt.getTime() < right.endsAt.getTime()
      && right.startsAt.getTime() < left.endsAt.getTime()
  }

  private async resolveResourceAssignmentContext(
    assignment: ResourceAssignment,
  ): Promise<{ schoolId: string, classGroupId?: string, sessionId?: string }> {
    const resource = await this.repositories.resources.findById(assignment.resourceId)
    if (!resource) {
      denyResourceAccess()
    }
    if (assignment.classGroupId) {
      const classGroup = await this.requireClassGroup(assignment.classGroupId)
      if (classGroup.schoolId !== resource.schoolId) {
        denyResourceAccess()
      }
      return { schoolId: resource.schoolId, classGroupId: classGroup.id }
    }
    const session = await this.repositories.sessions.findById(assignment.sessionId!)
    if (!session) {
      denyResourceAccess()
    }
    const classGroup = await this.requireClassGroup(session.classGroupId)
    if (classGroup.schoolId !== resource.schoolId) {
      denyResourceAccess()
    }
    return { schoolId: resource.schoolId, classGroupId: classGroup.id, sessionId: session.id }
  }

  private async resolveAttachmentOwnerContext(
    ownerKind: AttachmentOwnerKind,
    ownerId: string,
  ): Promise<{ schoolId: string, classGroupId?: string, sessionId?: string, studentId?: string }> {
    switch (ownerKind) {
      case OwnerKind.Student:
        return this.resolveStudentOwner(ownerId)
      case OwnerKind.Guardian: {
        const guardian = await this.repositories.guardians.findById(ownerId)
        if (!guardian) {
          denyResourceAccess()
        }
        return { schoolId: guardian.schoolId }
      }
      case OwnerKind.StudentHealthProfile: {
        const healthProfile = await this.repositories.studentHealthProfiles.findById(ownerId)
        if (!healthProfile) {
          denyResourceAccess()
        }
        return { schoolId: healthProfile.schoolId, studentId: healthProfile.studentId }
      }
      case OwnerKind.StudentClassEnrollment: {
        const enrollment = await this.repositories.enrollments.findById(ownerId)
        if (!enrollment) {
          denyResourceAccess()
        }
        const classGroup = await this.requireClassGroup(enrollment.classGroupId)
        const student = await this.repositories.students.findById(enrollment.studentId)
        if (!student || student.schoolId !== classGroup.schoolId) {
          denyResourceAccess()
        }
        return { schoolId: classGroup.schoolId, classGroupId: classGroup.id, studentId: enrollment.studentId }
      }
      case OwnerKind.AttendanceRecord: {
        const record = await this.repositories.attendance.findById(ownerId)
        if (!record) {
          denyResourceAccess()
        }
        const session = await this.repositories.sessions.findById(record.sessionId)
        if (!session) {
          denyResourceAccess()
        }
        const classGroup = await this.requireClassGroup(session.classGroupId)
        const student = await this.repositories.students.findById(record.studentId)
        if (!student || student.schoolId !== classGroup.schoolId) {
          denyResourceAccess()
        }
        return { schoolId: classGroup.schoolId, classGroupId: classGroup.id, sessionId: session.id, studentId: record.studentId }
      }
      case OwnerKind.Incident: {
        const incident = await this.repositories.incidents.findById(ownerId)
        if (!incident) {
          denyResourceAccess()
        }
        return { schoolId: incident.schoolId, classGroupId: incident.classGroupId, sessionId: incident.sessionId }
      }
      case OwnerKind.StudentDisciplinaryAction: {
        const action = await this.repositories.studentDisciplinaryActions.findById(ownerId)
        if (!action) {
          denyResourceAccess()
        }
        const student = await this.repositories.students.findById(action.studentId)
        if (!student) {
          denyResourceAccess()
        }
        return { schoolId: student.schoolId, studentId: student.id }
      }
      case OwnerKind.AssessmentResult: {
        const result = await this.repositories.assessmentResults.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(result.studentId)
      }
      case OwnerKind.ReportCard: {
        const result = await this.repositories.results.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(result.studentId)
      }
      case OwnerKind.Payment: {
        const payment = await this.repositories.payments.findById(ownerId)
        if (!payment) {
          denyResourceAccess()
        }
        const studentFee = await this.repositories.studentFees.findById(payment.studentFeeId)
        if (!studentFee) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(studentFee.studentId)
      }
      case OwnerKind.Other:
        throw new BusinessRuleViolationError('UNSUPPORTED_ATTACHMENT_OWNER', 'Attachment owner kind other is not supported by the selected public contract')
    }
  }

  private async resolveStudentOwner(studentId: string): Promise<{ schoolId: string, classGroupId?: string, studentId: string }> {
    const student = await this.repositories.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    const activeEnrollment = await this.repositories.enrollments.findOne({ studentId, status: StudentClassEnrollmentStatus.Active })
    return { schoolId: student.schoolId, classGroupId: activeEnrollment?.classGroupId, studentId: student.id }
  }
}
