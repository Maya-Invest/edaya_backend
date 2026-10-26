import { Guardian, guardianUpdateSchema } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('flat guardian contacts', () => {
  const base = { id: 'g1', schoolId: 's1', firstName: 'John', lastName: 'Doe' }
  test('contacts are optional and new preferences are enabled', () => {
    const guardian = new Guardian(base)
    expect(guardian.phone).toBeUndefined()
    expect(guardian.email).toBeUndefined()
    expect(guardian.alternativePhone).toBeUndefined()
    expect(guardian.emailNotificationsEnabled).toBe(true)
    expect(guardian.smsNotificationsEnabled).toBe(true)
    expect(guardian.pushNotificationsEnabled).toBe(true)
  })
  test('normalizes all entry points without changing explicit opt-outs', () => {
    const guardian = new Guardian({ ...base, phone: ' #225 07-1234-5678 ', alternativePhone: '00225 01 1234 5678', email: ' JOHN@example.com ', smsNotificationsEnabled: false, pushNotificationsEnabled: false })
    expect(guardian.phone).toBe('+2250712345678')
    expect(guardian.alternativePhone).toBe('+2250112345678')
    expect(guardian.email).toBe('john@example.com')
    expect(guardian.smsNotificationsEnabled).toBe(false)
    expect(guardian.pushNotificationsEnabled).toBe(false)
  })
  test('rejects duplicate normalized numbers and invalid contacts', () => {
    expect(() => new Guardian({ ...base, phone: '+225 0712345678', alternativePhone: '002250712345678' })).toThrow('must be different')
    expect(() => new Guardian({ ...base, email: 'invalid' })).toThrow()
    expect(() => new Guardian({ ...base, phone: 'invalid' })).toThrow()
  })
  test('null clears contacts; partial schema does not inject default preferences', () => {
    const guardian = new Guardian({ ...base, phone: null, alternativePhone: null, email: null })
    expect(guardian.phone).toBeUndefined()
    expect(guardian.alternativePhone).toBeUndefined()
    expect(guardian.email).toBeUndefined()
    expect(guardianUpdateSchema.parse({ id: 'g1', phone: null })).not.toHaveProperty('smsNotificationsEnabled')
  })
})

test('single-token guardians retain an empty first name and require a last name', () => {
  const guardian = new Guardian({ id: 'single', schoolId: 's1', firstName: '  ', lastName: ' Koné ', sourceFullName: ' Koné ' })
  expect(guardian.firstName).toBe('')
  expect(guardian.fullName).toBe('Koné')
  expect(guardian.sourceFullName).toBe(' Koné ')
  expect(guardianUpdateSchema.parse({ id: 'single', occupation: 'Teacher' })).not.toHaveProperty('firstName')
  expect(guardianUpdateSchema.parse({ id: 'single', firstName: '' }).firstName).toBe('')
  expect(() => new Guardian({ id: 'bad', schoolId: 's1', firstName: '', lastName: ' ' })).toThrow()
})
