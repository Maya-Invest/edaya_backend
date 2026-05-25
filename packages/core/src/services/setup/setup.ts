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
import { GradeLevel } from '../../entities/school/grade-level'
import { AcademicCalendarService } from '../workspace/academic-calendar'
import { ClassGroupService } from '../workspace/class-group'
import { SchoolService } from '../workspace/school'
import { StaffService } from '../workspace/staff'
import { StaffAssignmentService } from '../workspace/staff-assignment'

export interface SetupServiceArgs {
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
  private readonly schools: SchoolService
  private readonly schoolRepository: SchoolRepository
  private readonly academicCalendar: AcademicCalendarService
  private readonly gradeLevels: GradeLevelRepository
  private readonly classGroups: ClassGroupService
  private readonly staff: StaffService
  private readonly staffAssignments: StaffAssignmentService

  constructor(args: SetupServiceArgs) {
    this.schools = new SchoolService({ schoolRepository: args.schoolRepository })
    this.schoolRepository = args.schoolRepository
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
    this.staff = new StaffService({
      schoolRepository: args.schoolRepository,
      staffMemberRepository: args.staffMemberRepository,
    })
    this.staffAssignments = new StaffAssignmentService({
      staffMemberRepository: args.staffMemberRepository,
      classGroupRepository: args.classGroupRepository,
      classSubjectRepository: args.classSubjectRepository,
      groupedSessionRepository: args.groupedSessionRepository,
      sessionRepository: args.sessionRepository,
      staffAssignmentRepository: args.staffAssignmentRepository,
    })
  }

  registerSchool(input: Parameters<SchoolService['registerSchool']>[0]) {
    return this.schools.registerSchool(input)
  }

  createAcademicYear(input: Parameters<AcademicCalendarService['createAcademicYear']>[0]) {
    return this.academicCalendar.createAcademicYear(input)
  }

  createAcademicPeriod(input: Parameters<AcademicCalendarService['createAcademicPeriod']>[0]) {
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
    if (!await this.schoolRepository.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    const gradeLevel = new GradeLevel({ id, schoolId, name, order, cycle, createdAt })
    await this.gradeLevels.save(gradeLevel)
    return gradeLevel
  }

  createClassGroup(input: Parameters<ClassGroupService['createClassGroup']>[0]) {
    return this.classGroups.createClassGroup(input)
  }

  registerStaffMember(input: Parameters<StaffService['registerStaffMember']>[0]) {
    return this.staff.registerStaffMember(input)
  }

  assignStaffToClass(input: Parameters<StaffAssignmentService['assignStaffToClass']>[0]) {
    return this.staffAssignments.assignStaffToClass(input)
  }

  assignStaffToClassSubject(input: Parameters<StaffAssignmentService['assignStaffToClassSubject']>[0]) {
    return this.staffAssignments.assignStaffToClassSubject(input)
  }

  assignStaffToSession(input: Parameters<StaffAssignmentService['assignStaffToSession']>[0]) {
    return this.staffAssignments.assignStaffToSession(input)
  }

  assignStaffToGroupedSession(input: Parameters<StaffAssignmentService['assignStaffToGroupedSession']>[0]) {
    return this.staffAssignments.assignStaffToGroupedSession(input)
  }
}
