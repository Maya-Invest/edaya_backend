import type {
  AcademicPeriod,
  AcademicPeriodInput,
  AcademicYear,
  AttachmentInput,
  ClassGroupInput,
  ResourceAssignmentInput,
  School,
  SchoolInput,
  StaffAssignment,
  StaffAssignmentInput,
  StaffMember,
  StaffMemberInput,
} from '../../domains'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, Permission } from '../../authorization'
import {
  AcademicPeriod as AcademicPeriodEntity,
  AcademicYear as AcademicYearEntity,
  Attachment,
  ClassGroup,
  ResourceAssignment,
  School as SchoolEntity,
  StaffAssignment as StaffAssignmentEntity,
  StaffMember as StaffMemberEntity,
} from '../../domains'
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

export type RegisterSchoolInput = SchoolInput

export interface UpdateSchoolConfigurationInput extends Partial<Omit<SchoolInput, 'id' | 'createdAt'>> {
  schoolId: string
}

export type CreateAcademicPeriodInput = AcademicPeriodInput

export interface PublishAcademicPeriodInput {
  academicPeriodId: string
}

export type CreateClassGroupInput = ClassGroupInput

export interface UpdateClassGroupConfigurationInput extends Partial<ClassGroupInput> {
  classGroupId: string
}

export type RegisterStaffMemberInput = StaffMemberInput

export interface UpdateStaffMemberStatusInput {
  staffId: string
  isActive: boolean
}

export type AssignStaffInput = StaffAssignmentInput
export type AssignResourceInput = ResourceAssignmentInput

export interface RemoveResourceAssignmentInput {
  resourceAssignmentId?: string
  id?: string
}

export type RegisterAttachmentInput = AttachmentInput

export interface RemoveAttachmentInput {
  attachmentId?: string
  id?: string
}

