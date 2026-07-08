import { Guardian, GuardianContactMethod, GuardianContactMethodType, GuardianStudentLink, MessageDeliveryRecipientKind, StaffMember, Student, Teacher } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import {
  buildGuardianRecipientProfile,
  buildStaffRecipientProfile,
  buildStudentRecipientProfile,
  buildTeacherRecipientProfile,
} from '../../src/capabilities/notifications/delivery/build-recipient-profile'

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
      channels: { email: true, sms: false, in_app: true },
    })
  })

  test('buildGuardianRecipientProfile returns undefined when portal access is disabled', () => {
    const guardian = new Guardian({
      id: 'g2',
      schoolId: 'school-1',
      firstName: 'Grace',
      lastName: 'Hopper',
      subjectId: 'auth-g2',
      hasAccess: false,
    })

    expect(buildGuardianRecipientProfile(guardian, [])).toBeUndefined()
  })

  test('buildStudentRecipientProfile maps linked students for in-app delivery', () => {
    const profile = buildStudentRecipientProfile(new Student({
      id: 's1',
      schoolId: 'school-1',
      firstName: 'Alan',
      lastName: 'Turing',
      subjectId: 'auth-s1',
    }))

    expect(profile).toMatchObject({
      recipient: {
        kind: MessageDeliveryRecipientKind.Student,
        id: 's1',
        subjectId: 'auth-s1',
      },
      preferences: {
        allowsNotifications: true,
        channels: { in_app: true },
      },
    })
  })

  test('buildTeacherRecipientProfile maps active linked teachers', () => {
    const profile = buildTeacherRecipientProfile(new Teacher({
      id: 't1',
      schoolId: 'school-1',
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@school.edu',
      subjectId: 'auth-t1',
      isActive: true,
    }))

    expect(profile).toMatchObject({
      recipient: {
        kind: MessageDeliveryRecipientKind.Teacher,
        id: 't1',
        subjectId: 'auth-t1',
      },
      fallbackEmail: 'alan@school.edu',
      preferences: {
        allowsNotifications: true,
        channels: { email: true, in_app: true },
      },
    })
  })
})
