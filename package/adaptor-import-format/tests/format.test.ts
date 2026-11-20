import { expect, test } from 'bun:test'
import ExcelJS from 'exceljs'
import { ImportFormatAdapter } from '../src'

const adapter = new ImportFormatAdapter()
test('CSV preserves leading zeros, compound names, quotes and explicit blank cells', async () => {
  const table = await adapter.parse({ fileName: 'test.csv', bytes: new TextEncoder().encode('matricule;source_full_name;is_repeating;declared_hours\n0012;"  Compound ""Name""  ";false;0\n0013;"Line\nName";;') })
  expect(table.rows[0]?.cells).toEqual(['0012', '  Compound "Name"  ', 'false', '0'])
  expect(table.rows[1]?.cells).toEqual(['0013', 'Line\nName', '', ''])
})
test('XLSX round trip keeps text identifiers, booleans, zero and phone prefixes', async () => {
  const rows = [['001', false, 0, '+22500123']]
  const bytes = await adapter.serialize({ headers: ['code', 'active', 'hours', 'phone'], rows, format: 'xlsx' })
  const table = await adapter.parse({ fileName: 'test.xlsx', bytes })
  expect(table.rows[0]?.cells).toEqual(rows[0]!)
})
test('rejects old XLS, malformed input and multiple populated sheets', async () => {
  await expect(adapter.parse({ fileName: 'legacy.xls', bytes: new Uint8Array([1]) })).rejects.toMatchObject({ code: 'IMPORT_FORMAT_UNSUPPORTED' })
  await expect(adapter.parse({ fileName: 'broken.csv', bytes: new TextEncoder().encode('name\n"unterminated') })).rejects.toMatchObject({ code: 'IMPORT_CSV_QUOTE_INVALID' })
  const book = new ExcelJS.Workbook()
  book.addWorksheet('one').addRow(['a'])
  book.addWorksheet('two').addRow(['b'])
  await expect(adapter.parse({ fileName: 'multi.xlsx', bytes: new Uint8Array(await book.xlsx.writeBuffer()) })).rejects.toMatchObject({ code: 'IMPORT_ONE_TABLE_REQUIRED' })
})
test('rejects oversized expansion and formula cells instead of trusting cached results', async () => {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('Data')
  sheet.addRow(['value'])
  sheet.addRow([{ formula: '1+1', result: 2 }])
  await expect(adapter.parse({ fileName: 'formula.xlsx', bytes: new Uint8Array(await book.xlsx.writeBuffer()) })).rejects.toMatchObject({ code: 'IMPORT_CELL_TYPE_UNSUPPORTED' })
  sheet.getCell(2, 1).value = 'x'.repeat(9 * 1024 * 1024)
  await expect(adapter.parse({ fileName: 'bomb.xlsx', bytes: new Uint8Array(await book.xlsx.writeBuffer()) })).rejects.toMatchObject({ code: 'IMPORT_WORKBOOK_LIMIT' })
})
