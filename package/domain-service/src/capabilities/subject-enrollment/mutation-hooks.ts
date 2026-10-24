import type { ClassSubject, StudentClassEnrollment, Subject } from '@edaya/core'
import type { EntityBusinessHooks } from '../../services/entities/managed-entity-service'
import { reconcileOffering, reconcilePlacement, reconcileSubjectPolicy } from './reconcile'

export const placementParticipationHooks: EntityBusinessHooks<StudentClassEnrollment> = {
  postSave: (entity, previous, repositories, actor) => reconcilePlacement(repositories, entity, previous, actor),
}

export const offeringParticipationHooks: EntityBusinessHooks<ClassSubject> = {
  postSave: (entity, previous, repositories, actor) => reconcileOffering(repositories, entity, previous, actor),
}

export const subjectParticipationHooks: EntityBusinessHooks<Subject> = {
  postSave: (entity, previous, repositories, actor) => reconcileSubjectPolicy(repositories, entity, previous, actor),
}
