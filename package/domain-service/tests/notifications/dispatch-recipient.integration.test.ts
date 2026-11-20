import type { NotificationDispatchRequest } from '@edaya/core'
import { createSystemActorMetadata } from '@edaya/authorization'
import { Announcement, AnnouncementStatus, AnnouncementTarget, AnnouncementTargetKind, MessageDelivery, MessageDeliveryRecipientKind, RecordingNotificationGateway } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createNotifyNotificationGateway, createNotifyRuntimeFromDrizzle, drainPendingSchoolNotifications } from '../../../adaptor-notify/src'
import { seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'
import { resolveNotificationDispatchRecipient } from '../../src/capabilities/notifications'
import { BaseSchoolService } from '../../src/services/base-school-service'
import { testFileStorage } from '../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const guardian = MessageDeliveryRecipientKind.Guardian
const staff = MessageDeliveryRecipientKind.Staff
const student = MessageDeliveryRecipientKind.Student

describe('delayed notification dispatch uses current business facts', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let base: BaseSchoolService
  let contactReads: number
  beforeEach(async () => {
    contactReads = 0
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec(`UPDATE students SET subject_id = 'person-a' WHERE id = 'student-a';
      UPDATE staff_members SET notification_email = 'staff@example.test' WHERE id = 'staff-a';
      UPDATE guardians SET email = 'guardian@example.test' WHERE id = 'guardian-a';`)
    base = new BaseSchoolService({
      actor: createSystemActorMetadata({ systemId: 'notify-adapter', schoolId: 'school-a', reason: 'Dispatch fixture', requestId: 'dispatch-test' }),
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      notificationGateway: new RecordingNotificationGateway(),
      fileStorage: testFileStorage,
      authContactResolver: { resolveBySubjectId: async () => {
        contactReads++
        return { email: 'login@example.test' }
      } },
    })
    await fixture.repositories.announcements.save(new Announcement({ id: 'notice', schoolId: 'school-a', title: 'Private', content: 'Class news', status: AnnouncementStatus.Published, publishedAt: new Date() }))
    await fixture.repositories.announcementTargets.save(new AnnouncementTarget({ id: 'target', announcementId: 'notice', targetKind: AnnouncementTargetKind.ClassGroup, targetId: 'class-a' }))
  })
  afterEach(async () => releaseDatabase(fixture.db))

  async function request(kind = guardian, eventKey = 'announcement.published', metadata: Record<string, string> = {}, sourceKey = 'notice'): Promise<NotificationDispatchRequest> {
    const deliveryId = `dispatch-${kind}`
    await fixture.repositories.messageDeliveries.save(new MessageDelivery({
      id: deliveryId,
      schoolId: 'school-a',
      subjectId: 'person-a',
      recipientKind: kind,
      recipientId: `${kind}-a`,
      announcementId: eventKey === 'announcement.published' ? 'notice' : undefined,
      eventKey,
      sourceKey,
      title: 'Private',
      body: 'Details',
    }))
    return { deliveryId, schoolId: 'school-a', subjectId: 'person-a', eventKey, metadata }
  }
  const resolve = (input: NotificationDispatchRequest) => resolveNotificationDispatchRecipient(base, input)

  test('guardian canonical contacts avoid login-contact resolution; staff behavior is preserved', async () => {
    expect((await resolve(await request(guardian)))?.email).toBe('guardian@example.test')
    expect(contactReads).toBe(0)
    await fixture.db.exec('UPDATE announcement_targets SET target_kind = \'school\', target_id = NULL WHERE id = \'target\'')
    expect((await resolve(await request(staff)))?.email).toBe('staff@example.test')
    expect(contactReads).toBe(1)
  })

  test.each([true, false])('shared login keeps exact profile contact and preference (guardian: %s)', async (guardianEnabled) => {
    await fixture.db.exec('UPDATE announcement_targets SET target_kind = \'school\', target_id = NULL WHERE id = \'target\'')
    const inputs = [await request(guardian), await request(staff)]
    const sent: string[] = []
    const db = fixture.connection
    const email = {
      send: async (input: { to: string }) => {
        sent.push(input.to)
        return {}
      },
    }
    const runtime = createNotifyRuntimeFromDrizzle({ db, env: {}, resolveSchoolRecipient: resolve, email, sms: { implemented: false, send: async () => ({ status: 'rejected' as const, reason: 'SMS_UNIMPLEMENTED', retryable: false }) } })
    const gateway = createNotifyNotificationGateway({ runtime })
    for (const input of inputs) await gateway.enqueue({ idempotencyKey: input.deliveryId, schoolId: input.schoolId, kind: 'event', eventKey: input.eventKey, title: 'Private', body: 'Details', recipients: [{ kind: input.deliveryId.endsWith('staff') ? staff : guardian, id: input.deliveryId.endsWith('staff') ? 'staff-a' : 'guardian-a', subjectId: input.subjectId }] })
    await fixture.db.exec('UPDATE guardians SET email = \'new-guardian@example.test\' WHERE id = \'guardian-a\'')
    if (!guardianEnabled)
      await fixture.db.exec('UPDATE guardians SET email_notifications_enabled = false WHERE id = \'guardian-a\'')
    await drainPendingSchoolNotifications(runtime)
    expect(sent.sort()).toEqual(guardianEnabled ? ['new-guardian@example.test', 'staff@example.test'] : ['staff@example.test'])
    expect(await runtime.sql.query('SELECT * FROM notify.recipients')).toEqual([])
  })

  test.each([
    'DELETE FROM guardian_student_links WHERE id = \'guardian-link\'',
    'UPDATE student_class_enrollments SET status = \'closed\', ended_at = now() WHERE id = \'enrollment-a\'',
    'UPDATE guardians SET has_access = false WHERE id = \'guardian-a\'',
    'UPDATE guardians SET subject_id = \'new-login\' WHERE id = \'guardian-a\'',
    'UPDATE students SET status = \'inactive\' WHERE id = \'student-a\'',
    'UPDATE announcements SET status = \'draft\' WHERE id = \'notice\'',
    'UPDATE announcement_targets SET target_id = \'class-other\' WHERE id = \'target\'',
    'UPDATE academic_years SET status = \'archived\' WHERE id = \'year-a\'',
  ])('revokes queued class news after %s', async (mutation) => {
    const input = await request()
    expect((await resolve(input))?.email).toBe('guardian@example.test')
    await fixture.db.exec(mutation)
    expect(await resolve(input)).toBeUndefined()
  })

  test('wrong tenant, subject, event and unknown source fail closed', async () => {
    const input = await request()
    for (const changes of [{ schoolId: 'school-b' }, { subjectId: 'person-b' }, { eventKey: 'unknown.event' }])
      expect(await resolve({ ...input, ...changes })).toBeUndefined()
    await fixture.db.exec('DELETE FROM message_deliveries')
    expect(await resolve(await request(guardian, 'unknown.event', {}, 'unknown.event:source'))).toBeUndefined()
  })

  test('homework rechecks student enrollment and completion at send time', async () => {
    await fixture.db.exec('UPDATE assessments SET due_at = NOW() + INTERVAL \'2 days\' WHERE id = \'assessment-math\'')
    const input = await request(student, 'assessment.due_soon', { assessmentId: 'assessment-math' }, 'assessment.due_soon:assessment-math')
    expect((await resolve(input))?.recipient.id).toBe('student-a')
    await fixture.db.exec('UPDATE assessments SET completed_at = NOW() WHERE id = \'assessment-math\'')
    expect(await resolve(input)).toBeUndefined()
  })

  async function sourceRecords() {
    await fixture.db.exec('UPDATE assessments SET marks_status = \'submitted\' WHERE id = \'assessment-math\'')
    await fixture.db.exec(`
      INSERT INTO grade_scales (id, school_id, name, short_name, min_score, max_score, ranges, is_default, created_at) VALUES ('scale', 'school-a', 'Scale', 'Scale', 0, 20, '[]', true, NOW());
      INSERT INTO report_card_results (id, student_id, class_group_id, period_id, grade_level_id, academic_year_id, report_configuration_revision, section_results, attendance_summary, assessment_result_count, status, generated_at, published_at)
        VALUES ('report', 'student-a', 'class-a', 'period-a', 'level-a', 'year-a', 0, '[]', '{"presentCount":0,"absenceCount":0,"excusedAbsenceCount":0,"lateCount":0}', 1, 'published', NOW(), NOW());
      INSERT INTO calendar_events (id, school_id, academic_year_id, title, start_date, end_date, kind, is_non_school_day, scope_kind, scope_id, created_at)
        VALUES ('calendar', 'school-a', 'year-a', 'Class event', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', 'event', false, 'class_group', 'class-a', NOW());
      INSERT INTO activities (id, school_id, name, short_name, category, coach, schedule, participants, capacity, description, start_date, end_date, created_at)
        VALUES ('activity', 'school-a', 'Football', 'Football', 'Sport', 'Coach', 'Monday', 1, 20, 'Sport', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', NOW());
      INSERT INTO activity_enrollments VALUES ('activity-enrollment', 'activity', 'student-a', 'approved', NOW());
      INSERT INTO incidents (id, school_id, title, description, date, kind, reporter_id, class_group_id, status, created_at, updated_at)
        VALUES ('incident', 'school-a', 'Notice', 'Details', NOW(), 'minor_infraction', 'staff-a', 'class-a', 'open', NOW(), NOW());
      INSERT INTO student_incident_involvements (id, student_id, incident_id, role, created_at) VALUES ('involvement', 'student-a', 'incident', 'subject', NOW());
      INSERT INTO attendance_records (id, student_id, assessment_id, date, status, justification_status, created_at, updated_at)
        VALUES ('attendance', 'student-a', 'assessment-math', NOW(), 'absent', 'pending', NOW(), NOW());
    `)
  }

  test.each([
    ['assessment.result_recorded', '1-math:0', { assessmentResultId: '1-math', assessmentId: 'assessment-math', marksRevision: '0' }, 'DELETE FROM assessment_results WHERE id = \'1-math\''],
    ['report_card.published', 'report', { reportCardResultId: 'report' }, 'UPDATE guardian_student_links SET receives_academic_reports = false WHERE id = \'guardian-link\''],
    ['calendar.event_reminder', 'calendar', { calendarEventId: 'calendar' }, 'UPDATE calendar_events SET scope_id = \'class-other\' WHERE id = \'calendar\''],
    ['activity.reminder', 'activity', { activityId: 'activity' }, 'UPDATE activity_enrollments SET status = \'denied\' WHERE id = \'activity-enrollment\''],
    ['incident.recorded', 'incident:student-a', { incidentId: 'incident', studentId: 'student-a' }, 'DELETE FROM student_incident_involvements WHERE id = \'involvement\''],
  ] as const)('%s revalidates its source before dispatch', async (eventKey, source, metadata, mutation) => {
    await sourceRecords()
    const input = await request(guardian, eventKey, metadata, `${eventKey}:${source}`)
    expect((await resolve(input))?.recipient.id).toBe('guardian-a')
    await fixture.db.exec(mutation)
    expect(await resolve(input)).toBeUndefined()
  })

  test.each([
    'DELETE FROM class_activity_enrollments WHERE id = \'class-placement\'',
    'UPDATE student_class_enrollments SET status = \'closed\', ended_at = now() WHERE id = \'enrollment-a\'',
    'UPDATE academic_years SET status = \'archived\' WHERE id = \'year-a\'',
  ])('class activity reminders revoke access after %s', async (mutation) => {
    await sourceRecords()
    await fixture.db.exec(`
      DELETE FROM activity_enrollments WHERE id = 'activity-enrollment';
      INSERT INTO class_activity_enrollments (id, activity_id, class_group_id, created_at)
        VALUES ('class-placement', 'activity', 'class-a', NOW());
    `)
    const input = await request(guardian, 'activity.reminder', { activityId: 'activity' }, 'activity.reminder:activity')
    expect((await resolve(input))?.recipient.id).toBe('guardian-a')
    await fixture.db.exec(mutation)
    expect(await resolve(input)).toBeUndefined()
  })

  test('attendance notices honor the exact link opt-out and corrected source', async () => {
    await sourceRecords()
    const row = await fixture.repositories.attendance.findById('attendance')
    const metadata = { studentId: 'student-a', anchorKey: row!.anchorKey, status: 'absent' }
    const input = await request(guardian, 'attendance.recorded', metadata, `attendance.recorded:student-a:${row!.anchorKey}:absent`)
    expect((await resolve(input))?.recipient.id).toBe('guardian-a')
    await fixture.db.exec('UPDATE guardian_student_links SET receives_attendance_alerts = false WHERE id = \'guardian-link\'')
    expect(await resolve(input)).toBeUndefined()
    await fixture.db.exec('UPDATE guardian_student_links SET receives_attendance_alerts = true WHERE id = \'guardian-link\'; UPDATE attendance_records SET status = \'present\', justification_status = \'none\' WHERE id = \'attendance\'')
    expect(await resolve(input)).toBeUndefined()
  })

  test('revoking access after email prevents push in the same dispatch', async () => {
    const input = await request()
    const db = fixture.connection
    let emails = 0
    let pushes = 0
    const runtime = createNotifyRuntimeFromDrizzle({
      db,
      env: {},
      resolveSchoolRecipient: resolve,
      email: { send: async () => {
        emails++
        await fixture.db.exec('DELETE FROM guardian_student_links WHERE id = \'guardian-link\'')
        return {}
      } },
      sms: { implemented: false, send: async () => ({ status: 'rejected' as const, reason: 'SMS_UNIMPLEMENTED', retryable: false }) },
      fcm: { send: async () => {
        pushes++
        return {}
      } },
    })
    const gateway = createNotifyNotificationGateway({ runtime })
    await gateway.registerPushDevice!({ appId: 'guardian', installationId: 'device-1', profileKind: 'guardian', profileId: 'guardian-a', schoolId: 'school-a', subjectId: 'person-a', provider: 'fcm', token: 'test-token' })
    await gateway.enqueue({ idempotencyKey: input.deliveryId, schoolId: input.schoolId, kind: 'event', eventKey: input.eventKey, title: 'Private', body: 'Details', recipients: [{ kind: guardian, id: 'guardian-a', subjectId: input.subjectId }] })
    await drainPendingSchoolNotifications(runtime)
    expect(emails).toBe(1)
    expect(pushes).toBe(0)
    expect(await runtime.sql.query('SELECT status FROM notify.jobs')).toEqual([{ status: 'sent' }])
  })
})
