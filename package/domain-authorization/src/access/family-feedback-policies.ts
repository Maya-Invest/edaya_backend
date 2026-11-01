import type { AccessPolicies } from './access-policies'
import { Permission } from '@edaya/core'

/** School-wide family-feedback actions; portal submission and published teacher results stay on those workflows. */
export class FamilyFeedbackAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  assertManage() {
    return this.access.assertSchool(Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE)
  }

  assertRead() {
    return this.access.assertSchool([
      Permission.FAMILY_FEEDBACK_CAMPAIGN_READ,
      Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE,
      Permission.FAMILY_FEEDBACK_PUBLISH,
    ])
  }

  assertPublish() {
    return this.access.assertSchool(Permission.FAMILY_FEEDBACK_PUBLISH)
  }

  assertModerate() {
    return this.access.assertSchool(Permission.FAMILY_FEEDBACK_MODERATE)
  }
}
