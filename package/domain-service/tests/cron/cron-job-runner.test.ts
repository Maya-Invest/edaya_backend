import { Assessment, AssessmentKind, MessageDeliveryRecipientKind, RecordingNotificationGateway } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'
import { buildNotificationDeliveryId } from '../../src/capabilities/notifications'
import { runCronJobs } from '../../src/capabilities/scheduling-jobs/cron-job-runner'
import { testFileStorage } from '../support/test-file-storage'

describe('scheduled notification runner with native scopes', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  afterEach(async () => {
    await fixture.db.close()
  })
  test('runs each school with the due-notification principal and produces correctly linked deliveries', async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE students SET subject_id = \'student-login\' WHERE id = \'student-a\'')
    await fixture.repositories.assessments.save(new Assessment({ id: 'due', classGroupId: 'class-a', classSubjectId: 'math-a', periodId: 'period-a', title: 'Midterm', kind: AssessmentKind.Homework, maxScore: 20, coefficient: 1, dueAt: new Date('2026-06-20') }))
    const gateway = new RecordingNotificationGateway()
    const application = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: gateway, fileStorage: testFileStorage })
    const summary = await runCronJobs(application, { asOf: new Date('2026-06-17T12:00:00Z'), jobKeys: ['processDueNotifications'] })
    expect(summary.results.map(result => [result.schoolId, result.result.processed])).toEqual([['school-a', 1], ['school-b', 0]])
    expect(gateway.enqueued).toHaveLength(1)
    const id = buildNotificationDeliveryId('school-a', 'assessment.due_soon:due', 'student-login', { kind: MessageDeliveryRecipientKind.Student, id: 'student-a' })
    expect(gateway.enqueued[0]?.idempotencyKey).toBe(id)
    const delivery = await fixture.repositories.messageDeliveries.findById(id)
    expect(delivery?.schoolId).toBe('school-a')
    expect(delivery?.recipientId).toBe('student-a')
  })
})
