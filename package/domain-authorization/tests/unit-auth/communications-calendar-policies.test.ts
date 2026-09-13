import type { MessageDeliveryRecipientKind } from '@edaya/core'
import { AccessPolicies, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Announcement, AnnouncementStatus, AnnouncementTarget, CalendarEvent, CalendarEventKind, CalendarEventScopeKind, Guardian, MessageDelivery, Permission, StaffPermissionAssignment, AnnouncementTargetKind as Target } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'

const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'communications', authenticatedAt: new Date() }
const actors = [
  createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }),
  createStudentActorMetadata({ ...identity, studentId: 'student-a' }),
  createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }),
  createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' }),
] as const

describe('communications and calendar scope boundaries', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\'')
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  async function announcement(id: string, targetKind: Target, targetId?: string, extra = {}) {
    await fixture.repositories.announcements.save(new Announcement({ id, schoolId: 'school-a', title: id, content: id, status: AnnouncementStatus.Published, publishedAt: new Date('2000-01-01'), ...extra }))
    await fixture.repositories.announcementTargets.save(new AnnouncementTarget({ id: `target-${id}`, announcementId: id, targetKind, targetId }))
  }

  test.each([...actors])('$kind announcement reads include only their published audience before pagination and counts', async (actor) => {
    for (const [id, kind, targetId] of [
      ['school', Target.School],
      ['all-staff', Target.AllStaff],
      ['all-guardians', Target.AllGuardians],
      ['all-students', Target.AllStudents],
      ['own-staff', Target.StaffMember, 'staff-a'],
      ['own-guardian', Target.Guardian, 'guardian-a'],
      ['own-student', Target.Student, 'student-a'],
      ['class', Target.ClassGroup, 'class-a'],
      ['level', Target.GradeLevel, 'level-a'],
      ['other-class', Target.ClassGroup, 'class-other'],
      ['foreign-level', Target.GradeLevel, 'level-b'],
      ['foreign-student', Target.Student, 'student-b'],
    ] as const) await announcement(id, kind, targetId)
    await announcement('expired', Target.School, undefined, { expiresAt: new Date('2001-01-01') })
    await announcement('draft', Target.School, undefined, { status: AnnouncementStatus.Draft, publishedAt: undefined })
    await announcement('archived', Target.School, undefined, { status: AnnouncementStatus.Archived })
    await announcement('foreign', Target.School, undefined, { schoolId: 'school-b' })
    const expected = {
      guardian: ['all-guardians', 'class', 'level', 'own-guardian', 'school'],
      student: ['all-students', 'class', 'level', 'own-student', 'school'],
      teacher: ['class', 'level', 'school'],
      staff: ['all-staff', 'own-staff', 'school'],
    }[actor.kind]
    const access = new AccessPolicies(actor, fixture.repositories)
    for (const resource of ['announcements', 'announcementTargets'] as const) {
      const repository = fixture.repositories[resource].forAccess(await access.entity(resource).readScope())
      const ids = expected.map(id => resource === 'announcements' ? id : `target-${id}`)
      expect((await repository.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(ids)
      expect(await repository.count()).toBe(ids.length)
      expect((await repository.list({ $offset: ids.length - 1, $limit: 1, $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(ids.slice(-1))
      expect(await repository.findById(resource === 'announcements' ? 'other-class' : 'target-other-class')).toBeUndefined()
      expect(await repository.findById(resource === 'announcements' ? 'foreign' : 'target-foreign')).toBeUndefined()
    }
  })

  test.each([...actors])('$kind personal deliveries require the exact selected profile and original subject', async (actor) => {
    for (const recipient of actors) {
      await fixture.repositories.messageDeliveries.save(new MessageDelivery({
        id: recipient.kind,
        schoolId: 'school-a',
        subjectId: 'person-a',
        title: 'Private',
        body: 'Message',
        recipientKind: recipient.kind as MessageDeliveryRecipientKind,
        recipientId: recipient.actorId,
      }))
    }
    await fixture.repositories.messageDeliveries.save(new MessageDelivery({ id: 'previous-login', schoolId: 'school-a', subjectId: 'person-old', title: 'Old', body: 'Private', recipientKind: actor.kind as MessageDeliveryRecipientKind, recipientId: actor.actorId }))
    const access = new AccessPolicies(actor, fixture.repositories)
    const scope = await access.entity('messageDeliveries').readScope()
    expect((await fixture.repositories.messageDeliveries.forAccess(scope).list()).map(row => row.id)).toEqual([actor.kind])
    expect(await fixture.repositories.messageDeliveries.forAccess(scope).count()).toBe(1)
    await access.communications.assertMarkRead((await fixture.repositories.messageDeliveries.findById(actor.kind))!)
    for (const id of [...actors.filter(other => other.kind !== actor.kind).map(other => other.kind), 'previous-login'])
      await expect(access.communications.assertMarkRead((await fixture.repositories.messageDeliveries.findById(id))!)).rejects.toThrow()
    if (actor.kind === 'guardian') {
      await fixture.repositories.guardianLinks.delete('guardian-link')
      await access.communications.assertOwnAccount()
      await announcement('school', Target.School)
      await announcement('class', Target.ClassGroup, 'class-a')
      expect((await fixture.repositories.announcements.forAccess(await access.entity('announcements').readScope()).list()).map(row => row.id)).toEqual(['school'])
    }
  })

  test('a visible announcement does not disclose its other direct recipients', async () => {
    await fixture.repositories.guardians.save(new Guardian({ id: 'other-guardian', schoolId: 'school-a', firstName: 'Other', lastName: 'Guardian' }))
    await announcement('mixed', Target.Guardian, 'guardian-a')
    await fixture.repositories.announcementTargets.save(new AnnouncementTarget({ id: 'private-target', announcementId: 'mixed', targetKind: Target.Guardian, targetId: 'other-guardian' }))
    const access = new AccessPolicies(actors[0], fixture.repositories)
    expect(await fixture.repositories.announcements.forAccess(await access.entity('announcements').readScope()).count()).toBe(1)
    expect((await fixture.repositories.announcementTargets.forAccess(await access.entity('announcementTargets').readScope()).list()).map(target => target.id)).toEqual(['target-mixed'])
    const before = (await fixture.repositories.guardians.findById('guardian-a'))!
    await expect(access.communications.assertContactUpdate('guardians', before, new Guardian({ ...before.data, contactMethods: [...before.contactMethods], hasAccess: false }))).rejects.toThrow()
  })

  async function calendars() {
    for (const [id, scopeKind, scopeId, schoolId, academicYearId] of [
      ['class', CalendarEventScopeKind.ClassGroup, 'class-a', 'school-a', 'year-a'],
      ['level', CalendarEventScopeKind.GradeLevel, 'level-a', 'school-a', 'year-a'],
      ['school', CalendarEventScopeKind.School, undefined, 'school-a', 'year-a'],
      ['unrelated', CalendarEventScopeKind.ClassGroup, 'class-other', 'school-a', 'year-a'],
      ['old', CalendarEventScopeKind.School, undefined, 'school-a', 'year-old'],
      ['foreign', CalendarEventScopeKind.School, undefined, 'school-b', 'year-b'],
    ] as const) await fixture.repositories.calendarEvents.save(new CalendarEvent({ id, schoolId, academicYearId, title: id, kind: CalendarEventKind.Event, scopeKind, scopeId, startDate: new Date('2026-05-01'), endDate: new Date('2026-05-01') }))
  }

  test.each(actors.slice(0, 3))('$kind calendar includes current school, grade and class context without unrelated events', async (actor) => {
    await calendars()
    const access = new AccessPolicies(actor, fixture.repositories)
    const repository = fixture.repositories.calendarEvents.forAccess(await access.entity('calendarEvents').readScope())
    expect((await repository.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(['class', 'level', 'school'])
    expect(await repository.count()).toBe(3)
    expect(await repository.findById('unrelated')).toBeUndefined()
    expect(await repository.list({ $offset: 3, $limit: 1 })).toEqual([])
    if (actor.kind === 'teacher') {
      await fixture.repositories.teacherAssignments.delete('teaching')
      expect(await fixture.repositories.calendarEvents.forAccess(await access.entity('calendarEvents').readScope()).count()).toBe(0)
    }
  })

  test('class timetable grants can mutate their class event but cannot change school, grade, unrelated or proposed placements', async () => {
    await calendars()
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'calendar-writer', staffId: 'staff-a', schoolId: 'school-a', permission: Permission.TIMETABLE_UPDATE, academicYearId: 'year-a', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    const access = new AccessPolicies(actors[3], fixture.repositories)
    const before = (await fixture.repositories.calendarEvents.findById('class'))!
    await access.entity('calendarEvents').assertSave(before, before)
    for (const id of ['level', 'school', 'unrelated', 'old', 'foreign']) {
      const event = (await fixture.repositories.calendarEvents.findById(id))!
      await expect(access.entity('calendarEvents').assertSave(event, event)).rejects.toThrow()
    }
    await expect(access.entity('calendarEvents').assertSave(new CalendarEvent({ ...before.data, scopeKind: CalendarEventScopeKind.School, scopeId: undefined }), before)).rejects.toThrow()
  })
})
