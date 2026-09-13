import type { AcademicPeriod, AcademicPeriodInput, AcademicYear, Activity, ActivityEnrollment, ActivityEnrollmentInput, ActivityInput, AttachmentInput, ClassGroupInput, GradeLevel, GradeLevelInput, PeriodDefinition, PeriodDefinitionInput, Resource, ResourceAssignmentInput, ResourceInput, School, SchoolInput, StaffAssignment, StaffAssignmentInput, StaffMember, StaffMemberInput, StaffProfileRole } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { SetupWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { denyResourceAccess } from '@edaya/authorization'
import { AcademicPeriod as AcademicPeriodEntity, AcademicYear as AcademicYearEntity, AccountInvitationKind, ActivityEnrollment as ActivityEnrollmentEntity, Activity as ActivityEntity, Attachment, AttachmentStatus, BusinessRuleViolationError, ClassGroup, GradeLevel as GradeLevelEntity, PeriodDefinition as PeriodDefinitionEntity, ResourceAssignment, Resource as ResourceEntity, School as SchoolEntity, StaffAssignment as StaffAssignmentEntity, StaffMember as StaffMemberEntity } from '@edaya/core'
import { scheduleAccountInvitationIfEligible } from '../../capabilities/invitations'
import { seedSchoolNotificationTemplates } from '../../capabilities/notifications/templates/seed-school-notification-templates'

import { requireSchool } from '../require-school'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'
import { syncGradeLevelSubjectsToClassGroup } from './grade-level-subject-sync'

export interface CreateAcademicYearInput {
  id: string
  schoolId: string
  name: string
  startDate: Date
  endDate: Date
  createdAt?: Date
}

export interface PublishAcademicYearInput {
  academicYearId: string
}

export interface ArchiveAcademicYearInput {
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

export type RegisterStaffMemberInput = StaffMemberInput & {
  sendAccountInvitation?: boolean
}

export interface UpdateStaffMemberStatusInput {
  staffId: string
  isActive: boolean
}

export interface UpdateStaffMemberProfileInput {
  staffId: string
  firstName?: string
  lastName?: string
  code?: string | null
  email?: string | null
  photoUrl?: string | null
  profileRole?: StaffProfileRole | null
}

export type AssignStaffInput = StaffAssignmentInput
export type AssignResourceInput = ResourceAssignmentInput

export interface RemoveResourceAssignmentInput {
  resourceAssignmentId?: string
  id?: string
}

export type RegisterAttachmentInput = AttachmentInput

export type ConfigureGradeLevelInput = GradeLevelInput
export type ConfigurePeriodDefinitionInput = PeriodDefinitionInput & { schoolId?: string }
export type ConfigureResourceInput = ResourceInput & { schoolId?: string }
export type ConfigureActivityInput = ActivityInput & { schoolId?: string }
export type EnrollStudentInActivityInput = ActivityEnrollmentInput

export interface RemoveAttachmentInput {
  attachmentId?: string
  id?: string
}

export class SetupServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: SetupWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('setup', base.repositories)
  }

  async registerSchool(input: RegisterSchoolInput): Promise<School> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.school.assertRegister()
      const { consortiumId: _ignoredConsortiumId, ...schoolInput } = input
      const school = new SchoolEntity(schoolInput)
      await this.baseService.entities.schools.save(school)
      await seedSchoolNotificationTemplates(this.baseService.repositories, school.id)
      return school
    })
  }

  async updateSchoolConfiguration({ schoolId, ...changes }: UpdateSchoolConfigurationInput): Promise<School> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.schools, schoolId)
      await this.baseService.access.school.assertManageLifecycle()
      const ownerSubjectId = changes.ownerSubjectId === undefined ? existing.ownerSubjectId : changes.ownerSubjectId
      const school = new SchoolEntity({
        id: existing.id,
        name: changes.name ?? existing.name,
        timeZone: changes.timeZone ?? existing.timeZone,
        ownerSubjectId,
        consortiumId: existing.consortiumId,
        pendingOwnerStaffId: changes.pendingOwnerStaffId === undefined
          ? existing.pendingOwnerStaffId
          : changes.pendingOwnerStaffId,
        type: changes.type === undefined ? existing.type : changes.type,
        country: changes.country === undefined ? existing.country : changes.country,
        city: changes.city === undefined ? existing.city : changes.city,
        enforceScheduleConflicts: changes.enforceScheduleConflicts ?? existing.enforceScheduleConflicts,
        timetableEnforceWorkloadFulfillment: changes.timetableEnforceWorkloadFulfillment ?? existing.timetableEnforceWorkloadFulfillment,
        timetableExcludeBreakSlots: changes.timetableExcludeBreakSlots ?? existing.timetableExcludeBreakSlots,
        timetableMinDayGapSameSubject: changes.timetableMinDayGapSameSubject ?? existing.timetableMinDayGapSameSubject,
        timetablePreferredPeriodDefinitionIds: changes.timetablePreferredPeriodDefinitionIds ?? existing.timetablePreferredPeriodDefinitionIds,
        timetableAllowUnassignedTeacherPlacements: changes.timetableAllowUnassignedTeacherPlacements ?? existing.timetableAllowUnassignedTeacherPlacements,
        timetableUseHomeroomTeacherFallback: changes.timetableUseHomeroomTeacherFallback ?? existing.timetableUseHomeroomTeacherFallback,
        timetableGenerationMode: changes.timetableGenerationMode ?? existing.timetableGenerationMode,
        timetableMinPeriodSpan: changes.timetableMinPeriodSpan ?? existing.timetableMinPeriodSpan,
        timetableMaxPeriodSpan: changes.timetableMaxPeriodSpan ?? existing.timetableMaxPeriodSpan,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.schools.save(school)
      return school
    })
  }

  async createAcademicYear({
    id,
    schoolId,
    name,
    startDate,
    endDate,
    createdAt,
  }: CreateAcademicYearInput): Promise<AcademicYear> {
    return this.baseService.atomicExecution.execute(async () => {
      this.checkActorSchool(schoolId)
      await this.baseService.access.school.assertConfigureStructure()
      await requireSchool(this.repositories.schools, schoolId)

      return this.baseService.atomicExecution.execute(async () => {
        const academicYear = new AcademicYearEntity({
          id,
          schoolId,
          name,
          startDate,
          endDate,
          status: 'draft',
          createdAt,
        })
        await this.baseService.entities.academicYears.save(academicYear)
        return academicYear
      })
    })
  }

  async publishAcademicYear({ academicYearId }: PublishAcademicYearInput): Promise<AcademicYear> {
    return this.baseService.atomicExecution.execute(async () => {
      const academicYear = await this.repositories.academicYears.findById(academicYearId)
      if (!academicYear) {
        denyResourceAccess()
      }
      this.checkActorSchool(academicYear.schoolId)
      await this.baseService.access.school.assertManageLifecycle()

      if (academicYear.status !== 'draft') {
        throw new BusinessRuleViolationError(
          'ACADEMIC_YEAR_NOT_DRAFT',
          `Academic year ${academicYearId} must be draft to publish`,
        )
      }

      return this.baseService.atomicExecution.execute(async () => {
        const publishedYears = await this.repositories.academicYears.list({
          schoolId: academicYear.schoolId,
          status: 'published',
        })
        if (publishedYears.length > 0) {
          throw new BusinessRuleViolationError(
            'ACADEMIC_YEAR_ALREADY_PUBLISHED',
            'Another academic year is already published. Archive it before publishing a new one.',
          )
        }

        const published = new AcademicYearEntity({
          id: academicYear.id,
          schoolId: academicYear.schoolId,
          name: academicYear.name,
          startDate: academicYear.startDate,
          endDate: academicYear.endDate,
          status: 'published',
          createdAt: academicYear.createdAt,
        })
        await this.baseService.entities.academicYears.save(published)
        return published
      })
    })
  }

  async archiveAcademicYear({ academicYearId }: ArchiveAcademicYearInput): Promise<AcademicYear> {
    return this.baseService.atomicExecution.execute(async () => {
      const academicYear = await this.repositories.academicYears.findById(academicYearId)
      if (!academicYear) {
        denyResourceAccess()
      }
      this.checkActorSchool(academicYear.schoolId)
      await this.baseService.access.school.assertManageLifecycle()

      if (academicYear.status !== 'published') {
        throw new BusinessRuleViolationError(
          'ACADEMIC_YEAR_NOT_PUBLISHED',
          `Academic year ${academicYearId} must be published to archive`,
        )
      }

      return this.baseService.atomicExecution.execute(async () => {
        const archived = new AcademicYearEntity({
          id: academicYear.id,
          schoolId: academicYear.schoolId,
          name: academicYear.name,
          startDate: academicYear.startDate,
          endDate: academicYear.endDate,
          status: 'archived',
          createdAt: academicYear.createdAt,
        })
        await this.baseService.entities.academicYears.save(archived)
        return archived
      })
    })
  }

  async createAcademicPeriod(input: CreateAcademicPeriodInput): Promise<AcademicPeriod> {
    return this.baseService.atomicExecution.execute(async () => {
      const period = new AcademicPeriodEntity(input)
      await this.baseService.entities.academicPeriods.save(period)
      return period
    })
  }

  async publishAcademicPeriod({ academicPeriodId }: PublishAcademicPeriodInput): Promise<AcademicPeriod> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.academicPeriods, academicPeriodId)
      await this.baseService.access.school.assertManageLifecycle()
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
      await this.baseService.entities.academicPeriods.save(period)
      return period
    })
  }

  async createClassGroup(input: CreateClassGroupInput): Promise<ClassGroup> {
    return this.baseService.atomicExecution.execute(async () => {
      const classGroup = await this.saveConstructed(this.baseService.entities.classGroups, new ClassGroup(input))
      await this.baseService.atomicExecution.execute(async () => {
        await syncGradeLevelSubjectsToClassGroup(this.baseService, classGroup)
      })
      return classGroup
    })
  }

  async updateClassGroupConfiguration({ classGroupId, ...changes }: UpdateClassGroupConfigurationInput): Promise<ClassGroup> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.classGroups, classGroupId)
      const classGroup = existing.copyWith(changes)
      await this.baseService.entities.classGroups.save(classGroup)
      return classGroup
    })
  }

  async registerStaffMember(staffMemberInput: RegisterStaffMemberInput): Promise<StaffMember> {
    return this.baseService.atomicExecution.execute(async () => {
      const { sendAccountInvitation, ...entityInput } = staffMemberInput
      const staffMember = await this.saveConstructed(
        this.baseService.entities.staffMembers,
        new StaffMemberEntity(entityInput),
      )

      await scheduleAccountInvitationIfEligible(
        this.baseService,
        {
          kind: AccountInvitationKind.Staff,
          targetId: staffMember.id,
          sendAccountInvitation,
        },
        staffMember,
      )
      return staffMember
    })
  }

  async updateStaffMemberStatus({ staffId, isActive }: UpdateStaffMemberStatusInput): Promise<StaffMember> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.staffMembers, staffId)
      const staffMember = await this.saveConstructed(this.baseService.entities.staffMembers, new StaffMemberEntity({
        id: existing.id,
        schoolId: existing.schoolId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        code: existing.code,
        email: existing.email,
        photoUrl: existing.photoUrl,
        notificationEmail: existing.notificationEmail,
        notificationPhone: existing.notificationPhone,
        subjectId: existing.subjectId,
        accountKind: existing.accountKind,
        serviceId: existing.serviceId,
        createdBySubjectId: existing.createdBySubjectId,
        serviceElevated: existing.serviceElevated,
        isActive,
        profileRole: existing.profileRole,
        onboardingWizardCompletedAt: existing.onboardingWizardCompletedAt,
        onboardingMaxReachedStep: existing.onboardingMaxReachedStep,
        createdAt: existing.createdAt,
      }))
      return staffMember
    })
  }

  async updateStaffMemberProfile({ staffId, ...changes }: UpdateStaffMemberProfileInput): Promise<StaffMember> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.staffMembers, staffId)
      const staffMember = await this.saveConstructed(this.baseService.entities.staffMembers, new StaffMemberEntity({
        id: existing.id,
        schoolId: existing.schoolId,
        firstName: changes.firstName ?? existing.firstName,
        lastName: changes.lastName ?? existing.lastName,
        code: changes.code === undefined ? existing.code : (changes.code ?? undefined),
        email: changes.email === undefined ? existing.email : (changes.email ?? undefined),
        photoUrl: changes.photoUrl === undefined ? existing.photoUrl : (changes.photoUrl ?? undefined),
        notificationEmail: existing.notificationEmail,
        notificationPhone: existing.notificationPhone,
        subjectId: existing.subjectId,
        accountKind: existing.accountKind,
        serviceId: existing.serviceId,
        createdBySubjectId: existing.createdBySubjectId,
        serviceElevated: existing.serviceElevated,
        isActive: existing.isActive,
        profileRole: changes.profileRole === undefined ? existing.profileRole : (changes.profileRole ?? undefined),
        onboardingWizardCompletedAt: existing.onboardingWizardCompletedAt,
        onboardingMaxReachedStep: existing.onboardingMaxReachedStep,
        createdAt: existing.createdAt,
      }))
      return staffMember
    })
  }

  async configureGradeLevel(input: GradeLevelInput): Promise<GradeLevel> {
    return this.baseService.atomicExecution.execute(async () => {
      this.checkActorSchool(input.schoolId)
      return this.saveConstructed(this.baseService.entities.gradeLevels, new GradeLevelEntity(input))
    })
  }

  async configurePeriodDefinition(input: PeriodDefinitionInput & { schoolId?: string }): Promise<PeriodDefinition> {
    return this.baseService.atomicExecution.execute(async () => {
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      return this.saveConstructed(
        this.baseService.entities.periodDefinitions,
        new PeriodDefinitionEntity({ ...input, schoolId }),
      )
    })
  }

  async configureResource(input: ResourceInput & { schoolId?: string }): Promise<Resource> {
    return this.baseService.atomicExecution.execute(async () => {
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      return this.saveConstructed(
        this.baseService.entities.resources,
        new ResourceEntity({ ...input, schoolId }),
      )
    })
  }

  async configureActivity(input: ActivityInput & { schoolId?: string }): Promise<Activity> {
    return this.baseService.atomicExecution.execute(async () => {
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      return this.saveConstructed(
        this.baseService.entities.activities,
        new ActivityEntity({ ...input, schoolId }),
      )
    })
  }

  async enrollStudentInActivity(input: ActivityEnrollmentInput): Promise<ActivityEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
      return this.saveConstructed(
        this.baseService.entities.activityEnrollments,
        new ActivityEnrollmentEntity(input),
      )
    })
  }

  async assignStaffToClass(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.baseService.atomicExecution.execute(async () => {
      return this.saveStaffAssignment(input)
    })
  }

  async assignStaffToClassSubject(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.baseService.atomicExecution.execute(async () => {
      return this.saveStaffAssignment(input)
    })
  }

  async assignStaffToLessonSession(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.baseService.atomicExecution.execute(async () => {
      return this.saveStaffAssignment(input)
    })
  }

  async assignResourceToClass(input: AssignResourceInput): Promise<ResourceAssignment> {
    return this.baseService.atomicExecution.execute(async () => {
      return this.saveConstructed(this.baseService.entities.resourceAssignments, new ResourceAssignment(input))
    })
  }

  async assignResourceToLessonSession(input: AssignResourceInput): Promise<ResourceAssignment> {
    return this.baseService.atomicExecution.execute(async () => {
      return this.saveConstructed(this.baseService.entities.resourceAssignments, new ResourceAssignment(input))
    })
  }

  async removeResourceAssignment({ resourceAssignmentId, id }: RemoveResourceAssignmentInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.entities.resourceAssignments.delete(resourceAssignmentId ?? id ?? '')
    })
  }

  async registerAttachment(input: RegisterAttachmentInput): Promise<Attachment> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.attachments.assertConfigure()
      const attachment = new Attachment({
        ...input,
        status: input.storageKey ? AttachmentStatus.Ready : input.status,
      })
      if (attachment.storageKey) {
        const stored = await this.baseService.fileStorage.headObject(attachment.storageKey)
        if (!stored) {
          throw new BusinessRuleViolationError(
            'ATTACHMENT_OBJECT_NOT_FOUND',
            'Uploaded object was not found in storage',
          )
        }
        if (attachment.sizeBytes !== undefined && stored.sizeBytes !== attachment.sizeBytes) {
          throw new BusinessRuleViolationError(
            'ATTACHMENT_SIZE_MISMATCH',
            'Uploaded object size does not match declared sizeBytes',
          )
        }
        if (attachment.mimeType && stored.contentType && stored.contentType !== attachment.mimeType) {
          throw new BusinessRuleViolationError(
            'ATTACHMENT_MIME_TYPE_MISMATCH',
            'Uploaded object content type does not match declared mimeType',
          )
        }
      }
      return this.saveConstructed(this.baseService.entities.attachments, attachment)
    })
  }

  async removeAttachment({ attachmentId, id }: RemoveAttachmentInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.attachments, attachmentId ?? id ?? '')
      await this.baseService.access.attachments.assertConfigure()
      if (existing.storageKey) {
        await this.baseService.fileStorage.deleteObject(existing.storageKey)
      }
      await this.baseService.entities.attachments.delete(existing.id)
    })
  }

  private async saveStaffAssignment(input: AssignStaffInput): Promise<StaffAssignment> {
    const assignment = await this.saveConstructed(this.baseService.entities.staffAssignments, new StaffAssignmentEntity(input))
    return assignment
  }

  private async saveConstructed<T extends { id: string }>(
    managedService: { save: (entity: T) => Promise<void> },
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
