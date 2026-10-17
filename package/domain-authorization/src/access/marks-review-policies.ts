import type { Assessment } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { Permission } from '@edaya/core'
import { AuthorizationError } from '../model/errors'
import { denied } from './facts'

export type MarksAction = 'submit' | 'approve'
/** Action policies own permissions and enforce class-group resource scopes. */
export class MarksReviewAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}
  edit(assessmentId: string) {
    return this.access.assertResources([Permission.GRADE_MANAGE], 'assessments', [assessmentId])
  }

  detail(assessmentId: string) {
    return this.access.assertResources([Permission.GRADE_READ, Permission.GRADE_VALIDATE], 'assessments', [assessmentId], 'read')
  }

  queueScope() {
    if (this.access.actor.kind !== 'staff')
      denied('Marks review requires a staff profile')
    return this.access.scope(Permission.GRADE_VALIDATE, 'assessments')
  }

  assertClassAction(action: MarksAction, classGroupId: string) {
    if (action !== 'submit' && this.access.actor.kind !== 'staff')
      denied('Marks review requires a staff profile')
    const permission = action === 'submit' ? [Permission.GRADE_MANAGE] : Permission.GRADE_VALIDATE
    return this.access.assertResources(permission, 'classGroups', [classGroupId])
  }

  async can(action: MarksAction, assessment: Pick<Assessment, 'classGroupId'>): Promise<boolean> {
    try {
      await this.assertClassAction(action, assessment.classGroupId)
      return true
    }
    catch (error) {
      if (!(error instanceof AuthorizationError))
        throw error
      return false
    }
  }
}
