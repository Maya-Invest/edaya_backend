import type { ClassSubject } from '../../entities/academics/class-subject'
import type { Session } from '../../entities/scheduling/session'
import type { ClassGroup } from '../../entities/school/class-group'
import type { StaffMember, StaffRole } from '../../entities/school/staff-member'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { StaffAssignment } from '../../entities/school/staff-assignment'

export interface StaffAssignmentServiceArgs {
  staffMemberRepository: SchoolRepositories['staffMembers']
  classGroupRepository: SchoolRepositories['classGroups']
  classSubjectRepository: SchoolRepositories['classSubjects']
  sessionRepository: SchoolRepositories['sessions']
  staffAssignmentRepository: SchoolRepositories['staffAssignments']
}

export class StaffAssignmentService {
  constructor(args: StaffAssignmentServiceArgs) {
    this.staffMembers = args.staffMemberRepository
    this.classGroups = args.classGroupRepository
    this.classSubjects = args.classSubjectRepository
    this.sessions = args.sessionRepository
    this.staffAssignments = args.staffAssignmentRepository
  }

  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly sessions: SchoolRepositories['sessions']
  private readonly staffAssignments: SchoolRepositories['staffAssignments']

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
    const staffMember = await this.requireStaffMember(staffId)
    const classGroup = await this.requireClassGroup(classGroupId)
    if (staffMember.schoolId !== classGroup.schoolId) {
      throw new Error(`Staff member ${staffId} does not belong to school ${classGroup.schoolId}`)
    }
    const assignment = new StaffAssignment({ id, classGroupId, staffId, role, createdAt })
    await this.staffAssignments.save(assignment)
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
    const staffMember = await this.requireStaffMember(staffId)
    const classSubject = await this.requireClassSubject(classSubjectId)
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    if (staffMember.schoolId !== classGroup.schoolId) {
      throw new Error(`Staff member ${staffId} does not belong to school ${classGroup.schoolId}`)
    }
    const assignment = new StaffAssignment({ id, classSubjectId, staffId, role, createdAt })
    await this.staffAssignments.save(assignment)
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
    const staffMember = await this.requireStaffMember(staffId)
    const session = await this.requireSession(sessionId)
    const classGroup = await this.requireClassGroup(session.classGroupId)
    if (staffMember.schoolId !== classGroup.schoolId) {
      throw new Error(`Staff member ${staffId} does not belong to school ${classGroup.schoolId}`)
    }
    const assignment = new StaffAssignment({ id, sessionId, staffId, role, createdAt })
    await this.staffAssignments.save(assignment)
    return assignment
  }

  private async requireStaffMember(staffId: string): Promise<StaffMember> {
    const staffMember = await this.staffMembers.findById(staffId)
    if (!staffMember) {
      throw new Error(`Unknown staff member: ${staffId}`)
    }
    return staffMember
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }

  private async requireClassSubject(classSubjectId: string): Promise<ClassSubject> {
    const classSubject = await this.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      throw new Error(`Unknown class subject: ${classSubjectId}`)
    }
    return classSubject
  }

  private async requireSession(sessionId: string): Promise<Session> {
    const session = await this.sessions.findById(sessionId)
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`)
    }
    return session
  }
}
