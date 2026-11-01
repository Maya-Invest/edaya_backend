import { GuardianStudentLink } from '@edaya/core'
import { expect, test } from 'bun:test'
import { fixture } from './support/marks-fixture'

test('native flat guardian profile patches preserve preferences and roll back child failures', async () => {
  const f = await fixture('flat-guardian')
  const guardian = await f.editor.studentWorkflow.registerGuardian({ id: f.id('guardian'), schoolId: f.id('school'), firstName: '', lastName: 'Parent', phone: '+225 01020304', alternativePhone: '+22505060708', smsNotificationsEnabled: false, sendAccountInvitation: false })
  await f.r.guardianLinks.save(new GuardianStudentLink({ id: f.id('link'), schoolId: f.id('school'), guardianId: guardian.id, studentId: f.id('student') }))
  await f.editor.studentWorkflow.updateGuardianProfile({ guardianId: guardian.id, phone: null, studentNotificationPreferences: [{ studentId: f.id('student'), receivesAttendanceAlerts: false }] })
  const before = (await f.r.guardians.findById(guardian.id))!
  expect(before.phone).toBeUndefined()
  expect(before.alternativePhone).toBe('+22505060708')
  expect(before.smsNotificationsEnabled).toBe(false)
  expect(before.pushNotificationsEnabled).toBe(true)
  await expect(f.editor.studentWorkflow.updateGuardianProfile({ guardianId: guardian.id, smsNotificationsEnabled: true, studentNotificationPreferences: [{ studentId: f.id('student'), receivesAttendanceAlerts: true }, { studentId: f.id('missing'), receivesAttendanceAlerts: true }] })).rejects.toThrow()
  expect((await f.r.guardians.findById(guardian.id))!.data).toEqual(before.data)
  expect((await f.r.guardianLinks.findById(f.id('link')))!.receivesAttendanceAlerts).toBe(false)
  await expect(f.editor.studentWorkflow.updateGuardianProfile({ guardianId: guardian.id, phone: '0022505060708' })).rejects.toMatchObject({ code: 'DUPLICATE_GUARDIAN_PHONE' })
}, 30000)
