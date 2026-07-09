import type { StaffClassGroupAccess } from '../types'
import {
  actorGrantCoversAny,
  actorGrantCoversAnyResourcePath,
} from '../../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'
import { resourcePathForClassGroup } from '../../../scope/resolve-resource-path'
import { CLASS_GROUP_ACCESS_PERMISSIONS } from '../../resolvers/permission-sets'

export const staffClassGroupAccess: StaffClassGroupAccess = async (actor, classGroupIds) => {
  for (const classGroupId of classGroupIds) {
    const canAccess = actorGrantCoversAnyResourcePath(
      actor,
      CLASS_GROUP_ACCESS_PERMISSIONS,
      resourcePathForClassGroup(classGroupId),
    ) || actorGrantCoversAny(
      actor,
      CLASS_GROUP_ACCESS_PERMISSIONS,
      'class_group',
      classGroupId,
    )

    if (!canAccess) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
