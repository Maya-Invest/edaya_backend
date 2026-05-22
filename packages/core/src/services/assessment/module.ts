import type { ModuleNodeKind } from '$lib/core/entities/academics/module'
import type { Subject } from '$lib/core/entities/academics/subject'
import type { Classroom } from '$lib/core/entities/core/classroom'
import type { StaffMember } from '$lib/core/entities/core/staff-member'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { ModuleStaffAssignmentRepository } from '$lib/core/ports/module-staff-assignment-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import type { SubjectRepository } from '$lib/core/ports/subject-repository'
import { Module } from '$lib/core/entities/academics/module'
import { ModuleStaffAssignment } from '$lib/core/entities/administration/module-staff-assignment'
import { StaffRole } from '$lib/core/entities/core/staff-member'

export interface ModuleServiceArgs {
  classroomRepository: ClassroomRepository
  subjectRepository: SubjectRepository
  staffMemberRepository: StaffMemberRepository
  moduleRepository: ModuleRepository
  moduleStaffAssignmentRepository: ModuleStaffAssignmentRepository
}

export class ModuleService {
  constructor(args: ModuleServiceArgs) {
    this.classrooms = args.classroomRepository
    this.subjects = args.subjectRepository
    this.staffMembers = args.staffMemberRepository
    this.modules = args.moduleRepository
    this.moduleStaffAssignments = args.moduleStaffAssignmentRepository
  }

  private readonly classrooms: ClassroomRepository
  private readonly subjects: SubjectRepository
  private readonly staffMembers: StaffMemberRepository
  private readonly modules: ModuleRepository
  private readonly moduleStaffAssignments: ModuleStaffAssignmentRepository

  async createModule({
    id,
    classroomId,
    kind,
    name,
    weight,
    parentModuleId,
    subjectId,
    staffId,
    createdAt,
  }: {
    id: string
    classroomId: string
    kind: ModuleNodeKind
    name?: string
    weight: number
    parentModuleId?: string
    subjectId?: string
    staffId?: string
    createdAt?: Date
  }): Promise<Module> {
    const classroom = await this.requireClassroom(classroomId)
    if (parentModuleId) {
      const parent = await this.modules.findById(parentModuleId)
      if (!parent) {
        throw new Error(`Unknown parent module: ${parentModuleId}`)
      }
      if (parent.classroomId !== classroomId) {
        throw new Error('Parent module must belong to the same classroom')
      }
    }
    if (subjectId) {
      const subject = await this.requireSubject(subjectId)
      if (subject.schoolId !== classroom.schoolId) {
        throw new Error(`Subject ${subjectId} does not belong to the same school as classroom ${classroomId}`)
      }
    }
    if (staffId) {
      const staffMember = await this.requireStaffMember(staffId)
      if (staffMember.schoolId !== classroom.schoolId) {
        throw new Error(`Staff member ${staffId} does not belong to the same school as classroom ${classroomId}`)
      }
    }

    const module = new Module({
      id,
      classroomId,
      kind,
      name,
      weight,
      parentModuleId,
      subjectId,
      staffId,
      createdAt,
    })
    await this.modules.save(module)
    if (staffId) {
      await this.moduleStaffAssignments.save(
        new ModuleStaffAssignment({
          id: `staff-assignment-module-${staffId}-${id}`,
          staffId,
          role: StaffRole.Teacher,
          moduleId: id,
          createdAt,
        }),
      )
    }
    return module
  }

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
  }

  private async requireSubject(subjectId: string): Promise<Subject> {
    const subject = await this.subjects.findById(subjectId)
    if (!subject) {
      throw new Error(`Unknown subject: ${subjectId}`)
    }
    return subject
  }

  private async requireStaffMember(staffId: string): Promise<StaffMember> {
    const staffMember = await this.staffMembers.findById(staffId)
    if (!staffMember) {
      throw new Error(`Unknown staff member: ${staffId}`)
    }
    return staffMember
  }
}
