import type { FixtureCatalogService, FixturePayment, FixtureStudentServiceEnrollment } from '../../../../src/datasets/types'
import { CatalogServiceCategory } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { demoCiCatalogServices } from '../../../../src/datasets/demo-ci/domains/finance'
import {
  demoCatalogServices,
  demoPayments,
  demoStudentServiceEnrollments,
} from '../../../../src/datasets/demo/domains/finance'
import { seedUpcomingDate } from '../../../../src/meta/dates'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, DEMO_CI_ACADEMIC_YEAR_ID } from '../../../../src/shared/ids'

describe('demo finance', () => {
  it('typed catalog services satisfy FixtureCatalogService', () => {
    const catalog = demoCatalogServices[0] satisfies FixtureCatalogService
    expect(catalog.defaultPrice).toBe(4800)
    expect(catalog.billingTerms.kind).toBe('one_time')
  })

  it('typed enrollments and payments are seed-oriented records', () => {
    const enrollment = demoStudentServiceEnrollments[0] satisfies FixtureStudentServiceEnrollment
    const payment = demoPayments[0] satisfies FixturePayment
    expect(enrollment.id).toBe('enr-60')
    expect(payment.id).toBe('pay-120')
    expect('studentFeeId' in payment).toBe(false)
  })

  it('covers deposit-only, unpaid, partial, paid, waived, cancelled, installments, and undated charges', () => {
    expect(demoCatalogServices.some(service => service.billingTerms.installments.length === 3)).toBe(true)
    expect(demoCatalogServices.some(service => service.id === 'cat-undated-lab' && !service.billingTerms.singleDueDate && service.billingTerms.installments.length === 0)).toBe(true)
    expect(demoStudentServiceEnrollments.some(row => row.id === 'svc-s9-waived' && row.waive)).toBe(true)
    expect(demoStudentServiceEnrollments.some(row => row.id === 'svc-s10-cancelled' && row.cancelCharge)).toBe(true)
    expect(demoPayments.some(row => row.id === 'pay-deposit-s29' && row.allocation?.mode === 'account_only')).toBe(true)
    expect(demoPayments.filter(row => row.studentId === 's6')).toHaveLength(5)
    expect(demoPayments.some(row => row.studentId === 's5' && row.amount === 4800)).toBe(true)
    expect(demoPayments.some(row => row.studentId === 's2' && row.amount === 1600)).toBe(true)
    expect(demoStudentServiceEnrollments.some(row => row.studentId === 's7')).toBe(true)
    expect(demoPayments.every(row => row.studentId !== 's7')).toBe(true)
    expect(demoStudentServiceEnrollments.find(row => row.id === 'svc-s7-sports')?.dueDate).toBe(`${seedUpcomingDate(2)}T12:00:00.000Z`)
  })

  it('covers reversed receipts, refunds, unallocated money, and two currencies', () => {
    expect(demoPayments.some(row => row.reversePayment)).toBe(true)
    expect(demoPayments.some(row => row.refund?.amount === 20_000)).toBe(true)
    expect(demoPayments.some(row => row.allocation?.mode === 'account_only' && row.amount === 5_000 && row.accountId?.endsWith(':USD'))).toBe(true)
    expect(demoCatalogServices.some(service => service.currency === 'EUR')).toBe(true)
    expect(demoCatalogServices.some(service => service.currency === 'USD')).toBe(true)
    expect(new Set(demoCatalogServices.map(service => service.category))).toContain(CatalogServiceCategory.Tuition)
  })

  it('includes the canonical 60_000 + 40_000 charges with a 120_000 FIFO receipt on new ids', () => {
    expect(demoCatalogServices.find(service => service.id === 'cat-tuition-60')?.defaultPrice).toBe(60_000)
    expect(demoCatalogServices.find(service => service.id === 'cat-transport-40')?.defaultPrice).toBe(40_000)
    expect(demoStudentServiceEnrollments.find(row => row.id === 'enr-60')?.catalogServiceId).toBe('cat-tuition-60')
    expect(demoStudentServiceEnrollments.find(row => row.id === 'enr-40')?.catalogServiceId).toBe('cat-transport-40')
    const receipt = demoPayments.find(row => row.id === 'pay-120')
    expect(receipt).toMatchObject({
      amount: 120_000,
      allocation: { mode: 'fifo' },
      reverseCausedAllocations: { chargeIds: ['enr-60'] },
    })
    expect(['f1', 'b1', 'pay-b1-1']).not.toContain(receipt?.id)
  })

  it('covers two academic years across demo and demo-ci datasets', () => {
    expect(demoCatalogServices.every(service => service.academicYearId === DEMO_CENTRAL_ACADEMIC_YEAR_ID)).toBe(true)
    expect(demoCiCatalogServices.every(service => service.academicYearId === DEMO_CI_ACADEMIC_YEAR_ID)).toBe(true)
    expect(DEMO_CI_ACADEMIC_YEAR_ID).not.toBe(DEMO_CENTRAL_ACADEMIC_YEAR_ID)
  })

  it('includes catalog services, enrollments, and payments', () => {
    expect(demoCatalogServices.length).toBeGreaterThan(0)
    expect(demoStudentServiceEnrollments.length).toBeGreaterThan(0)
    expect(demoPayments.length).toBeGreaterThan(0)
  })
})
