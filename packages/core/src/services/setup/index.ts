import type { StaffRole } from '../../entities/school/staff-member'
import type { AcademicPeriodRepository } from '../../ports/academic-period-repository'
import type { AcademicYearRepository } from '../../ports/academic-year-repository'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { ClassSubjectRepository } from '../../ports/class-subject-repository'
import type { GradeLevelRepository } from '../../ports/grade-level-repository'
import type { GroupedSessionRepository } from '../../ports/grouped-session-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { SessionRepository } from '../../ports/session-repository'
import type { StaffAssignmentRepository } from '../../ports/staff-assignment-repository'
import type { StaffMemberRepository } from '../../ports/staff-member-repository'
import type { AuthorizedServiceArgs } from '../authorization'
import { GradeLevel } from '../../entities/school/grade-level'
import { School } from '../../entities/school/school'
import { StaffMember } from '../../entities/school/staff-member'
import { denyResourceAccess } from '../authorization'
import { AcademicCalendarService } from './academic-calendar'
import { ClassGroupService } from './class-group'
import { StaffAssignmentService } from './staff-assignment'

export interface SetupServiceArgs extends AuthorizedServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  gradeLevelRepository: GradeLevelRepository
  classGroupRepository: ClassGroupRepository
  staffMemberRepository: StaffMemberRepository
  classSubjectRepository: ClassSubjectRepository
  groupedSessionRepository: GroupedSessionRepository
  sessionRepository: SessionRepository
  staffAssignmentRepository: StaffAssignmentRepository
}

export class SetupService {
  private readonly schoolRepository: SchoolRepository
  private readonly academicCalendar: AcademicCalendarService
  private readonly academicYears: AcademicYearRepository
  private readonly gradeLevels: GradeLevelRepository
  private readonly classGroups: ClassGroupService
  private readonly staffMembers: StaffMemberRepository
  private readonly staffAssignments: StaffAssignmentService
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly classGroupRepository: ClassGroupRepository
  private readonly classSubjectRepository: ClassSubjectRepository
  private readonly groupedSessionRepository: GroupedSessionRepository
  private readonly sessionRepository: SessionRepository

  constructor(args: SetupServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.schoolRepository = args.schoolRepository
    this.classGroupRepository = args.classGroupRepository
    this.classSubjectRepository = args.classSubjectRepository
    this.groupedSessionRepository = args.groupedSessionRepository
    this.sessionRepository = args.sessionRepository
    this.academicYears = args.academicYearRepository
    this.academicCalendar = new AcademicCalendarService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      academicPeriodRepository: args.academicPeriodRepository,
    })
    this.classGroups = new ClassGroupService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      gradeLevelRepository: args.gradeLevelRepository,
      classGroupRepository: args.classGroupRepository,
    })
    this.gradeLevels = args.gradeLevelRepository
    this.staffMembers = args.staffMemberRepository
    this.staffAssignments = new StaffAssignmentService({
      staffMemberRepository: args.staffMemberRepository,
      classGroupRepository: args.classGroupRepository,
      classSubjectRepository: args.classSubjectRepository,
      groupedSessionRepository: args.groupedSessionRepository,
      sessionRepository: args.sessionRepository,
      staffAssignmentRepository: args.staffAssignmentRepository,
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
