import type { StaffRole } from '../../entities/school/staff-member'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import { GradeLevel } from '../../entities/school/grade-level'
import { School } from '../../entities/school/school'
import { StaffMember } from '../../entities/school/staff-member'
import { denyResourceAccess } from '../authorization'
import { AcademicCalendarService } from './academic-calendar'
import { ClassGroupService } from './class-group'
import { StaffAssignmentService } from './staff-assignment'

export interface SetupServiceArgs extends AuthorizedServiceArgs {
  repositories: SchoolRepositories
}

export class SetupService {
  private readonly schoolRepository: SchoolRepositories['setup']['schools']
  private readonly academicCalendar: AcademicCalendarService
  private readonly academicYears: SchoolRepositories['setup']['academicYears']
  private readonly gradeLevels: SchoolRepositories['setup']['gradeLevels']
  private readonly classGroups: ClassGroupService
  private readonly staffMembers: SchoolRepositories['setup']['staffMembers']
  private readonly staffAssignments: StaffAssignmentService
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly classGroupRepository: SchoolRepositories['academics']['classGroups']
  private readonly classSubjectRepository: SchoolRepositories['academics']['classSubjects']
  private readonly groupedSessionRepository: SchoolRepositories['scheduling']['groupedSessions']
  private readonly sessionRepository: SchoolRepositories['scheduling']['sessions']

  constructor(args: SetupServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.schoolRepository = args.repositories.setup.schools
    this.classGroupRepository = args.repositories.academics.classGroups
    this.classSubjectRepository = args.repositories.academics.classSubjects
    this.groupedSessionRepository = args.repositories.scheduling.groupedSessions
    this.sessionRepository = args.repositories.scheduling.sessions
    this.academicYears = args.repositories.setup.academicYears
    this.academicCalendar = new AcademicCalendarService({
      schoolRepository: args.repositories.setup.schools,
      academicYearRepository: args.repositories.setup.academicYears,
      academicPeriodRepository: args.repositories.setup.academicPeriods,
    })
    this.classGroups = new ClassGroupService({
      schoolRepository: args.repositories.setup.schools,
      academicYearRepository: args.repositories.setup.academicYears,
      gradeLevelRepository: args.repositories.setup.gradeLevels,
      classGroupRepository: args.repositories.academics.classGroups,
    })
    this.gradeLevels = args.repositories.setup.gradeLevels
    this.staffMembers = args.repositories.setup.staffMembers
    this.staffAssignments = new StaffAssignmentService({
      staffMemberRepository: args.repositories.setup.staffMembers,
      classGroupRepository: args.repositories.academics.classGroups,
      classSubjectRepository: args.repositories.academics.classSubjects,
      groupedSessionRepository: args.repositories.scheduling.groupedSessions,
      sessionRepository: args.repositories.scheduling.sessions,
      staffAssignmentRepository: args.repositories.setup.staffAssignments,
    })
  }

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
    await this.schoolRepository.save(school)
    return school
  }

  async createAcademicYear(input: Parameters<AcademicCalendarService['createAcademicYear']>[0]) {
    await this.authorize('setup.manage', input.schoolId)
    return this.academicCalendar.createAcademicYear(input)
  }

  async createAcademicPeriod(input: Parameters<AcademicCalendarService['createAcademicPeriod']>[0]) {
    await this.authorize('setup.manage', input.schoolId)
    await this.requireResourceInSchool(this.academicYears.findById(input.academicYearId), input.schoolId)
    return this.academicCalendar.createAcademicPeriod(input)
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
    if (!await this.schoolRepository.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    const gradeLevel = new GradeLevel({ id, schoolId, name, order, cycle, createdAt })
    await this.gradeLevels.save(gradeLevel)
    return gradeLevel
  }

  async createClassGroup(input: Parameters<ClassGroupService['createClassGroup']>[0]) {
    await this.authorize('setup.manage', input.schoolId)
    await Promise.all([
      this.requireResourceInSchool(this.academicYears.findById(input.academicYearId), input.schoolId),
      this.requireResourceInSchool(this.gradeLevels.findById(input.gradeLevelId), input.schoolId),
    ])
    return this.classGroups.createClassGroup(input)
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
    if (!await this.schoolRepository.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }

    const existing = await this.staffMembers.findById(id)
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
    await this.staffMembers.save(staffMember)
    return staffMember
  }

  async assignStaffToClass(input: Parameters<StaffAssignmentService['assignStaffToClass']>[0]) {
    const classGroup = await this.requireClassGroup(input.classGroupId)
    await this.authorize('setup.assign_staff', classGroup.schoolId, { classGroupId: classGroup.id })
    await this.requireStaffMemberInSchool(input.staffId, classGroup.schoolId)
    return this.staffAssignments.assignStaffToClass(input)
  }

  async assignStaffToClassSubject(input: Parameters<StaffAssignmentService['assignStaffToClassSubject']>[0]) {
    const classSubject = await this.classSubjectRepository.findById(input.classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorize('setup.assign_staff', classGroup.schoolId, {
      classGroupId: classGroup.id,
      classSubjectId: classSubject.id,
    })
    await this.requireStaffMemberInSchool(input.staffId, classGroup.schoolId)
    return this.staffAssignments.assignStaffToClassSubject(input)
  }

  async assignStaffToSession(input: Parameters<StaffAssignmentService['assignStaffToSession']>[0]) {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (!session) {
      denyResourceAccess()
    }
    const classGroup = await this.requireClassGroup(session.classGroupId)
    await this.authorize('setup.assign_staff', classGroup.schoolId, {
      classGroupId: classGroup.id,
      sessionId: session.id,
    })
    await this.requireStaffMemberInSchool(input.staffId, classGroup.schoolId)
    return this.staffAssignments.assignStaffToSession(input)
  }

  async assignStaffToGroupedSession(input: Parameters<StaffAssignmentService['assignStaffToGroupedSession']>[0]) {
    const groupedSession = await this.groupedSessionRepository.findById(input.groupedSessionId)
    if (!groupedSession) {
      denyResourceAccess()
    }
    await this.authorize('setup.assign_staff', groupedSession.schoolId)
    await this.requireStaffMemberInSchool(input.staffId, groupedSession.schoolId)
    return this.staffAssignments.assignStaffToGroupedSession(input)
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

  private async requireClassGroup(classGroupId: string) {
    const classGroup = await this.classGroupRepository.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async requireStaffMemberInSchool(staffId: string, schoolId: string): Promise<void> {
    const staffMember = await this.staffMembers.findById(staffId)
    if (!staffMember || staffMember.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireResourceInSchool(
    resourcePromise: Promise<{ schoolId: string } | undefined>,
    schoolId: string,
  ): Promise<void> {
    const resource = await resourcePromise
    if (!resource || resource.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }
}
