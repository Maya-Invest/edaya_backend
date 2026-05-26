import type { AcademicPeriodType } from '../../entities/school/academic-period'
import type { StaffRole } from '../../entities/school/staff-member'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { AcademicPeriod } from '../../entities/school/academic-period'
import { AcademicYear } from '../../entities/school/academic-year'
import { ClassGroup } from '../../entities/school/class-group'
import { GradeLevel } from '../../entities/school/grade-level'
import { School } from '../../entities/school/school'
import { StaffAssignment } from '../../entities/school/staff-assignment'
import { StaffMember } from '../../entities/school/staff-member'
import { denyResourceAccess } from '../authorization'

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
    country,
    city,
    createdAt,
  }: {
    id: string
    name: string
    country?: string
    city?: string
    createdAt?: Date
  }): Promise<School> {
    await this.authorize('setup.register_school', id)
    const school = new School({ id, name, country, city, createdAt })
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
    await this.requireSchool(schoolId)
    const academicYear = new AcademicYear({ id, schoolId, name, startDate, endDate, isActive, createdAt })
    await this.repositories.academicYears.save(academicYear)
    return academicYear
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
    await this.requireSchool(schoolId)
    const academicYear = await this.requireResourceInSchool(
      this.repositories.academicYears.findById(academicYearId),
      schoolId,
    )
    if (startDate.getTime() < academicYear.startDate.getTime() || endDate.getTime() > academicYear.endDate.getTime()) {
      throw new Error(`Academic period ${id} must fit within academic year ${academicYearId}`)
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
    await this.requireSchool(schoolId)
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
    createdAt,
  }: {
    id: string
    schoolId: string
    academicYearId: string
    gradeLevelId: string
    name: string
    createdAt?: Date
  }): Promise<ClassGroup> {
    await this.authorize('setup.manage', schoolId)
    await this.requireSchool(schoolId)
    await Promise.all([
      this.requireResourceInSchool(this.repositories.academicYears.findById(academicYearId), schoolId),
      this.requireResourceInSchool(this.repositories.gradeLevels.findById(gradeLevelId), schoolId),
    ])
    const classGroup = new ClassGroup({ id, schoolId, academicYearId, gradeLevelId, name, createdAt })
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
    await this.requireSchool(schoolId)

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

  async assignStaffToGroupedSession({
    id,
    staffId,
    groupedSessionId,
    role,
    createdAt,
  }: {
    id: string
    staffId: string
    groupedSessionId: string
    role: StaffRole
    createdAt?: Date
  }): Promise<StaffAssignment> {
    const groupedSession = await this.repositories.groupedSessions.findById(groupedSessionId)
    if (!groupedSession) {
      denyResourceAccess()
    }
    await this.authorize('setup.assign_staff', groupedSession.schoolId)
    await this.requireStaffMemberInSchool(staffId, groupedSession.schoolId)
    const assignment = new StaffAssignment({ id, groupedSessionId, staffId, role, createdAt })
    await this.repositories.staffAssignments.save(assignment)
    return assignment
  }

  private async authorize(
    action: 'setup.register_school' | 'setup.manage' | 'setup.assign_staff',
    schoolId: string,
    resource: { classGroupId?: string, classSubjectId?: string, sessionId?: string } = {},
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, {
      action,
      resource: { schoolId, ...resource },
    })
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.repositories.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
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
}
