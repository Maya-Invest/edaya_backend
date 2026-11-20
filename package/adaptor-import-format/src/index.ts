import type { ImportCell, ImportFormatPort, ParsedImportTable } from '@edaya/core'
import { inflateRawSync } from 'node:zlib'
import { BusinessRuleViolationError, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS } from '@edaya/core'
import ExcelJS from 'exceljs'

const MAX_COLUMNS = 128
const MAX_CELL_CHARS = 32768
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024
const MAX_ENTRY_BYTES = 8 * 1024 * 1024
function fail(code: string): never {
  throw new BusinessRuleViolationError(code, code)
}
/** Validate actual inflated lengths before the spreadsheet library expands any workbook. */
export function assertBoundedWorkbook(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054B50)
    end--
  if (end < 0 || end < bytes.length - 65557)
    fail('IMPORT_XLSX_INVALID')
  const count = view.getUint16(end + 10, true)
  const directorySize = view.getUint32(end + 12, true)
  let offset = view.getUint32(end + 16, true)
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count > 500 || count === 0 || offset + directorySize > end)
    fail('IMPORT_WORKBOOK_LIMIT')
  const names = new Set<string>()
  let total = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014B50)
      fail('IMPORT_XLSX_INVALID')
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const compressed = view.getUint32(offset + 20, true)
    const expanded = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const local = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (flags & 1 || ![0, 8].includes(method) || expanded > MAX_ENTRY_BYTES || compressed > bytes.length || names.has(name) || name.includes('..') || name.startsWith('/'))
      fail('IMPORT_WORKBOOK_LIMIT')
    names.add(name)
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034B50)
      fail('IMPORT_XLSX_INVALID')
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    if (start + compressed > bytes.length)
      fail('IMPORT_XLSX_INVALID')
    const compressedBytes = bytes.subarray(start, start + compressed)
    let inflated: Uint8Array
    try {
      inflated = method === 0 ? compressedBytes : inflateRawSync(compressedBytes, { maxOutputLength: MAX_ENTRY_BYTES })
    }
    catch {
      fail('IMPORT_WORKBOOK_LIMIT')
    }
    total += inflated.length
    if (inflated.length !== expanded || total > MAX_EXPANDED_BYTES)
      fail('IMPORT_WORKBOOK_LIMIT')
    if (name.endsWith('.xml') && /<!DOCTYPE|<!ENTITY/i.test(new TextDecoder().decode(inflated)))
      fail('IMPORT_XLSX_INVALID')
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
}
function table(rows: ImportCell[][], sheet?: string, sourceRows?: number[]): ParsedImportTable {
  if (!rows.length)
    fail('IMPORT_TABLE_EMPTY')
  const headers = rows[0]!.map(value => String(value ?? ''))
  if (!headers.length || headers.length > MAX_COLUMNS)
    fail('IMPORT_COLUMN_LIMIT')
  if (rows.length > IMPORT_MAX_ROWS + 1)
    fail('IMPORT_ROW_LIMIT')
  return {
    headers,
    sheet,
    rows: rows.slice(1).map((cells, index) => {
      if (cells.length > headers.length)
        fail('IMPORT_ROW_WIDTH')
      if (cells.some(cell => typeof cell === 'string' && cell.length > MAX_CELL_CHARS))
        fail('IMPORT_CELL_LIMIT')
      const padding: ImportCell[] = Array.from<ImportCell>({ length: headers.length - cells.length }).fill(null)
      return { row: sourceRows?.[index + 1] ?? index + 2, cells: [...cells, ...padding] }
    }).filter(row => row.cells.some(cell => cell !== null && cell !== '')),
  }
}
function parseCsv(bytes: Uint8Array): ParsedImportTable {
  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes).replace(/^\uFEFF/, '')
  }
  catch {
    fail('IMPORT_CSV_UTF8_REQUIRED')
  }
  // Delimiters are detected on the first logical record, outside quoted fields.
  const counts = new Map([[';', 0], [',', 0], ['\t', 0]])
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!
    if (c === '"') {
      if (quoted && source[i + 1] === '"')
        i++
      else
        quoted = !quoted
    }
    else if (!quoted && (c === '\n' || c === '\r')) {
      break
    }
    else if (!quoted && counts.has(c)) {
      counts.set(c, counts.get(c)! + 1)
    }
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0]![0]
  const rows: ImportCell[][] = []
  const sourceRows: number[] = []
  let line = 1
  let startLine = 1
  let row: ImportCell[] = []
  let cell = ''
  let inQuote = false
  let afterQuote = false
  for (let i = 0; i <= source.length; i++) {
    const c = source[i]
    if (inQuote) {
      if (c === undefined)
        fail('IMPORT_CSV_QUOTE_INVALID')
      if (c === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i++
        }
        else {
          inQuote = false
          afterQuote = true
        }
      }
      else {
        cell += c
        if (c === '\n' || (c === '\r' && source[i + 1] !== '\n'))
          line++
      }
    }
    else if (c === '"' && cell === '' && !afterQuote) {
      inQuote = true
    }
    else if (c === delimiter || c === '\n' || c === '\r' || c === undefined) {
      row.push(cell)
      cell = ''
      afterQuote = false
      if (row.length > MAX_COLUMNS)
        fail('IMPORT_COLUMN_LIMIT')
      if (c !== delimiter) {
        if (row.some(value => value !== '') || rows.length === 0) {
          rows.push(row)
          sourceRows.push(startLine)
        }
        line++
        startLine = line
        row = []
        if (c === '\r' && source[i + 1] === '\n')
          i++
        if (rows.length > IMPORT_MAX_ROWS + 1)
          fail('IMPORT_ROW_LIMIT')
      }
    }
    else {
      if (afterQuote || c === '"')
        fail('IMPORT_CSV_QUOTE_INVALID')
      cell += c
    }
    if (cell.length > MAX_CELL_CHARS)
      fail('IMPORT_CELL_LIMIT')
  }
  return table(rows, undefined, sourceRows)
}
export class ImportFormatAdapter implements ImportFormatPort {
  async parse(input: {
    bytes: Uint8Array
    fileName: string
  }): Promise<ParsedImportTable> {
    if (!input.bytes.length || input.bytes.length > IMPORT_MAX_FILE_BYTES)
      fail('IMPORT_FILE_SIZE')
    if (/\.csv$/i.test(input.fileName))
      return parseCsv(input.bytes)
    if (!/\.xlsx$/i.test(input.fileName))
      fail('IMPORT_FORMAT_UNSUPPORTED')
    try {
      assertBoundedWorkbook(input.bytes)
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(input.bytes as unknown as ExcelJS.Buffer)
      const populated = workbook.worksheets.filter(sheet => sheet.actualRowCount > 0)
      if (populated.length !== 1)
        fail('IMPORT_ONE_TABLE_REQUIRED')
      const sheet = populated[0]!
      if (sheet.rowCount > IMPORT_MAX_ROWS + 1 || sheet.columnCount > MAX_COLUMNS)
        fail('IMPORT_WORKBOOK_LIMIT')
      const rows: ImportCell[][] = []
      for (let r = 1; r <= sheet.rowCount; r++) {
        const row: ImportCell[] = []
        for (let c = 1; c <= sheet.columnCount; c++) {
          const cell = sheet.getCell(r, c)
          const value = cell.value
          if (value === null || value === undefined) {
            row.push(null)
          }
          else if (value instanceof Date) {
            row.push(value.toISOString().slice(0, 10))
          }
          else if (typeof value === 'string' || typeof value === 'boolean') {
            row.push(value)
          }
          else if (typeof value === 'number') {
            // Preserve leading-zero number formats; unformatted numeric identifiers remain text at normalization.
            row.push(/^0+$/.test(cell.numFmt) ? String(value).padStart(cell.numFmt.length, '0') : value)
          }
          else if ('richText' in value) {
            row.push(value.richText.map(part => part.text).join(''))
          }
          else {
            fail('IMPORT_CELL_TYPE_UNSUPPORTED')
          }
        }
        rows.push(row)
      }
      return table(rows, sheet.name)
    }
    catch (error) {
      if (error instanceof BusinessRuleViolationError)
        throw error
      fail('IMPORT_XLSX_INVALID')
    }
  }

  async serialize(input: {
    headers: string[]
    rows: ImportCell[][]
    format: 'csv' | 'xlsx'
  }): Promise<Uint8Array> {
    if (input.format === 'xlsx') {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Import')
      sheet.addRows([input.headers, ...input.rows])
      // Explicit string cells, never formulas, preserve identifiers and phone numbers.
      return new Uint8Array(await workbook.xlsx.writeBuffer())
    }
    const encode = (value: ImportCell) => {
      const raw = String(value ?? '')
      // Spreadsheet formulas are not a supported input. Keep telephone +digits intact.
      const safe = /^[=\t\r@]|^[+-](?![\d\s().-]+$)/.test(raw) ? `'${raw}` : raw
      return `"${safe.replaceAll('"', '""')}"`
    }
    return new TextEncoder().encode(`\uFEFF${[input.headers, ...input.rows].map(row => row.map(encode).join(';')).join('\r\n')}\r\n`)
  }
}
