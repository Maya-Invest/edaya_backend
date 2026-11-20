/** Internal object inventory. Tombstones prevent publication after cleanup begins. */
export interface PrivateFileObject {
  id: string
  schoolId: string
  storageKey: string
  status: 'reserved' | 'deleting' | 'deleted'
  /** Null retains imported legacy objects until explicit detachment. */
  protectedUntil: Date | null
  deleteJobId?: string
}

export interface PrivateFileReference {
  schoolId: string
  sourceType: string
  sourceId: string
  slot: string
  attachmentId?: string
  storageKey?: string
}

export interface PrivateFileLifecycleStore {
  /** Trusted capabilities authorize the source, then maintain its reference with their business transaction. */
  retain: (reference: PrivateFileReference) => Promise<void>
  release: (reference: Pick<PrivateFileReference, 'schoolId' | 'sourceType' | 'sourceId' | 'slot'>) => Promise<void>
  /** Lock current metadata and reject retained attachment references before removal. */
  assertRemovable: (schoolId: string, attachmentId: string) => Promise<void>
  /** Before external writes; extends a live reservation, never resurrects a tombstone. */
  reserve: (input: { schoolId: string, storageKey: string, protectedUntil: Date }) => Promise<PrivateFileObject>
  /** Persist cleanup eligibility with metadata removal; referenced objects stay protected. */
  expedite: (schoolId: string, storageKey: string) => Promise<void>
  listAbandonedPortraitIds: (schoolId: string, asOf: Date) => Promise<string[]>
  listDue: (schoolId: string, limit: number) => Promise<PrivateFileObject[]>
  /** Lock the object and forbid future references before emitting durable deletion work. */
  prepareDeletion: (schoolId: string, id: string, jobId: string) => Promise<boolean>
  findDeletion: (schoolId: string, id: string, jobId: string) => Promise<PrivateFileObject | undefined>
  completeDeletion: (schoolId: string, id: string, jobId: string) => Promise<void>
}
