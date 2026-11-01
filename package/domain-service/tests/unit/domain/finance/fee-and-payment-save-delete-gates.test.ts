import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { CatalogService, CatalogServiceStatus, Payment, PaymentKind, PaymentMethod, PaymentStatus, studentYearAccountId } from '@edaya/core'
import { validateCatalogServiceDelete, validateCatalogServiceSave, validatePaymentDelete, validatePaymentSave } from '@edaya/service'
import { describe, expect, mock, test } from 'bun:test'

const catalog = new CatalogService({
  id: 'cat-1',
  schoolId: 'school-1',
  academicYearId: 'year-1',
  name: 'Tuition',
  defaultPrice: 50_000,
  currency: 'XAF',
  billingTerms: { kind: 'one_time', installments: [] },
  status: CatalogServiceStatus.Draft,
})

const accountId = studentYearAccountId('school-1', 'student-1', 'year-1', 'XAF')
const payment = new Payment({
  id: 'payment-1',
  schoolId: 'school-1',
  accountId,
  academicYearId: 'year-1',
  kind: PaymentKind.Receipt,
  amount: 10_000,
  currency: 'XAF',
  paymentDate: new Date('2026-06-01T00:00:00.000Z'),
  method: PaymentMethod.Cash,
})

describe('validateCatalogServiceSave', () => {
  test('accepts catalog services whose academic year belongs to the same school', async () => {
    await validateCatalogServiceSave(catalog, undefined, {
      schools: { findById: mock(async () => ({ id: 'school-1', financeCurrency: 'XAF' })) },
      academicYears: { findById: mock(async () => ({ id: 'year-1', schoolId: 'school-1' })) },
    } as never)
  })

  test('rejects catalog services whose academic year belongs to another school', async () => {
    await expect(validateCatalogServiceSave(catalog, undefined, {
      schools: { findById: mock(async () => ({ id: 'school-1', financeCurrency: 'XAF' })) },
      academicYears: { findById: mock(async () => ({ id: 'year-1', schoolId: 'other-school' })) },
    } as never)).rejects.toBeInstanceOf(AuthorizationError)
  })
})

describe('validateCatalogServiceDelete', () => {
  test('allows delete when no enrollments exist', async () => {
    await validateCatalogServiceDelete(catalog, {
      studentServiceEnrollments: { list: mock(async () => []) },
    } as never)
  })

  test('blocks delete while enrollments remain', async () => {
    await expect(validateCatalogServiceDelete(catalog, {
      studentServiceEnrollments: { list: mock(async () => [{ id: 'enr-1' }]) },
    } as never)).rejects.toMatchObject({
      code: 'CATALOG_SERVICE_HAS_DEPENDENCIES',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})

describe('validatePaymentSave', () => {
  test('requires a matching student year account', async () => {
    await expect(validatePaymentSave(payment, undefined, {
      schools: { findById: mock(async () => ({ id: 'school-1', financeCurrency: 'XAF' })) },
      studentYearAccounts: { findById: mock(async () => undefined) },
    } as never)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('allows reversing a recorded receipt', async () => {
    await validatePaymentSave(new Payment({
      id: 'payment-1',
      schoolId: 'school-1',
      accountId,
      academicYearId: 'year-1',
      amount: 10_000,
      currency: 'XAF',
      paymentDate: new Date('2026-06-01T00:00:00.000Z'),
      method: PaymentMethod.Cash,
      status: PaymentStatus.Reversed,
      reversedAt: new Date('2026-06-02T00:00:00.000Z'),
      reversedById: 'staff-1',
    }), payment, {
      schools: { findById: mock(async () => ({ id: 'school-1', financeCurrency: 'XAF' })) },
      studentYearAccounts: {
        findById: mock(async () => ({
          id: accountId,
          schoolId: 'school-1',
          academicYearId: 'year-1',
          currency: 'XAF',
        })),
      },
    } as never)
  })
})

describe('validatePaymentDelete', () => {
  test('blocks delete when attachments exist', async () => {
    await expect(validatePaymentDelete(payment, {
      attachments: { list: mock(async () => [{ id: 'att-1' }]) },
    } as never)).rejects.toMatchObject({
      code: 'PAYMENT_DELETE_BLOCKED',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('allows delete of a recorded payment without attachments', async () => {
    await validatePaymentDelete(payment, {
      attachments: { list: mock(async () => []) },
    } as never)
  })
})
