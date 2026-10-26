import type { ClassSubject, StudentClassEnrollment, Subject } from '@edaya/core'
import type { EntityBusinessHooks } from '../../services/entities/managed-entity-service'
import { createAccessPolicies } from '@edaya/authorization'
import { Permission } from '@edaya/core'
import { invalidateReportConfiguration, subjectReportConfigurationChanged } from '../academics/report-configuration'
import { reconcileOffering, reconcilePlacement, reconcileSubjectPolicy } from './reconcile'

export const placementParticipationHooks: EntityBusinessHooks<StudentClassEnrollment> = {
  postSave: (entity, previous, repositories, actor) => reconcilePlacement(repositories, entity, previous, actor),
}

export const offeringParticipationHooks: EntityBusinessHooks<ClassSubject> = {
  postSave: (entity, previous, repositories, actor) => reconcileOffering(repositories, entity, previous, actor),
}

export const subjectParticipationHooks: EntityBusinessHooks<Subject> = {
  postSave: async (entity, previous, repositories, actor) => {
    if ((entity.reportModuleId ?? null) !== (previous?.reportModuleId ?? null) || (entity.reportOrder !== (previous?.reportOrder ?? 0))) {
      await createAccessPolicies({ actor, repositories }).assertResources(Permission.REPORT_CARD_CONFIGURE, 'gradeLevels', [entity.gradeLevelId])
    }
    await reconcileSubjectPolicy(repositories, entity, previous, actor)
    await subjectReportConfigurationChanged(entity, previous, repositories)
  },
  postDelete: async (entity, repositories) => { await invalidateReportConfiguration(repositories, entity.gradeLevelId, entity.academicYearId) },
}
