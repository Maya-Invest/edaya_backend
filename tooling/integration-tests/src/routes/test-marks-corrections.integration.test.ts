import type { components } from '@maya-invest/edaya-api-client/schema'
import { Assessment, AssessmentKind, ClassGroup, ClassSubject, Permission, StaffPermissionAssignment, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import { DEV_AUTH_STAFF_ACCOUNTS, MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/fixtures/meta/dev-auth-fixtures'
import { createSchoolClient } from '@maya-invest/edaya-api-client'
import { expect, it } from 'bun:test'
import { createInProcessTransport } from '../support/in-process-school-client'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

describeWithLightSchool('submitted marks correction HTTP contract', (getContext) => {
  it('submits, proposes, independently reviews, and serializes official marks through the generated client', async () => {
    const { application, app, authHeaders } = getContext()
    const repositories = application.repositories
    const group = (await repositories.classGroups.list({ $limit: 1 }))[0]!
    const period = (await repositories.academicPeriods.list({ academicYearId: group.academicYearId, $limit: 1 }))[0]!
    const startsAt = new Date((period.startDate.getTime() + period.endDate.getTime()) / 2)
    await repositories.classGroups.save(new ClassGroup({ ...group.data, id: 'correction-route-class', name: 'Correction contract' }))
    await repositories.subjects.save(new Subject({ gradeLevelId: group.gradeLevelId, academicYearId: group.academicYearId, id: 'correction-route-subject', schoolId: group.schoolId, name: 'Contract subject' }))
    await repositories.classSubjects.save(new ClassSubject({ id: 'correction-route-cs', classGroupId: 'correction-route-class', subjectId: 'correction-route-subject', coefficient: 1 }))
    await repositories.students.save(new Student({ id: 'correction-route-student', schoolId: group.schoolId, firstName: 'Contract', lastName: 'Student' }))
    await repositories.enrollments.save(new StudentClassEnrollment({ id: 'correction-route-enrollment', studentId: 'correction-route-student', classGroupId: 'correction-route-class', academicYearId: group.academicYearId, enrollmentIndex: 1, enrolledAt: period.startDate }))
    await repositories.assessments.save(new Assessment({ id: 'correction-route-assessment', classGroupId: 'correction-route-class', classSubjectId: 'correction-route-cs', periodId: period.id, title: 'Contract evaluation', kind: AssessmentKind.Quiz, maxScore: 100, coefficient: 1, startsAt, endsAt: new Date(startsAt.getTime() + 3600000) }))
    const editor = createSchoolClient<components['schemas']>(createInProcessTransport(app, { headers: await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL) }))
    await editor.commands.recordAssessmentResult({ requestId: 'route-edit', expectedRevision: 0, id: 'correction-route-result', assessmentId: 'correction-route-assessment', studentId: 'correction-route-student', score: 75 })
    await editor.commands.submitAssessmentMarks({ requestId: 'route-submit', assessmentId: 'correction-route-assessment', expectedRevision: 1 })
    const input = { requestId: 'route-propose', assessmentId: 'correction-route-assessment', expectedRevision: 2, reason: 'Recounted original paper', changes: [{ resultId: 'correction-route-result', proposed: { score: 85, designation: 'scored' as const, notes: 'Verified total' } }] }
    const correction = await editor.commands.requestAssessmentMarksCorrection(input)
    expect(correction.status).toBe('pending')
    expect(typeof correction.createdAt).toBe('string')
    expect((await editor.commands.requestAssessmentMarksCorrection(input)).id).toBe(correction.id)
    expect((await editor.entities.assessmentResults.get('correction-route-result')).score).toBe(75)
    await expect(editor.commands.approveAssessmentMarksCorrection({ requestId: 'route-self-review', correctionId: correction.id, expectedVersion: 0 })).rejects.toMatchObject({ status: 409 })
    const account = DEV_AUTH_STAFF_ACCOUNTS[1]!
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'route-review-grant', schoolId: group.schoolId, staffId: account.staffId, academicYearId: group.academicYearId, permission: Permission.GRADE_VALIDATE, scopes: [{ kind: 'class_group', classGroupId: 'correction-route-class' }] }))
    const reviewer = createSchoolClient<components['schemas']>(createInProcessTransport(app, { headers: await authHeaders(account.email) }))
    const approved = await reviewer.commands.approveAssessmentMarksCorrection({ requestId: 'route-approve', correctionId: correction.id, expectedVersion: 0 })
    expect(approved.status).toBe('approved')
    expect(typeof approved.decidedAt).toBe('string')
    expect(await editor.entities.assessmentResults.get('correction-route-result')).toMatchObject({ score: 85, revision: 2, notes: 'Verified total' })
  })
}, { isolate: true })
