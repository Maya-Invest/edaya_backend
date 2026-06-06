import type {
  AcademicPeriod,
  AcademicPeriodArgs,
  AcademicYear,
  AttachmentArgs,
  ClassGroupArgs,
  ResourceAssignmentArgs,
  School,
  SchoolArgs,
  StaffAssignment,
  StaffAssignmentArgs,
  StaffMember,
  StaffMemberArgs,
  StaffRole,
} from '../../entities'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, Permission } from '../../authorization'
import { ensureSystemAccessRolesForSchool } from '../../authorization/access-control/ensure-system-roles'
import { syncStaffSystemRoleAssignment } from '../../authorization/access-control/sync-staff-system-role-assignment'
import {
  AcademicPeriod as AcademicPeriodEntity,
  AcademicYear as AcademicYearEntity,
  Attachment,
  ClassGroup,
  ResourceAssignment,
  School as SchoolEntity,
  StaffAssignment as StaffAssignmentEntity,
  StaffMember as StaffMemberEntity,
} from '../../entities'
import { permissionAction } from '../../shared'
import { requireSchool } from '../../shared/require-school'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface CreateAcademicYearInput {
  id: string
  schoolId: string
  name: string
  startDate: Date
  endDate: Date
  createdAt?: Date
}

export interface ActivateAcademicYearInput {
  academicYearId: string
}

export type RegisterSchoolInput = SchoolArgs

export interface UpdateSchoolConfigurationInput extends Partial<Omit<SchoolArgs, 'id' | 'createdAt'>> {
  schoolId: string
}

export type CreateAcademicPeriodInput = AcademicPeriodArgs

export interface PublishAcademicPeriodInput {
  academicPeriodId: string
}

export type CreateClassGroupInput = ClassGroupArgs

export interface UpdateClassGroupConfigurationInput extends Partial<ClassGroupArgs> {
  classGroupId: string
}

export interface RegisterStaffMemberInput extends StaffMemberArgs {
  roles?: StaffRole[]
}

export interface UpdateStaffMemberStatusInput {
  staffId: string
  isActive: boolean
}

export type AssignStaffInput = StaffAssignmentArgs
export type AssignResourceInput = ResourceAssignmentArgs

export interface RemoveResourceAssignmentInput {
  resourceAssignmentId?: string
  id?: string
}

export type RegisterAttachmentInput = AttachmentArgs

export interface RemoveAttachmentInput {
  attachmentId?: string
  id?: string
}

