import type { ClassSubject } from '$lib/core/entities/academics/class-subject'
import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { StaffMember, StaffRole } from '$lib/core/entities/core/staff-member'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { ClassStaffAssignmentRepository } from '$lib/core/ports/class-staff-assignment-repository'
import type { ClassSubjectRepository } from '$lib/core/ports/class-subject-repository'
import type { ClassSubjectStaffAssignmentRepository } from '$lib/core/ports/class-subject-staff-assignment-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import { StaffAssignment } from '$lib/core/entities/administration/staff-assignment'

export interface StaffAssignmentServiceArgs {
  staffMemberRepository: StaffMemberRepository
  classGroupRepository: ClassGroupRepository
  classSubjectRepository: ClassSubjectRepository
  classStaffAssignmentRepository: ClassStaffAssignmentRepository
  classSubjectStaffAssignmentRepository: ClassSubjectStaffAssignmentRepository
}

export class StaffAssignmentService {
  constructor(args: StaffAssignmentServiceArgs) {
    this.staffMembers = args.staffMemberRepository
    this.classGroups = args.classGroupRepository
    this.classSubjects = args.classSubjectRepository
    this.classStaffAssignments = args.classStaffAssignmentRepository
    this.classSubjectStaffAssignments = args.classSubjectStaffAssignmentRepository
  }

  private readonly staffMembers: StaffMemberRepository
  private readonly classGroups: ClassGroupRepository
  private readonly classSubjects: ClassSubjectRepository
  private readonly classStaffAssignments: ClassStaffAssignmentRepository
  private readonly classSubjectStaffAssignments: ClassSubjectStaffAssignmentRepository

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
    await this.classStaffAssignments.save(assignment)
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
    await this.classSubjectStaffAssignments.save(assignment)
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
}
