/* eslint dot-notation: "off" -- Import snapshots use index signatures. */
import type { ImportIssue, ImportRecord, ImportType, ImportValues, ParsedImportTable } from '@edaya/core'
import { BusinessRuleViolationError, IMPORT_TEMPLATES, isBlankImportValue, normalizeImportHeader, parseImportDate } from '@edaya/core'

export function normalizeImportTable(type: ImportType, table: ParsedImportTable) {
  const aliases = new Map<string, string>()
  for (const column of IMPORT_TEMPLATES[type].columns) {
    for (const alias of [column.key, column.field, ...column.aliases ?? []].filter((key): key is string => Boolean(key)))
      aliases.set(normalizeImportHeader(alias), column.key)
  }
  const keys = table.headers.map(header => aliases.get(normalizeImportHeader(header)) ?? normalizeImportHeader(header))
  if (new Set(keys).size !== keys.length)
    throw new BusinessRuleViolationError('IMPORT_DUPLICATE_HEADERS', 'Headers must be unique after alias normalization')
  const supported = new Set(IMPORT_TEMPLATES[type].columns.map(column => column.key))
  return table.rows.map((row) => {
    const raw: ImportValues = {}
    const values: ImportValues = {}
    const issues: ImportIssue[] = []
    keys.forEach((key, index) => {
      const value = row.cells[index] ?? null
      raw[table.headers[index]!] = value
      if (!supported.has(key)) {
        if (!isBlankImportValue(value))
          issues.push({ code: 'IMPORT_COLUMN_UNSUPPORTED', column: table.headers[index], severity: 'error' })
      }
      else {
        values[key] = value
      }
    })
    return { sourceRow: row.row, raw, values, issues }
  })
}
export function normalizeImportValues(type: ImportType, values: ImportValues): ImportRecord {
  const result: ImportRecord = {}
  for (const column of IMPORT_TEMPLATES[type].columns) {
    if (!column.field || !(column.key in values))
      continue
    const value = values[column.key]!
    if (isBlankImportValue(value)) {
      result[column.field] = null
      continue
    }
    if (column.kind === 'text') {
      result[column.field] = column.field === 'sourceFullName' ? String(value) : String(value).trim()
    }
    else if (column.kind === 'date') {
      result[column.field] = parseImportDate(value, column.field === 'birthDate')
    }
    else if (column.kind === 'boolean') {
      const normalized = String(value).trim().toLowerCase()
      if (!['true', 'false', '1', '0', 'oui', 'non'].includes(normalized))
        throw new BusinessRuleViolationError('IMPORT_BOOLEAN_INVALID', column.key)
      result[column.field] = ['true', '1', 'oui'].includes(normalized)
    }
    else if (column.kind === 'number') {
      const normalized = String(value).trim()
      if (!/^-?\d+(?:\.\d+)?$/.test(normalized) || !Number.isFinite(Number(normalized)))
        throw new BusinessRuleViolationError('IMPORT_NUMBER_INVALID', column.key)
      result[column.field] = Number(normalized)
    }
    else {
      try {
        result[column.field] = JSON.parse(String(value))
      }
      catch {
        throw new BusinessRuleViolationError('IMPORT_JSON_INVALID', column.key)
      }
    }
  }
  // Excel-friendly international prefix, only on declared phone fields. Raw cells stay intact.
  if (typeof result['phone'] === 'string')
    result['phone'] = normalizeImportPhone(result['phone'])
  if (type === 'guardian_contacts' && result['type'] === 'phone' && typeof result['value'] === 'string')
    result['value'] = normalizeImportPhone(result['value'])
  if (type === 'guardians' && Array.isArray(result['contactMethods'])) {
    result['contactMethods'] = result['contactMethods'].map((contact) => {
      if (contact && typeof contact === 'object' && !Array.isArray(contact) && contact['type'] === 'phone' && typeof contact['value'] === 'string')
        return { ...contact, value: normalizeImportPhone(contact['value']) }
      return contact
    })
  }
  if (type === 'payments' && typeof result['method'] === 'string') {
    const aliases: Record<string, string> = { cash: 'cash', especes: 'cash', espèces: 'cash', card: 'card', carte: 'card', bank_transfer: 'bank_transfer', virement: 'bank_transfer', mobile: 'mobile_money', mobile_money: 'mobile_money', other: 'other', autre: 'other' }
    result['method'] = aliases[result['method'].toLowerCase()] ?? result['method']
  }
  if (type === 'staff' && typeof result['profileRole'] === 'string') {
    const aliases: Record<string, string> = { 'secrétaire': 'secretary', 'directeur adjoint': 'deputy_director', 'deputy director': 'deputy_director', 'directeur des études': 'studies_director', 'director of studies': 'studies_director', 'cpe / vie scolaire': 'cpe', 'pastoral / student life': 'cpe', 'principal': 'directeur', 'administrator': 'directeur', 'éducateur': 'educateur', 'educator': 'educateur', 'comptable': 'accountant', 'informaticien': 'it_admin', 'it administrator': 'it_admin', 'it admin': 'it_admin' }
    result['profileRole'] = aliases[result['profileRole'].toLowerCase()] ?? result['profileRole']
  }
  return result
}
export function importErrorCode(error: unknown): string {
  if (error instanceof BusinessRuleViolationError)
    return error.code
  if (error instanceof Error && error.name === 'AuthorizationError')
    return 'IMPORT_ACCESS_DENIED'
  if (error instanceof Error && ['ZodError', 'DomainValidationError'].includes(error.name))
    return 'IMPORT_VALUE_INVALID'
  return 'IMPORT_TRANSIENT_FAILURE'
}
/** JSON for snapshots without instance internals. Sensitive fields are projected by handlers before use. */
export function importJson(value: unknown): ImportRecord {
  return JSON.parse(JSON.stringify(value, (_key, item) => item && typeof item === 'object' && 'data' in item ? item.data : item)) as ImportRecord
}

function normalizeImportPhone(value: string): string {
  return value.trim().replace(/^#/, '+')
}