export class SetupServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async registerSchool(input: RegisterSchoolInput): Promise<School> {
    await permissionAction(Permission.PLATFORM_REGISTER_SCHOOL)(this.baseService.actor)
    const school = new SchoolEntity(input)
    if (school.ownerSubjectId) {
      await this.validateOwnerSubject(school.id, school.ownerSubjectId)
    }
    await this.baseService.entities.schools.save(school, { moduleChecked: true })
    return school
  }

  async updateSchoolConfiguration({ schoolId, ...changes }: UpdateSchoolConfigurationInput): Promise<School> {
    const existing = await this.requireEntity(this.baseService.entities.schools, schoolId)
    await permissionAction(Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)
    const ownerSubjectId = changes.ownerSubjectId === undefined ? existing.ownerSubjectId : changes.ownerSubjectId
    if (ownerSubjectId !== existing.ownerSubjectId) {
      await this.validateOwnerTransfer(existing, ownerSubjectId)
    }
    const school = new SchoolEntity({
      id: existing.id,
      name: changes.name ?? existing.name,
      timeZone: changes.timeZone ?? existing.timeZone,
      ownerSubjectId,
      type: changes.type === undefined ? existing.type : changes.type,
      country: changes.country === undefined ? existing.country : changes.country,
      city: changes.city === undefined ? existing.city : changes.city,
      createdAt: existing.createdAt,
    })
    await this.baseService.entities.schools.save(school, { moduleChecked: true })
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
    await permissionAction(Permission.SCHOOL_STRUCTURE_CONFIGURE)(this.baseService.actor)
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
      await this.baseService.entities.academicYears.save(academicYear, { moduleChecked: true })
      return academicYear
    })
  }

  async activateAcademicYear({ academicYearId }: ActivateAcademicYearInput): Promise<AcademicYear> {
    const academicYear = await this.baseService.repositories.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    this.checkActorSchool(academicYear.schoolId)
    await permissionAction(Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)

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
      await this.baseService.entities.academicYears.save(activated, { moduleChecked: true })
      return activated
    })
  }

  async createAcademicPeriod(input: CreateAcademicPeriodInput): Promise<AcademicPeriod> {
    const period = new AcademicPeriodEntity(input)
    await this.baseService.entities.academicPeriods.save(period)
    return period
  }

  async publishAcademicPeriod({ academicPeriodId }: PublishAcademicPeriodInput): Promise<AcademicPeriod> {
    const existing = await this.requireEntity(this.baseService.entities.academicPeriods, academicPeriodId)
    await permissionAction(Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)
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
    await this.baseService.entities.academicPeriods.save(period, { moduleChecked: true })
    return period
  }

  async createClassGroup(input: CreateClassGroupInput): Promise<ClassGroup> {
    return this.saveConstructed(this.baseService.entities.classGroups, new ClassGroup(input))
  }

  async updateClassGroupConfiguration({ classGroupId, ...changes }: UpdateClassGroupConfigurationInput): Promise<ClassGroup> {
    const existing = await this.requireEntity(this.baseService.entities.classGroups, classGroupId)
    const classGroup = existing.copyWith(changes)
    await this.baseService.entities.classGroups.save(classGroup)
    return classGroup
  }

  async registerStaffMember(staffMemberInput: RegisterStaffMemberInput): Promise<StaffMember> {
    return this.saveConstructed(
      this.baseService.entities.staffMembers,
      new StaffMemberEntity(staffMemberInput),
    )
  }

  private async validateOwnerTransfer(existing: School, ownerSubjectId: string | null | undefined): Promise<void> {
    if (!ownerSubjectId) {
      denyResourceAccess()
    }

    const actor = this.baseService.actor
    const isCurrentOwner = actor.kind === 'staff' && actor.subjectId === existing.ownerSubjectId
    const canTransferOwner = actor.kind === 'system'
      || isCurrentOwner
      || (actor.kind === 'staff' && actor.effectiveGrants?.isElevated === true)

    if (existing.ownerSubjectId && !canTransferOwner) {
      denyResourceAccess()
    }

    await this.validateOwnerSubject(existing.id, ownerSubjectId)
  }

  private async validateOwnerSubject(schoolId: string, ownerSubjectId: string): Promise<void> {
    const ownedSchool = await this.baseService.repositories.schools.findOne({ ownerSubjectId })
    if (ownedSchool && ownedSchool.id !== schoolId) {
      denyResourceAccess()
    }
  }

  async updateStaffMemberStatus({ staffId, isActive }: UpdateStaffMemberStatusInput): Promise<StaffMember> {
    const existing = await this.requireEntity(this.baseService.entities.staffMembers, staffId)
    const staffMember = await this.saveConstructed(this.baseService.entities.staffMembers, new StaffMemberEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      subjectId: existing.subjectId,
      isActive,
      createdAt: existing.createdAt,
    }))
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
    return this.saveConstructed(this.baseService.entities.resourceAssignments, new ResourceAssignment(input))
  }

  async assignResourceToSession(input: AssignResourceInput): Promise<ResourceAssignment> {
    return this.saveConstructed(this.baseService.entities.resourceAssignments, new ResourceAssignment(input))
  }

  async removeResourceAssignment({ resourceAssignmentId, id }: RemoveResourceAssignmentInput): Promise<void> {
    await this.baseService.entities.resourceAssignments.delete(resourceAssignmentId ?? id ?? '')
  }

  async registerAttachment(input: RegisterAttachmentInput): Promise<Attachment> {
    return this.saveConstructed(this.baseService.entities.attachments, new Attachment(input))
  }

  async removeAttachment({ attachmentId, id }: RemoveAttachmentInput): Promise<void> {
    const existing = await this.requireEntity(this.baseService.entities.attachments, attachmentId ?? id ?? '')
    await this.baseService.entities.attachments.delete(existing.id)
  }

  private async deactivateOtherAcademicYears(schoolId: string, activeAcademicYearId: string): Promise<void> {
    const activeAcademicYears = await this.baseService.repositories.academicYears.list({ schoolId, isActive: true })
    for (const academicYear of activeAcademicYears) {
      if (academicYear.id === activeAcademicYearId) {
        continue
      }
      await this.baseService.entities.academicYears.save(new AcademicYearEntity({
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
    const assignment = await this.saveConstructed(this.baseService.entities.staffAssignments, new StaffAssignmentEntity(input))
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
