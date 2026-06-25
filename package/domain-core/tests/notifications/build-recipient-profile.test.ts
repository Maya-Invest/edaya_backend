import { describe, expect, test } from 'bun:test'
import {
  Guardian,
  GuardianContactMethod,
  GuardianContactMethodType,
  GuardianStudentLink,
  MessageDeliveryRecipientKind,
  StaffMember,
} from '../../src/domains'
import {
  buildGuardianRecipientProfile,
  buildStaffRecipientProfile,
} from '../../src/notifications/build-recipient-profile'

describe('build recipient profiles', () => {
  test('buildStaffRecipientProfile returns undefined without subjectId', () => {
    expect(buildStaffRecipientProfile(new StaffMember({
      id: 'st1',
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      isActive: true,
    }))).toBeUndefined()
  })

  test('buildStaffRecipientProfile maps active linked staff', () => {
    const profile = buildStaffRecipientProfile(new StaffMember({
      id: 'st1',
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@school.edu',
      subjectId: 'auth-st1',
      isActive: true,
    }))

    expect(profile).toMatchObject({
      schoolId: 'school-1',
      recipient: {
        kind: MessageDeliveryRecipientKind.Staff,
        id: 'st1',
        subjectId: 'auth-st1',
      },
      notificationEmail: undefined,
      fallbackEmail: 'ada@school.edu',
      preferences: {
        allowsNotifications: true,
        channels: { email: true, in_app: true },
      },
    })
  })

  test('buildGuardianRecipientProfile aggregates link preferences', () => {
    const guardian = new Guardian({
      id: 'g1',
      schoolId: 'school-1',
      firstName: 'Grace',
      lastName: 'Hopper',
      subjectId: 'auth-g1',
      contactMethods: [
        new GuardianContactMethod({
          type: GuardianContactMethodType.Email,
          value: 'grace@mail.com',
          isPrimary: true,
          allowsNotifications: true,
        }),
      ],
      premiumNotificationsEnabled: true,
    })
    const links = [
      new GuardianStudentLink({
        id: 'link-1',
        schoolId: 'school-1',
        guardianId: 'g1',
        studentId: 's1',
        receivesAcademicReports: true,
        receivesAttendanceAlerts: false,
      }),
      new GuardianStudentLink({
        id: 'link-2',
        schoolId: 'school-1',
        guardianId: 'g1',
        studentId: 's2',
        receivesAcademicReports: false,
        receivesAttendanceAlerts: true,
      }),
    ]

    const profile = buildGuardianRecipientProfile(guardian, links)

    expect(profile?.preferences).toMatchObject({
      receivesAcademicReports: true,
      receivesAttendanceAlerts: true,
      premiumNotificationsEnabled: true,
      channels: { email: true, sms: false, in_app: true },
    })
  })
})
