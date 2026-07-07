import { describe, expect, test } from 'bun:test'
import {
  guardianHasEmailContact,
  normalizeInvitationEmail,
  resolveInvitationContact,
  resolveInviteeDisplayName,
  resolveStudentInvitationEmail,
  resolveTeacherInvitationEmail,
} from '../../../src/capabilities/invitations/resolve-invitation-contact'
import {
  AccountInvitationContactChannel,
  Guardian,
  GuardianContactMethod,
  GuardianContactMethodType,
  StaffMember,
  Student,
  Teacher,
} from '../../../src/domain'

describe('resolve invitation contact helpers', () => {
  test('normalizeInvitationEmail trims and lowercases addresses', () => {
    expect(normalizeInvitationEmail('  Ada@School.edu ')).toBe('ada@school.edu')
    expect(normalizeInvitationEmail('   ')).toBeUndefined()
  })

  test('resolveInvitationContact prefers explicit email and phone values', () => {
    const staff = new StaffMember({
      id: 'st1',
      schoolId: 'sch1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@school.edu',
      isActive: true,
    })

    expect(resolveInvitationContact(
      AccountInvitationContactChannel.Email,
      'Override@School.edu',
      staff,
    )).toBe('override@school.edu')

    expect(resolveInvitationContact(
      AccountInvitationContactChannel.Phone,
      ' +22501020304 ',
    )).toBe('+22501020304')
  })

  test('resolveTeacherInvitationEmail and resolveStudentInvitationEmail normalize explicit values', () => {
    const teacher = new Teacher({
      id: 't1',
      schoolId: 'sch1',
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@school.edu',
      isActive: true,
    })

    expect(resolveTeacherInvitationEmail(teacher)).toBe('alan@school.edu')
    expect(resolveStudentInvitationEmail(' Student@School.edu ')).toBe('student@school.edu')
  })

  test('guardianHasEmailContact detects email contact methods and legacy email fields', () => {
    const withMethod = new Guardian({
      id: 'g1',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      contactMethods: [
        new GuardianContactMethod({
          type: GuardianContactMethodType.Email,
          value: 'grace@mail.com',
        }),
      ],
    })
    const withLegacyEmail = new Guardian({
      id: 'g2',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@mail.com',
    })

    expect(guardianHasEmailContact(withMethod)).toBe(true)
    expect(guardianHasEmailContact(withLegacyEmail)).toBe(true)
    expect(guardianHasEmailContact(new Guardian({
      id: 'g3',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
    }))).toBe(false)
  })

  test('resolveInviteeDisplayName renders actor display names', () => {
    expect(resolveInviteeDisplayName(new Student({
      id: 's1',
      schoolId: 'sch1',
      firstName: 'Alan',
      lastName: 'Turing',
    }))).toBe('Alan Turing')
  })
})
