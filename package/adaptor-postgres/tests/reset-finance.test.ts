import { describe, expect, test } from 'bun:test'
import {
  assertFinanceResetTarget,
  DISPOSABLE_FINANCE_TABLES,
  FINANCE_RESET_ALLOWED_TABLES,
} from '../src/lib/reset-finance'
import { CLEAR_TABLE_ORDER } from '../src/lib/schema-init'

describe('disposable finance reset inventory', () => {
  test('declares only finance tables and does not reuse clearAllTables', () => {
    expect([...DISPOSABLE_FINANCE_TABLES]).toEqual([
      'student_account_entries',
      'allocations',
      'payments',
      'student_charges',
      'student_service_enrollments',
      'student_year_accounts',
      'catalog_services',
    ])
    expect(FINANCE_RESET_ALLOWED_TABLES).not.toContain('students')
    expect(FINANCE_RESET_ALLOWED_TABLES).not.toContain('schools')
    expect(FINANCE_RESET_ALLOWED_TABLES).not.toContain('command_receipts')
    expect(FINANCE_RESET_ALLOWED_TABLES).not.toContain('command_audit')
    expect(CLEAR_TABLE_ORDER.length).toBeGreaterThan(DISPOSABLE_FINANCE_TABLES.length)
  })

  test('rejects missing URLs, DATABASE_URL reuse, and non-loopback hosts', () => {
    expect(() => assertFinanceResetTarget(undefined)).toThrow('EDAYA_FINANCE_RESET_URL is required')
    expect(() => assertFinanceResetTarget('postgres://edaya@127.0.0.1:5432/postgres', {
      DATABASE_URL: 'postgres://edaya@127.0.0.1:5432/postgres',
    })).toThrow('must not reuse DATABASE_URL')
    expect(() => assertFinanceResetTarget('postgres://edaya@ep-prod.neon.tech/postgres')).toThrow('loopback')
    expect(assertFinanceResetTarget('postgres://edaya_rc@127.0.0.1:54329/postgres')).toContain('127.0.0.1')
  })
})
