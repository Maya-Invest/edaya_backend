import type { CatalogService, ClassGroup, StudentAcademicYearProfile, StudentClassEnrollment } from '@edaya/core'
import type { EntityConfigFactoryInput } from '../../services/entities/entity-config'
import type { EntityBusinessHooks } from '../../services/entities/managed-entity-service'
import { StudentClassEnrollmentStatus } from '@edaya/core'
import { placementParticipationHooks } from '../subject-enrollment/mutation-hooks'
import { scheduleFeeBilling, scheduleStudentBilling } from './auto-billing'

export function feeBillingHooks(context: EntityConfigFactoryInput): EntityBusinessHooks<CatalogService> {
  return {
    postSave: (fee, _previous, _repos, actor) => scheduleFeeBilling(context, fee, actor, 'fee_saved'),
  }
}

export function enrollmentBillingHooks(context: EntityConfigFactoryInput): EntityBusinessHooks<StudentClassEnrollment> {
  return {
    postSave: async (entity, previous, repositories, actor) => {
      await placementParticipationHooks.postSave?.(entity, previous, repositories, actor)
      await scheduleStudentBilling(context, actor, entity.studentId, entity.academicYearId, 'enrollment_changed')
    },
    postDelete: (entity, _repositories, actor) => scheduleStudentBilling(context, actor, entity.studentId, entity.academicYearId, 'enrollment_changed'),
  }
}

export function placementProfileBillingHooks(context: EntityConfigFactoryInput): EntityBusinessHooks<StudentAcademicYearProfile> {
  return {
    postSave: async (entity, previous, _repositories, actor) => {
      if (!previous || previous.placementStatusId !== entity.placementStatusId)
        await scheduleStudentBilling(context, actor, entity.studentId, entity.academicYearId, 'placement_status_changed')
    },
    postDelete: (entity, _repositories, actor) => scheduleStudentBilling(context, actor, entity.studentId, entity.academicYearId, 'placement_status_changed'),
  }
}

export function classGradeBillingHooks(context: EntityConfigFactoryInput): EntityBusinessHooks<ClassGroup> {
  return {
    postSave: async (group, previous, repositories, actor) => {
      if (!previous || previous.gradeLevelId === group.gradeLevelId)
        return
      let cursor = ''
      while (true) {
        const rows = await repositories.enrollments.list({ classGroupId: group.id, status: StudentClassEnrollmentStatus.Active, id: { $gt: cursor }, $orderBy: [{ field: 'id', direction: 'asc' }], $limit: 100 })
        for (const row of rows) await scheduleStudentBilling(context, actor, row.studentId, row.academicYearId, 'class_grade_changed')
        if (rows.length < 100)
          return
        cursor = rows.at(-1)!.id
      }
    },
  }
}
