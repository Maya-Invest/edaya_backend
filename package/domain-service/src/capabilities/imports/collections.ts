/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { ImportRecord, ImportRow } from '@edaya/core'
import type { ImportBusinessContext } from './business'
import { IMPORT_COMPLETED_OUTCOMES, normalizeImportKey } from '@edaya/core'
import { importErrorCode, importJson } from './normalization'

export function completeCollectionRows(row: ImportRow, rows: ImportRow[]): ImportRow[] {
  return row.collection?.memberIds.map(id => rows.find(candidate => candidate.id === id)!).filter(Boolean) ?? [row]
}
export async function collectionSnapshot(ctx: ImportBusinessContext, type: ImportRow['type'], ownerId: string): Promise<ImportRecord[]> {
  if (type === 'guardian_contacts') {
    const existing = (await ctx.list('guardians', { id: ownerId })).find(guardian => guardian.id === ownerId)
    if (existing)
      return importJson(await ctx.readable('guardians', ownerId))['contactMethods'] as ImportRecord[]
    return (ctx.rows.find(row => row.type === 'guardians' && row.targetId === ownerId)?.proposed?.['contactMethods'] ?? []) as ImportRecord[]
  }
  const links = (await ctx.list('guardianLinks', { guardianId: ownerId })).filter(link => link.guardianId === ownerId)
  const records: ImportRecord[] = []
  for (const link of links)
    records.push(importJson(await ctx.readable('guardianLinks', link.id)))
  return records.sort((a, b) => String(a['id']).localeCompare(String(b['id'])))
}
/** A complete child file is an owner-level transaction. Subsets never enter this path. */
export async function prepareCompleteCollections(ctx: ImportBusinessContext, rows: ImportRow[]): Promise<void> {
  for (const row of rows)
    delete row.collection
  for (const declaration of rows.filter(row => ['guardian_contacts', 'guardian_relationships'].includes(row.type) && row.proposed?.['completeCollection'] === true && row.effectiveMode === 'O')) {
    const ownerId = String(declaration.proposed!['guardianId'])
    const group = rows.filter(row => row.type === declaration.type && row.source.fileId === declaration.source.fileId && (row.proposed?.['guardianId'] === ownerId || normalizeImportKey(row.values['guardian']) === normalizeImportKey(declaration.values['guardian'])))
    const invalid = group.some(row => row.effectiveMode !== 'O' || (!IMPORT_COMPLETED_OUTCOMES.includes(row.outcome) && row.outcome !== 'pending'))
    if (invalid) {
      for (const row of group.filter(row => row.outcome === 'pending')) {
        row.outcome = 'dependency_blocked'
        row.issues.push({ code: 'IMPORT_COMPLETE_COLLECTION_REVIEW_REQUIRED', severity: 'error' })
      }
      continue
    }
    try {
      const before = await collectionSnapshot(ctx, declaration.type, ownerId)
      for (const row of group)
        row.collection = { ownerId, memberIds: group.map(item => item.id).sort(), before }
    }
    catch (error) {
      const code = importErrorCode(error)
      if (code === 'IMPORT_TRANSIENT_FAILURE')
        throw error
      for (const row of group.filter(row => row.outcome === 'pending')) {
        row.outcome = 'blocked'
        row.issues.push({ code, severity: 'error' })
      }
    }
  }
}
export async function replaceCompleteContacts(ctx: ImportBusinessContext, group: ImportRow[]): Promise<void> {
  const ownerId = group[0]!.collection!.ownerId
  const contacts = group.map(row => Object.fromEntries(Object.entries(row.proposed!).filter(([key]) => ['type', 'value', 'label', 'isPrimary', 'allowsNotifications'].includes(key))))
  await ctx.service.studentWorkflow.updateGuardianContactMethods({ guardianId: ownerId, contactMethods: contacts } as Parameters<typeof ctx.service.studentWorkflow.updateGuardianContactMethods>[0])
}
export async function removeUnmentionedLinks(ctx: ImportBusinessContext, group: ImportRow[]): Promise<void> {
  const ownerId = group[0]!.collection!.ownerId
  const students = new Set(group.map(row => row.proposed!['studentId']))
  for (const link of (await ctx.list('guardianLinks', { guardianId: ownerId })).filter(link => link.guardianId === ownerId && !students.has(link.studentId)))
    await ctx.base.entities.guardianLinks.delete(link.id)
}
