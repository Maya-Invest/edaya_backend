import { AttendanceRecord, AttendanceStatus, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import { expect, test } from 'bun:test'
import { fixture } from './support/marks-fixture'

test('native roster lock rejects concurrent new enrollments using the same participation revision', async () => {
  const f = await fixture('participation-race')
  const subject = (await f.r.subjects.findById(f.id('math')))!
  await f.r.subjects.save(new Subject({ ...subject.data, isOptional: true }))
  for (const name of ['first', 'second']) {
    await f.r.students.save(new Student({ id: f.id(name), schoolId: f.id('school'), firstName: name, lastName: 'Student' }))
    await f.r.enrollments.save(new StudentClassEnrollment({ id: f.id(`${name}-placement`), studentId: f.id(name), classGroupId: f.id('class'), academicYearId: f.id('year'), enrollmentIndex: 1, enrolledAt: new Date('2026-01-01') }))
  }
  const command = (name: string) => ({ requestId: f.id(name), expectedRevisions: { [f.id('subject')]: 0 }, operations: [{ studentClassEnrollmentId: f.id(`${name}-placement`), classSubjectId: f.id('subject'), selection: { scope: 'annual' as const } }] })
  const outcomes = await Promise.allSettled([f.editor.studentWorkflow.manageStudentSubjectEnrollments(command('first')), f.other.studentWorkflow.manageStudentSubjectEnrollments(command('second'))])
  expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1)
  const failure = outcomes.find(row => row.status === 'rejected') as PromiseRejectedResult
  expect(failure.reason.code).toBe('SUBJECT_PARTICIPATION_REVISION_CONFLICT')
  expect(await f.r.subjectEnrollments.count({ classSubjectId: f.id('subject') })).toBe(2)
}, 30000)

test('native managed placement writes reconcile compulsory rosters without losing concurrent revisions', async () => {
  const f = await fixture('placement-participation-race')
  for (const name of ['first', 'second'])
    await f.r.students.save(new Student({ id: f.id(name), schoolId: f.id('school'), firstName: name, lastName: 'Student' }))
  const placement = (name: string) => new StudentClassEnrollment({ id: f.id(`${name}-placement`), studentId: f.id(name), classGroupId: f.id('class'), academicYearId: f.id('year'), enrollmentIndex: 1, enrolledAt: new Date('2026-01-01') })
  await Promise.all([
    f.editor.baseService.entities.enrollments.save(placement('first')),
    f.other.baseService.entities.enrollments.save(placement('second')),
  ])
  expect(await f.r.subjectEnrollments.count({ classSubjectId: f.id('subject') })).toBe(3)
  expect((await f.r.classSubjects.findById(f.id('subject')))?.participationRevision).toBe(2)
  expect((await f.r.assessments.findById(f.id('assessment')))?.marksRevision).toBe(2)
}, 30000)

test('native attendance saves serialize with optional withdrawal and cannot orphan eligibility', async () => {
  const f = await fixture('attendance-participation-race')
  const subject = (await f.r.subjects.findById(f.id('math')))!
  await f.r.subjects.save(new Subject({ ...subject.data, isOptional: true }))
  const attendance = new AttendanceRecord({ id: f.id('attendance'), studentId: f.id('student'), assessmentId: f.id('assessment'), date: new Date('2026-02-01'), status: AttendanceStatus.Present })
  const outcomes = await Promise.allSettled([
    f.editor.baseService.entities.attendance.save(attendance),
    f.other.studentWorkflow.manageStudentSubjectEnrollments({ requestId: f.id('withdraw'), expectedRevisions: { [f.id('subject')]: 0 }, operations: [{ studentClassEnrollmentId: f.id('enrollment'), classSubjectId: f.id('subject'), selection: { scope: 'none' } }] }),
  ])
  expect(outcomes[1].status).toBe('fulfilled')
  const saved = await f.r.attendance.findById(attendance.id)
  const participation = await f.r.subjectEnrollments.findById(f.id('participation'))
  if (saved) {
    expect(participation?.deletedAt).toBeDefined()
  }
  else {
    expect(participation).toBeUndefined()
    expect((outcomes[0] as PromiseRejectedResult).reason.code).toBe('SUBJECT_PARTICIPATION_REQUIRED')
  }
}, 30000)
