import type { ClassSubject } from '$lib/core/entities/academics/class-subject'
import type { GroupedSession } from '$lib/core/entities/scheduling/grouped-session'
import type { Session } from '$lib/core/entities/scheduling/session'
import type { ClassGroup } from '$lib/core/entities/school/class-group'
import type { StaffMember, StaffRole } from '$lib/core/entities/school/staff-member'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { ClassSubjectRepository } from '$lib/core/ports/class-subject-repository'
import type { GroupedSessionRepository } from '$lib/core/ports/grouped-session-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import type { StaffAssignmentRepository } from '$lib/core/ports/staff-assignment-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import { StaffAssignment } from '$lib/core/entities/school/staff-assignment'

export interface StaffAssignmentServiceArgs {
  staffMemberRepository: StaffMemberRepository
  classGroupRepository: ClassGroupRepository
  classSubjectRepository: ClassSubjectRepository
  groupedSessionRepository: GroupedSessionRepository
  sessionRepository: SessionRepository
  staffAssignmentRepository: StaffAssignmentRepository
}

export class StaffAssignmentService {
  constructor(args: StaffAssignmentServiceArgs) {
    this.staffMembers = args.staffMemberRepository
    this.classGroups = args.classGroupRepository
    this.classSubjects = args.classSubjectRepository
    this.groupedSessions = args.groupedSessionRepository
    this.sessions = args.sessionRepository
    this.staffAssignments = args.staffAssignmentRepository
  }

  private readonly staffMembers: StaffMemberRepository
  private readonly classGroups: ClassGroupRepository
  private readonly classSubjects: ClassSubjectRepository
  private readonly groupedSessions: GroupedSessionRepository
  private readonly sessions: SessionRepository
  private readonly staffAssignments: StaffAssignmentRepository

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
    const staffMember = await this.requireStaffMember(staffId)
    const groupedSession = await this.requireGroupedSession(groupedSessionId)
    if (staffMember.schoolId !== groupedSession.schoolId) {
      throw new Error(`Staff member ${staffId} does not belong to school ${groupedSession.schoolId}`)
    }
    const assignment = new StaffAssignment({ id, groupedSessionId, staffId, role, createdAt })
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

  private async requireGroupedSession(groupedSessionId: string): Promise<GroupedSession> {
    const session = await this.groupedSessions.findById(groupedSessionId)
    if (!session) {
      throw new Error(`Unknown grouped session: ${groupedSessionId}`)
    }
    return session
  }
}
