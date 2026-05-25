import type { Attachment, AttachmentOwnerKind } from '../entities/school/attachment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AttachmentRepository extends BaseRepositoryInterface<Attachment> {
  listByOwner: (ownerKind: AttachmentOwnerKind, ownerId: string) => Promise<Attachment[]>
}
