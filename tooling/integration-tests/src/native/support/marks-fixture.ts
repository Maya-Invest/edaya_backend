import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import process from 'node:process'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresDurableWork, PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicPeriod, AcademicYear, Assessment, AssessmentKind, ClassGroup, ClassSubject, GradeLevel, GradeScale, noOpFileStorage, Permission, RecordingNotificationGateway, ReportCardDefinition, ReportCardDefinitionSection, ReportCardDefinitionSectionKind, School, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { onTestFinished } from 'bun:test'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Disposable native runner required')
export async function fixture(prefix: string) {
  const id = (value: string) => `${prefix}-${value}`
  const handles = await Promise.all([createPostgresSchoolDatabase(url!), createPostgresSchoolDatabase(url!)])
  onTestFinished(async () => {
    for (const handle of handles) await handle.dispose()
  })
  const stores = handles.map(handle => new PostgresSchoolRepositories(handle.db))
  const r = stores[0]!
  await r.init({ driver: 'node-postgres' })
  const dates = { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }
  await r.schools.save(new School({ id: id('school'), name: 'Native approval', timeZone: 'UTC', ownerSubjectId: id('editor'), financeCurrency: 'XOF' }))
  await r.academicYears.save(new AcademicYear({ id: id('year'), schoolId: id('school'), name: '2026', status: 'published', ...dates }))
  await r.academicPeriods.save(new AcademicPeriod({ id: id('period'), schoolId: id('school'), academicYearId: id('year'), name: 'Term', isPublished: true, ...dates }))
  await r.gradeLevels.save(new GradeLevel({ id: id('grade'), schoolId: id('school'), name: 'Grade', label: 'Grade', order: 1 }))
  await r.classGroups.save(new ClassGroup({ id: id('class'), schoolId: id('school'), academicYearId: id('year'), gradeLevelId: id('grade'), name: 'Class' }))
  await r.subjects.save(new Subject({ id: id('math'), schoolId: id('school'), name: 'Math' }))
  await r.classSubjects.save(new ClassSubject({ id: id('subject'), classGroupId: id('class'), subjectId: id('math') }))
  await r.students.save(new Student({ id: id('student'), schoolId: id('school'), firstName: 'Native', lastName: 'Student' }))
  await r.enrollments.save(new StudentClassEnrollment({ id: id('enrollment'), studentId: id('student'), classGroupId: id('class'), academicYearId: id('year'), enrollmentIndex: 1, enrolledAt: dates.startDate }))
  await r.gradeScales.save(new GradeScale({ id: id('scale'), schoolId: id('school'), name: '20', minScore: 0, maxScore: 20, ranges: [{ letter: 'A', minScore: 10.5, maxScore: 20 }] }))
  await r.definitions.save(new ReportCardDefinition({ id: id('definition'), schoolId: id('school'), academicYearId: id('year'), gradeLevelId: id('grade'), gradeScaleId: id('scale'), name: 'Report' }))
  await r.sections.save(new ReportCardDefinitionSection({ id: id('root'), reportCardDefinitionId: id('definition'), kind: ReportCardDefinitionSectionKind.Group, name: 'Subjects', order: 1, weight: 1 }))
  await r.sections.save(new ReportCardDefinitionSection({ id: id('math-section'), reportCardDefinitionId: id('definition'), parentSectionId: id('root'), subjectId: id('math'), kind: ReportCardDefinitionSectionKind.Subject, name: 'Math', order: 1, weight: 1 }))
  await r.assessments.save(new Assessment({ id: id('assessment'), classGroupId: id('class'), classSubjectId: id('subject'), periodId: id('period'), title: 'Quiz', kind: AssessmentKind.Quiz, maxScore: 20, startsAt: new Date('2026-02-01'), endsAt: new Date('2026-02-02') }))
  for (const who of ['editor', 'reviewer']) await r.staffMembers.save(new StaffMember({ id: id(who), schoolId: id('school'), firstName: who, lastName: 'Staff', subjectId: id(who) }))
  for (const permission of [Permission.GRADE_READ, Permission.GRADE_VALIDATE, Permission.GRADE_UNLOCK]) await r.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: id(permission), schoolId: id('school'), staffId: id('reviewer'), academicYearId: id('year'), permission, scopes: [{ kind: 'class_group', classGroupId: id('class') }] }))
  const gateway = new RecordingNotificationGateway()
  const apps = handles.map((handle, index) => new SchoolApplication({ repositories: stores[index]!, atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb), commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(handle.db as ConstructorParameters<typeof PostgresDurableWork>[0]), notificationGateway: gateway, fileStorage: noOpFileStorage }))
  const actor = (who: string, index: number) => apps[index]!.forActor(createStaffActorMetadata({ schoolId: id('school'), staffMemberId: id(who), subjectId: id(who), academicYearId: id('year'), requestId: id('request'), authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  const editor = actor('editor', 0)
  const other = actor('editor', 1)
  const reviewer = actor('reviewer', 1)
  const edit = (requestId: string, expectedRevision: number, score = 12.75) => ({ requestId, id: id('mark'), assessmentId: id('assessment'), studentId: id('student'), expectedRevision, score })
  const command = (requestId: string, expectedRevision: number) => ({ requestId, assessmentId: id('assessment'), expectedRevision })
  const report = { id: id('report'), studentId: id('student'), periodId: id('period'), reportCardDefinitionId: id('definition') }
  return { id, r, editor, other, reviewer, edit, command, report, gateway, handles, application: apps[0]! }
}
