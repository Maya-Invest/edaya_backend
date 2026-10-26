/** Versioned, transport-independent school intake contracts. */
export const IMPORT_TEMPLATE_VERSION = 1
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024
export const IMPORT_MAX_ROWS = 10000
export const IMPORT_TYPES = ['academic_disciplines', 'placement_statuses', 'classes', 'subjects', 'students', 'guardians', 'teachers', 'staff', 'guardian_relationships', 'class_offerings', 'teacher_assignments', 'chapters', 'billing', 'payments'] as const
export type ImportType = typeof IMPORT_TYPES[number]
export type ImportExistingMode = 'S' | 'M' | 'O'
export type ImportCell = string | number | boolean | null
export type ImportValues = Record<string, ImportCell>
export type ImportJson = null | boolean | number | string | ImportJson[] | {
  [key: string]: ImportJson
}
export interface ImportRecord {
  [key: string]: ImportJson
}
export type ImportOutcome = 'pending' | 'created' | 'updated' | 'unchanged' | 'skipped' | 'blocked' | 'dependency_blocked' | 'failed' | 'cancelled'
export const IMPORT_COMPLETED_OUTCOMES: readonly ImportOutcome[] = ['created', 'updated', 'unchanged', 'skipped']
export interface ImportIssue {
  code: string
  column?: string
  candidates?: string[]
  severity: 'error' | 'warning'
}
export interface ImportSource {
  fileId: string
  revisionId: string
  row: number
  sheet?: string
}
export interface ImportApproval {
  staffMemberId: string
  subjectId: string
  assuranceLevel: 'standard' | 'verified' | 'strong'
  authenticatedAt: string
  approvedAt: string
  revision: number
  previewDigest: string
}
export interface ImportBatch {
  id: string
  schoolId: string
  academicYearId: string
  createdByStaffId: string
  createdBySubjectId: string
  defaultOnExisting: ImportExistingMode
  enrollmentEffectiveDate: string | null
  revision: number
  state: 'draft' | 'validated' | 'running' | 'completed' | 'cancelled'
  previewDigest: string | null
  workId: string | null
  approval: ImportApproval | null
  createdAt: string
  updatedAt: string
}
/** Immutable: replacement creates another revision with the same fileId. No per-file mode. */
export interface ImportFileRevision {
  id: string
  fileId: string
  batchId: string
  schoolId: string
  type: ImportType
  templateVersion: number
  revision: number
  fileName: string
  storageKey: string
  sha256: string
  headers: string[]
  createdAt: string
}
export interface ImportRow {
  id: string
  batchId: string
  schoolId: string
  type: ImportType
  source: ImportSource
  raw: ImportValues
  values: ImportValues
  generatedCode: string | null
  targetId: string
  sourceKey: string
  effectiveMode: ImportExistingMode
  inputDigest: string
  operationId: string
  collection?: {
    ownerId: string
    memberIds: string[]
    before: ImportRecord[]
  }
  dependencies: string[]
  current: ImportRecord | null
  proposed: ImportRecord | null
  expectedDigest: string | null
  issues: ImportIssue[]
  outcome: ImportOutcome
  result: ImportRecord | null
}
export interface ImportIdentity {
  bound: boolean
  schoolId: string
  type: ImportType
  sourceKey: string
  targetId: string
  generatedCode: string | null
}
export interface ImportExecutionOutcome {
  schoolId: string
  batchId: string
  rowId: string
  operationId: string
  inputDigest: string
  targetId: string
  outcome: ImportOutcome
  result: ImportRecord | null
  completedAt: string
}
export interface ParsedImportTable {
  headers: string[]
  rows: {
    row: number
    cells: ImportCell[]
  }[]
  sheet?: string
}
export interface ImportFormatPort {
  parse: (input: {
    bytes: Uint8Array
    fileName: string
  }) => Promise<ParsedImportTable>
  serialize: (input: {
    headers: string[]
    rows: ImportCell[][]
    format: 'csv' | 'xlsx'
  }) => Promise<Uint8Array>
}
export interface ImportProgress {
  counts: Record<string, number>
  version: number
  updatedAt: string | null
}
/** Minimal disclosure evidence; contains no source cells or business snapshots. */
export interface ImportReadTarget {
  type: ImportType
  targetId: string
  references: { key: 'students' | 'guardians' | 'teachers' | 'classGroups', id: string }[]
  studentIds: string[]
}
export interface ImportRowQuery {
  ids?: readonly string[]
  outcome?: ImportOutcome
  ready?: boolean
  dependencyBlocked?: boolean
  after?: string
  limit: number
}
/** All mutations participate in the caller's AtomicExecutionPort transaction. */
export interface ImportPersistencePort {
  getBatch: (schoolId: string, id: string) => Promise<ImportBatch | undefined>
  listBatches: (schoolId: string, limit: number, before?: string) => Promise<ImportBatch[]>
  saveBatch: (batch: ImportBatch) => Promise<void>
  listFiles: (schoolId: string, batchId: string) => Promise<ImportFileRevision[]>
  addFile: (file: ImportFileRevision) => Promise<void>
  listRows: (schoolId: string, batchId: string) => Promise<ImportRow[]>
  queryRows: (schoolId: string, batchId: string, query: ImportRowQuery) => Promise<ImportRow[]>
  pendingClassCohort: (schoolId: string, batchId: string, classGroupId: string) => Promise<{ id: string, targetId: string }[]>
  progress: (schoolId: string, batchId: string) => Promise<ImportProgress>
  readTargets: (schoolId: string, batchId: string) => Promise<ImportReadTarget[]>
  exhaustedBatches: (limit: number) => Promise<ImportBatch[]>
  saveRows: (rows: readonly ImportRow[]) => Promise<void>
  getIdentity: (schoolId: string, type: ImportType, sourceKey: string) => Promise<ImportIdentity | undefined>
  getIdentities: (schoolId: string, type: ImportType, sourceKeys: readonly string[]) => Promise<ImportIdentity[]>
  saveIdentities: (identities: readonly ImportIdentity[]) => Promise<void>
  saveIdentity: (identity: ImportIdentity) => Promise<void>
  findOutcome: (schoolId: string, batchId: string, rowId: string, inputDigest: string) => Promise<ImportExecutionOutcome | undefined>
  findOutcomes: (schoolId: string, batchId: string, requests: readonly { rowId: string, inputDigest: string }[]) => Promise<ImportExecutionOutcome[]>
  addOutcomes: (outcomes: readonly ImportExecutionOutcome[]) => Promise<void>
  addOutcome: (outcome: ImportExecutionOutcome) => Promise<void>
}
