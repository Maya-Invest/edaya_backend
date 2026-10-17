import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { StaffPermissionAssignmentInput } from '@edaya/core'
import { PostgresCommandJournal, PostgresDurableWork } from '@edaya/adaptor-postgres'
import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { LessonSession, noOpFileStorage, noOpNotificationGateway, Permission, StaffAssignment, StaffPermissionAssignment } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { describe, expect, onTestFinished, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../../package/adaptor-postgres/tests/support/authorization-database'

const identity = { schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'logbook-document', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }
const staff = createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })

async function fixture(actor: SchoolScopedActorMetadata = staff) {
  const { db, connection, repositories, atomic } = await createAuthorizationDatabase()
  onTestFinished(() => db.close())
  await seedAuthorizationRelationships(db)
  for (const [id, classGroupId, classSubjectId, note] of [['math', 'class-a', 'math-a', 'Math lesson'], ['french', 'class-a', 'french-a', 'French lesson'], ['other', 'class-other', 'math-other', 'Other class'], ['foreign', 'class-b', 'math-b', 'Foreign class']]) {
    await repositories.lessonSessions.save(new LessonSession({ id: id!, schoolId: id === 'foreign' ? 'school-b' : 'school-a', classGroupId: classGroupId!, classSubjectId: classSubjectId!, displayLabel: note!, sessionNote: note!, startsAt: new Date('2026-05-01T08:00:00Z'), endsAt: new Date('2026-05-01T09:00:00Z') }))
  }
  const application = new SchoolApplication({
    repositories,
    atomicExecution: atomic,
    commandJournal: new PostgresCommandJournal(),
    durableWork: new PostgresDurableWork(connection),
    notificationGateway: noOpNotificationGateway,
    fileStorage: noOpFileStorage,
  })
  const service = application.forActor(actor)
  const grant = async (extra: Partial<StaffPermissionAssignmentInput> = {}) => repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: extra.id ?? 'grant', schoolId: 'school-a', staffId: 'staff-a', academicYearId: extra.academicYearId ?? 'year-a', permission: extra.permission ?? Permission.CLASS_LOGBOOK_READ, scopes: extra.scopes ?? [{ kind: 'class_group', classGroupId: 'class-a' }], ...extra }))
  const generate = (extra: { classGroupId?: string, classSubjectId?: string, academicPeriodId?: string } = {}) => service.documentsWorkflow.requestDocumentIssuance({
    requestId: `logbook:${extra.classGroupId ?? 'class-a'}:${extra.academicPeriodId ?? 'period-a'}:${extra.classSubjectId ?? ''}:${crypto.randomUUID()}`,
    templateKey: 'logbook.v1',
    sourceId: extra.classGroupId ?? 'class-a',
    academicPeriodId: extra.academicPeriodId ?? 'period-a',
    classSubjectId: extra.classSubjectId,
    locale: 'en',
  })
  return { db, repositories, grant, generate }
}

describe('logbook document issuance policy', () => {
  test('scoped staff snapshot only the permitted class', async () => {
    const f = await fixture()
    await f.grant()
    const outcome = await f.generate()
    const stored = await f.repositories.documentIssuances.findById(outcome.id)
    const payload = JSON.stringify(stored?.snapshot.facts)
    expect(payload).toContain('Math lesson')
    expect(payload).toContain('A Teacher')
    expect(payload).toContain('French lesson')
    expect(payload).not.toContain('Other class')
    expect(payload).not.toContain('Foreign class')
    expect((stored?.snapshot.facts as { summary?: { subjectCount?: number, sessionCount?: number } }).summary).toEqual({ subjectCount: 2, sessionCount: 2 })
  })

  test('unrelated actions, classes, subjects and periods cannot broaden the export', async () => {
    const f = await fixture()
    await f.grant({ permission: Permission.CLASS_LOGBOOK_MANAGE })
    await expect(f.generate()).rejects.toThrow()
    await f.grant()
    for (const input of [{ classGroupId: 'class-other' }, { classGroupId: 'class-b' }, { classSubjectId: 'math-other' }, { academicPeriodId: 'period-b' }]) {
      await expect(f.generate(input)).rejects.toThrow()
    }
  })

  test('expired grants and a different selected academic year deny exports', async () => {
    const f = await fixture()
    await f.grant({ endsAt: new Date('2000-01-01') })
    await expect(f.generate()).rejects.toThrow()
    await f.grant({ academicYearId: 'year-old', scopes: [{ kind: 'class_group', classGroupId: 'class-old' }] })
    await expect(f.generate()).rejects.toThrow()
  })

  test('subject teacher uses live assignments and loses access immediately on removal', async () => {
    const f = await fixture(createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }))
    const first = await f.generate()
    expect((await f.repositories.documentIssuances.findById(first.id))?.snapshot.facts).toMatchObject({ summary: { subjectCount: 1 } })
    await f.repositories.teacherAssignments.delete('teaching')
    await expect(f.generate()).rejects.toThrow()
  })

  test('homeroom assignment alone cannot read a subject logbook', async () => {
    const f = await fixture(createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }))
    await f.db.exec('UPDATE teacher_assignments SET kind = \'homeroom\', class_subject_id = NULL, class_group_id = \'class-a\'')
    await expect(f.generate()).rejects.toThrow()
  })

  test('family actors cannot issue logbook PDFs', async () => {
    const f = await fixture(createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }))
    await f.grant({ scopes: [{ kind: 'class_group', classGroupId: 'class-other' }] })
    await expect(f.generate()).rejects.toThrow()
  })

  test('teacher names exclude inactive assignments and never use staff responsibility labels', async () => {
    const f = await fixture()
    await f.grant()
    await f.db.exec('UPDATE teacher_assignments SET ends_at = \'2000-01-01\'')
    await f.repositories.staffAssignments.save(new StaffAssignment({ id: 'staff-teacher', staffId: 'staff-a', academicYearId: 'year-a', responsibility: 'Teacher', permissions: [], classSubjectId: 'math-a' }))
    const outcome = await f.generate()
    const payload = JSON.stringify((await f.repositories.documentIssuances.findById(outcome.id))?.snapshot.facts)
    expect(payload).not.toContain('A Teacher')
    expect(payload).not.toContain('A Staff')
  })

  test('empty content rejects before persisting an issuance', async () => {
    const f = await fixture()
    await f.grant()
    await f.db.exec('UPDATE lesson_sessions SET session_note = NULL')
    await expect(f.generate()).rejects.toMatchObject({ code: 'DOCUMENT_SOURCE_MISSING' })
    expect((await f.repositories.documentIssuances.list()).length).toBe(0)
  })
})
