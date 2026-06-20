import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_FEES,
  SEED_PAYMENTS,
  SEED_STUDENT_FEES,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev finance seed', (getContext) => {
  it('seeds fees, student fees, payments and lets the director list finance entities', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.fees).toBe(SEED_FEES.length)
    expect(seedResult.studentFees).toBe(SEED_STUDENT_FEES.length)
    expect(seedResult.payments).toBe(SEED_PAYMENTS.length)

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [feesResponse, studentFeesResponse, paymentsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/fees/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/student-fees/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/payments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(feesResponse.status).toBe(200)
    expect(studentFeesResponse.status).toBe(200)
    expect(paymentsResponse.status).toBe(200)

    const fees = unwrapEntityList<{ name: string }>(await feesResponse.json())
    const studentFees = unwrapEntityList<{ studentId: string }>(await studentFeesResponse.json())
    const payments = unwrapEntityList<{ studentFeeId: string }>(await paymentsResponse.json())

    expect(fees.length).toBeGreaterThanOrEqual(SEED_FEES.length)
    expect(studentFees.length).toBeGreaterThanOrEqual(SEED_STUDENT_FEES.length)
    expect(payments.length).toBeGreaterThanOrEqual(SEED_PAYMENTS.length)
    expect(fees.some(fee => fee.name === 'Tuition — Middle School')).toBe(true)
    expect(studentFees.some(fee => fee.studentId === 's1')).toBe(true)
    expect(studentFees.some(fee => fee.studentId === 's9')).toBe(true)
    expect(payments.some(payment => payment.studentFeeId === 'b1')).toBe(true)
    expect(payments.some(payment => payment.studentFeeId === 'b7')).toBe(true)
  })
})
