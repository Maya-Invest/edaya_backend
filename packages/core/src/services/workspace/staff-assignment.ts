import type { Classroom } from '$lib/core/entities/classroom'
import type { Module } from '$lib/core/entities/module'
import type { StaffMember, StaffRole } from '$lib/core/entities/staff-member'
import type { ClassStaffAssignmentRepository } from '$lib/core/ports/class-staff-assignment-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { ModuleStaffAssignmentRepository } from '$lib/core/ports/module-staff-assignment-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import { ClassStaffAssignment } from '$lib/core/entities/class-staff-assignment'
import { ModuleStaffAssignment } from '$lib/core/entities/module-staff-assignment'

export interface StaffAssignmentServiceArgs {
  staffMemberRepository: StaffMemberRepository
  classroomRepository: ClassroomRepository
  moduleRepository: ModuleRepository
  classStaffAssignmentRepository: ClassStaffAssignmentRepository
  moduleStaffAssignmentRepository: ModuleStaffAssignmentRepository
}

export class StaffAssignmentService {
  constructor(args: StaffAssignmentServiceArgs) {
    this.staffMembers = args.staffMemberRepository
    this.classrooms = args.classroomRepository
    this.modules = args.moduleRepository
    this.classStaffAssignments = args.classStaffAssignmentRepository
    this.moduleStaffAssignments = args.moduleStaffAssignmentRepository
  }

  private readonly staffMembers: StaffMemberRepository
  private readonly classrooms: ClassroomRepository
  private readonly modules: ModuleRepository
  private readonly classStaffAssignments: ClassStaffAssignmentRepository
  private readonly moduleStaffAssignments: ModuleStaffAssignmentRepository

  async assignStaffToClass({
    id,
    staffId,
    classroomId,
    role,
    createdAt,
  }: {
    id: string
    staffId: string
    classroomId: string
    role: StaffRole
    createdAt?: Date
  }): Promise<ClassStaffAssignment> {
    const staffMember = await this.requireStaffMember(staffId)
    const classroom = await this.requireClassroom(classroomId)
    if (staffMember.schoolId !== classroom.schoolId) {
      throw new Error(`Staff member ${staffId} does not belong to school ${classroom.schoolId}`)
    }
    const assignment = new ClassStaffAssignment({ id, classroomId, staffId, role, createdAt })
    await this.classStaffAssignments.save(assignment)
    return assignment
  }

  async assignStaffToModule({
    id,
    staffId,
    moduleId,
    role,
    createdAt,
  }: {
    id: string
    staffId: string
    moduleId: string
    role: StaffRole
    createdAt?: Date
  }): Promise<ModuleStaffAssignment> {
    const staffMember = await this.requireStaffMember(staffId)
    const module = await this.requireModule(moduleId)
    const classroom = await this.requireClassroom(module.classroomId)
    if (staffMember.schoolId !== classroom.schoolId) {
      throw new Error(`Staff member ${staffId} does not belong to school ${classroom.schoolId}`)
    }
    const assignment = new ModuleStaffAssignment({ id, moduleId, staffId, role, createdAt })
    await this.moduleStaffAssignments.save(assignment)
    return assignment
  }

  private async requireStaffMember(staffId: string): Promise<StaffMember> {
    const staffMember = await this.staffMembers.findById(staffId)
    if (!staffMember) {
      throw new Error(`Unknown staff member: ${staffId}`)
    }
    return staffMember
  }

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
  }

  private async requireModule(moduleId: string): Promise<Module> {
    const module = await this.modules.findById(moduleId)
    if (!module) {
      throw new Error(`Unknown module: ${moduleId}`)
    }
    return module
  }
}
