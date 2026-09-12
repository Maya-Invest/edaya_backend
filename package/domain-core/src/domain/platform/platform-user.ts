import { z } from 'zod'

import { ALL_PLATFORM_PERMISSIONS, PlatformPermission } from '../permissions/platform-permission'
import { parseDomain, zodDate } from '../shared/utils'

export const platformUserSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  email: z.string().trim().email('email must be a valid email'),
  permissions: z.array(z.nativeEnum(PlatformPermission)).min(1),
  isActive: z.boolean(),
  createdBySubjectId: z.string().trim().min(1, 'createdBySubjectId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

export type PlatformUserData = z.infer<typeof platformUserSchema>
export type PlatformUserInput = z.input<typeof platformUserSchema>

export class PlatformUser {
  readonly data: PlatformUserData

  constructor(args: PlatformUserInput) {
    this.data = parseDomain(platformUserSchema, {
      ...args,
      email: typeof args.email === 'string' ? args.email.trim().toLowerCase() : args.email,
      permissions: [...new Set(args.permissions ?? ALL_PLATFORM_PERMISSIONS)],
    })
  }

  get id() { return this.data.id }
  get subjectId() { return this.data.subjectId }
  get email() { return this.data.email }
  get permissions() { return this.data.permissions }
  get isActive() { return this.data.isActive }
  get createdBySubjectId() { return this.data.createdBySubjectId }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  permissionSet(): Set<PlatformPermission> {
    return new Set(this.permissions)
  }
}
