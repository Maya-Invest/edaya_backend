import { describe, expect, test } from 'bun:test'
import { Guardian } from '../../../../src/entities/students/guardian'
import { GuardianContactMethod, GuardianContactMethodType } from '../../../../src/entities/students/guardian-contact-method'

describe('Guardian entity', () => {
  const baseArgs = {
    id: 'g1',
    schoolId: 's1',
    firstName: 'John',
    lastName: 'Doe',
  }

  test('instantiates successfully with basic inputs', () => {
    const guardian = new Guardian(baseArgs)
    expect(guardian.id).toBe('g1')
    expect(guardian.fullName).toBe('John Doe')
    expect(guardian.contactMethods.length).toBe(0)
    expect(guardian.phone).toBeUndefined()
    expect(guardian.email).toBeUndefined()
  })

  test('normalizes legacy phone and email to contactMethods', () => {
    const guardian = new Guardian({
      ...baseArgs,
      phone: '+123',
      email: 'john@example.com',
    })

    expect(guardian.contactMethods.length).toBe(2)
    expect(guardian.phone).toBe('+123')
    expect(guardian.email).toBe('john@example.com')
    // First one added gets primary if none exist
    expect(guardian.contactMethods[0]?.isPrimary).toBe(true)
    expect(guardian.contactMethods[1]?.isPrimary).toBe(false)
  })

  test('merges existing contactMethods with legacy fields and deduplicates', () => {
    const existingMethods = [
      new GuardianContactMethod({ type: GuardianContactMethodType.Phone, value: '+123', isPrimary: true }),
      new GuardianContactMethod({ type: GuardianContactMethodType.Email, value: 'OTHER@example.com' }),
    ]

    const guardian = new Guardian({
      ...baseArgs,
      phone: '+123', // duplicate
      email: 'Other@example.com', // duplicate, case insensitive for email
      contactMethods: existingMethods,
    })

    expect(guardian.contactMethods.length).toBe(2)
    expect(guardian.phone).toBe('+123')
    expect(guardian.email?.toLowerCase()).toBe('other@example.com')
    expect(guardian.contactMethods[0]?.isPrimary).toBe(true)
  })

  test('ensures at least one primary method if any exist', () => {
    const existingMethods = [
      new GuardianContactMethod({ type: GuardianContactMethodType.Phone, value: '+999' }),
      new GuardianContactMethod({ type: GuardianContactMethodType.Email, value: 'test@example.com' }),
    ]

    const guardian = new Guardian({
      ...baseArgs,
      contactMethods: existingMethods,
    })

    expect(guardian.contactMethods.length).toBe(2)
    expect(guardian.contactMethods[0]?.isPrimary).toBe(true)
    expect(guardian.contactMethods[1]?.isPrimary).toBe(false)
  })
})
