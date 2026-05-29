import { describe, expect, test } from 'bun:test'
import { GuardianContactMethod, GuardianContactMethodType } from '../../../../src/entities/students/guardian-contact-method'

describe('GuardianContactMethod entity', () => {
  test('instantiates successfully with valid inputs', () => {
    const method = new GuardianContactMethod({
      type: GuardianContactMethodType.Phone,
      value: '+1234567890',
      label: 'Mobile',
      isPrimary: true,
      allowsNotifications: false,
    })

    expect(method.type).toBe(GuardianContactMethodType.Phone)
    expect(method.value).toBe('+1234567890')
    expect(method.label).toBe('Mobile')
    expect(method.isPrimary).toBe(true)
    expect(method.allowsNotifications).toBe(false)
  })

  test('uses defaults for isPrimary and allowsNotifications', () => {
    const method = new GuardianContactMethod({
      type: GuardianContactMethodType.Email,
      value: 'test@example.com',
    })

    expect(method.isPrimary).toBe(false)
    expect(method.allowsNotifications).toBe(true)
    expect(method.label).toBeUndefined()
  })

  test('throws error if value is blank', () => {
    expect(() => {
      new GuardianContactMethod({
        type: GuardianContactMethodType.Phone,
        value: '   ',
      })
    }).toThrow('value must not be blank')
  })

  test('throws error if label is blank', () => {
    expect(() => {
      new GuardianContactMethod({
        type: GuardianContactMethodType.Phone,
        value: '123',
        label: '  ',
      })
    }).toThrow('label must not be blank')
  })
})
