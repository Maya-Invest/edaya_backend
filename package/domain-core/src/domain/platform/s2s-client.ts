import { z } from 'zod'

import { S2S_ACCESS_CLASSES } from '../permissions/platform-permission'
import { parseDomain, zodDate } from '../shared/utils'

export const s2sClientSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  clientId: z.string().trim().min(1, 'clientId must not be blank').regex(
    /^[a-z0-9][\w.-]{0,63}$/i,
    'clientId must be a short token of letters, digits, dots, underscores, or hyphens',
  ),
  accessClass: z.enum(S2S_ACCESS_CLASSES),
  keyPrefix: z.string().trim().min(1, 'keyPrefix must not be blank'),
  keyHash: z.string().trim().min(1, 'keyHash must not be blank'),
  createdBySubjectId: z.string().trim().min(1, 'createdBySubjectId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
  expiresAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  revokedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  lastUsedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

export type S2sClientData = z.infer<typeof s2sClientSchema>
export type S2sClientInput = z.input<typeof s2sClientSchema>

export class S2sClient {
  readonly data: S2sClientData

  constructor(args: S2sClientInput) {
    this.data = parseDomain(s2sClientSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get clientId() { return this.data.clientId }
  get accessClass() { return this.data.accessClass }
  get keyPrefix() { return this.data.keyPrefix }
  get keyHash() { return this.data.keyHash }
  get createdBySubjectId() { return this.data.createdBySubjectId }
  get createdAt() { return this.data.createdAt }
  get expiresAt() { return this.data.expiresAt }
  get revokedAt() { return this.data.revokedAt }
  get lastUsedAt() { return this.data.lastUsedAt }

  isActive(now: Date = new Date()): boolean {
    if (this.revokedAt) {
      return false
    }
    if (this.expiresAt && this.expiresAt <= now) {
      return false
    }
    return true
  }
}
