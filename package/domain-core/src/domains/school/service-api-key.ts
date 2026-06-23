import { z } from 'zod'
import { parseDomain, zodDate } from '../utils'

export const serviceApiKeySchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  staffMemberId: z.string().trim().min(1, 'staffMemberId must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  keyPrefix: z.string().trim().min(1, 'keyPrefix must not be blank'),
  keyHash: z.string().trim().min(1, 'keyHash must not be blank'),
  createdBySubjectId: z.string().trim().min(1, 'createdBySubjectId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
  expiresAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  revokedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  lastUsedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

export type ServiceApiKeyData = z.infer<typeof serviceApiKeySchema>
export type ServiceApiKeyInput = z.input<typeof serviceApiKeySchema>

export const serviceApiKeyCreateSchema = serviceApiKeySchema.omit({
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
})

/** Machine credential linked to a service staff member. */
export class ServiceApiKey {
  readonly data: ServiceApiKeyData

  constructor(args: ServiceApiKeyInput) {
    this.data = parseDomain(serviceApiKeySchema, args)
  }

  get id() { return this.data.id }
  get staffMemberId() { return this.data.staffMemberId }
  get schoolId() { return this.data.schoolId }
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