export class SetupServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async registerSchool(input: RegisterSchoolInput): Promise<School> {
    await permissionAction(this.baseService.authorizationPolicy, Permission.PLATFORM_REGISTER_SCHOOL)(this.baseService.actor)
    const school = new SchoolEntity(input)
    await this.baseService.schools.save(school, { moduleChecked: true })
    await ensureSystemAccessRolesForSchool(school.id, this.baseService.repositories)
    return school
  }

  async updateSchoolConfiguration({ schoolId, ...changes }: UpdateSchoolConfigurationInput): Promise<School> {
    const existing = await this.requireEntity(this.baseService.schools, schoolId)
    await permissionAction(this.baseService.authorizationPolicy, Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)
    const school = new SchoolEntity({
      id: existing.id,
      name: changes.name ?? existing.name,
      timeZone: changes.timeZone ?? existing.timeZone,
      type: changes.type === undefined ? existing.type : changes.type,
      country: changes.country === undefined ? existing.country : changes.country,
      city: changes.city === undefined ? existing.city : changes.city,
      createdAt: existing.createdAt,
    })
    await this.baseService.schools.save(school, { moduleChecked: true })
    return school
  }

  async createAcademicYear({
    id,
    schoolId,
    name,
    startDate,
    endDate,
    createdAt,
  }: CreateAcademicYearInput): Promise<AcademicYear> {
    this.checkActorSchool(schoolId)
    await permissionAction(this.baseService.authorizationPolicy, Permission.SCHOOL_STRUCTURE_CONFIGURE)(this.baseService.actor)
    await requireSchool(this.baseService.repositories.schools, schoolId)

    return this.baseService.atomicExecution.execute(async () => {
      const academicYear = new AcademicYearEntity({
        id,
        schoolId,
        name,
        startDate,
        endDate,
        isActive: true,
        createdAt,
      })
      await this.deactivateOtherAcademicYears(schoolId, academicYear.id)
      await this.baseService.academicYears.save(academicYear, { moduleChecked: true })
      return academicYear
    })
  }

  async activateAcademicYear({ academicYearId }: ActivateAcademicYearInput): Promise<AcademicYear> {
    const academicYear = await this.baseService.repositories.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    this.checkActorSchool(academicYear.schoolId)
    await permissionAction(this.baseService.authorizationPolicy, Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)

    return this.baseService.atomicExecution.execute(async () => {
      await this.deactivateOtherAcademicYears(academicYear.schoolId, academicYear.id)
      const activated = new AcademicYearEntity({
        id: academicYear.id,
        schoolId: academicYear.schoolId,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: true,
        createdAt: academicYear.createdAt,
      })
      await this.baseService.academicYears.save(activated, { moduleChecked: true })
      return activated
    })
  }

  async createAcademicPeriod(input: CreateAcademicPeriodInput): Promise<AcademicPeriod> {
    const period = new AcademicPeriodEntity(input)
    await this.baseService.academicPeriods.save(period)
    return period
  }

  async publishAcademicPeriod({ academicPeriodId }: PublishAcademicPeriodInput): Promise<AcademicPeriod> {
    const existing = await this.requireEntity(this.baseService.academicPeriods, academicPeriodId)
    await permissionAction(this.baseService.authorizationPolicy, Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)
    const period = new AcademicPeriodEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      academicYearId: existing.academicYearId,
      name: existing.name,
      type: existing.type,
      startDate: existing.startDate,
      endDate: existing.endDate,
      isPublished: true,
      createdAt: existing.createdAt,
    })
    await this.baseService.academicPeriods.save(period, { moduleChecked: true })
    return period
  }

  async createClassGroup(input: CreateClassGroupInput): Promise<ClassGroup> {
    return this.saveConstructed(this.baseService.classGroups, new ClassGroup(input))
  }

  async updateClassGroupConfiguration({ classGroupId, ...changes }: UpdateClassGroupConfigurationInput): Promise<ClassGroup> {
    const existing = await this.requireEntity(this.baseService.classGroups, classGroupId)
    const classGroup = existing.copyWith(changes)
    await this.baseService.classGroups.save(classGroup)
    return classGroup
  }

  async registerStaffMember({ roles, ...staffMemberInput }: RegisterStaffMemberInput): Promise<StaffMember> {
    const staffMember = await this.saveConstructed(
      this.baseService.staffMembers,
      new StaffMemberEntity(staffMemberInput),
    )
    await syncStaffSystemRoleAssignment({
      staffMemberId: staffMember.id,
      schoolId: staffMember.schoolId,
      repositories: this.baseService.repositories,
      roleKeys: roles,
    })
    return staffMember
  }

  async updateStaffMemberStatus({ staffId, isActive }: UpdateStaffMemberStatusInput): Promise<StaffMember> {
    const existing = await this.requireEntity(this.baseService.staffMembers, staffId)
    const staffMember = await this.saveConstructed(this.baseService.staffMembers, new StaffMemberEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      subjectId: existing.subjectId,
      isActive,
      createdAt: existing.createdAt,
    }))
    await syncStaffSystemRoleAssignment({
      staffMemberId: staffMember.id,
      schoolId: staffMember.schoolId,
      repositories: this.baseService.repositories,
    })
    return staffMember
  }

  async assignStaffToClass(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.saveStaffAssignment(input)
  }

  async assignStaffToClassSubject(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.saveStaffAssignment(input)
  }

  async assignStaffToSession(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.saveStaffAssignment(input)
  }

  async assignResourceToClass(input: AssignResourceInput): Promise<ResourceAssignment> {
    return this.saveConstructed(this.baseService.resourceAssignments, new ResourceAssignment(input))
  }

  async assignResourceToSession(input: AssignResourceInput): Promise<ResourceAssignment> {
    return this.saveConstructed(this.baseService.resourceAssignments, new ResourceAssignment(input))
  }

  async removeResourceAssignment({ resourceAssignmentId, id }: RemoveResourceAssignmentInput): Promise<void> {
    await this.baseService.resourceAssignments.delete(resourceAssignmentId ?? id ?? '')
  }

  async registerAttachment(input: RegisterAttachmentInput): Promise<Attachment> {
    return this.saveConstructed(this.baseService.attachments, new Attachment(input))
  }

  async removeAttachment({ attachmentId, id }: RemoveAttachmentInput): Promise<void> {
    await this.baseService.attachments.delete(attachmentId ?? id ?? '')
  }

  private async deactivateOtherAcademicYears(schoolId: string, activeAcademicYearId: string): Promise<void> {
    const activeAcademicYears = await this.baseService.repositories.academicYears.list({ schoolId, isActive: true })
    for (const academicYear of activeAcademicYears) {
      if (academicYear.id === activeAcademicYearId) {
        continue
      }
      await this.baseService.academicYears.save(new AcademicYearEntity({
        id: academicYear.id,
        schoolId: academicYear.schoolId,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: false,
        createdAt: academicYear.createdAt,
      }), { moduleChecked: true })
    }
  }

  private async saveStaffAssignment(input: AssignStaffInput): Promise<StaffAssignment> {
    const assignment = await this.saveConstructed(this.baseService.staffAssignments, new StaffAssignmentEntity(input))
    const staffMember = await this.requireEntity(this.baseService.staffMembers, assignment.staffId)
    await syncStaffSystemRoleAssignment({
      staffMemberId: staffMember.id,
      schoolId: staffMember.schoolId,
      repositories: this.baseService.repositories,
    })
    return assignment
  }

  private async saveConstructed<T extends { id: string }>(
    managedService: { save: (entity: T, options?: { moduleChecked?: boolean }) => Promise<void> },
    entity: T,
  ): Promise<T> {
    await managedService.save(entity)
    return entity
  }

  private async requireEntity<T>(
    managedService: { findById: (id: string) => Promise<T | undefined> },
    id: string,
  ): Promise<T> {
    const entity = await managedService.findById(id)
    if (!entity) {
      denyResourceAccess()
    }
    return entity
  }
}
