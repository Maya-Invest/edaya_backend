import { Assessment, AssessmentKind, MessageDeliveryRecipientKind, RecordingNotificationGateway } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'
import { createTestStaffActor } from '../support/test-actor'
import { testFileStorage } from '../support/test-file-storage'

const dueAt = new Date('2026-06-20T00:00:00Z')
function assessment() {
  return new Assessment({ id: 'new-assessment', classGroupId: 'class-a', classSubjectId: 'math-a', periodId: 'period-a', title: 'Homework', kind: AssessmentKind.Homework, maxScore: 20, coefficient: 1, dueAt })
}

describe('assessment notification postSave hook through native authorization', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let gateway: RecordingNotificationGateway
  let service: SchoolService
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'subject-test\' WHERE id = \'school-a\'; UPDATE staff_members SET subject_id = \'subject-test\' WHERE id = \'staff-a\'; UPDATE students SET subject_id = \'student-login\' WHERE id = \'student-a\'; DELETE FROM guardian_student_links;')
    gateway = new RecordingNotificationGateway()
    service = new SchoolService({ actor: createTestStaffActor('school-a', 'staff-a'), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: gateway, fileStorage: testFileStorage })
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  test('saves the assessment and profile-bound delivery before enqueueing a due-soon job', async () => {
    await service.baseService.entities.assessments.save(assessment())
    expect(await fixture.repositories.assessments.findById('new-assessment')).toBeDefined()
    expect(gateway.enqueued).toHaveLength(1)
    const delivery = (await fixture.repositories.messageDeliveries.list())[0]!
    expect(gateway.enqueued[0]?.idempotencyKey).toBe(delivery.id)
    expect(delivery.subjectId).toBe('student-login')
    expect(gateway.enqueued[0]?.recipients).toEqual([{ kind: MessageDeliveryRecipientKind.Student, id: 'student-a', subjectId: 'student-login' }])
  })

  test('does not enqueue on a save with unchanged dueAt', async () => {
    await fixture.repositories.assessments.save(assessment())
    await service.baseService.entities.assessments.save(assessment())
    expect(gateway.enqueued).toHaveLength(0)
    expect(await fixture.repositories.messageDeliveries.count()).toBe(0)
  })
})
