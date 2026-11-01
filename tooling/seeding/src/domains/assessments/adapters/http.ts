import type { Assessment, AssessmentResult } from '@edaya/core'
import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AssessmentsSeedPort } from '../port'
import { Permission } from '@edaya/core'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { HttpAuthProvisioner } from '../../../bootstrap/auth/http-provisioner'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postCoreQuery, postEntityFindById } from '../../../transport/http/core-entity'

export interface CreateHttpAssessmentsSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpAssessmentsSeedPort(
  options: CreateHttpAssessmentsSeedPortOptions,
): AssessmentsSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-assessments-seed',
  }

  const detail = (assessmentId: string) => postCoreQuery(requestOptions, 'getAssessmentMarksReview', { assessmentId }) as Promise<{ assessment: Assessment['data'], missingStudentIds: string[], results: AssessmentResult['data'][] }>
  const recordBatch = async (assessmentId: string, records: Array<Record<string, unknown>>, requestId: string, expectedRevision: number) => {
    if (!records.length)
      return
    await postCoreCommand(requestOptions, 'recordAssessmentResults', { requestId, assessmentId, expectedRevision, results: records.map(({ assessmentId: _assessmentId, ...row }) => row) })
  }
  return {
    recordAssessmentResults: async (records) => {
      if (!records.length)
        return
      const assessmentId = records[0]!.assessmentId
      const assessment = await postEntityFindById(requestOptions, 'assessments', assessmentId) as Assessment['data']
      await recordBatch(assessmentId, records.map(row => ({ ...row })), `seed-batch:${assessmentId}`, assessment.marksRevision)
    },
    finalizeMarks: (assessmentId, state) => withSeedPortError('assessments.finalizeMarks', async () => {
      if (state === 'draft')
        return
      const review = await detail(assessmentId)
      const missing = review.missingStudentIds.map(studentId => ({ id: review.results.find(result => result.studentId === studentId)?.id ?? `ar-${assessmentId}-${studentId}`, assessmentId, studentId, designation: 'absent' }))
      await recordBatch(assessmentId, missing, `seed-absence-batch:${assessmentId}`, review.assessment.marksRevision)
      const revision = review.assessment.marksRevision + missing.length
      const submitted = await postCoreCommand(requestOptions, 'submitAssessmentMarks', { requestId: `seed-submit:${assessmentId}`, assessmentId, expectedRevision: revision }) as Assessment['data']
      if (state === 'submitted')
        return
      const mark = (await detail(assessmentId)).results[0]
      if (!mark)
        throw new Error('Seed correction requires a mark')
      const correction = await postCoreCommand(requestOptions, 'requestAssessmentMarksCorrection', { requestId: `seed-correction:${assessmentId}`, assessmentId, expectedRevision: submitted.marksRevision, reason: 'Verify the recorded mark comment', changes: [{ resultId: mark.id, proposed: { score: mark.score ?? null, designation: mark.designation ?? 'scored', status: mark.status ?? null, notes: 'Comment checked against the original assessment' } }] }) as { id: string, version: number }
      if (state === 'correction-pending')
        return
      const context = resolveDevSeedContext()
      const account = context.staffAccounts.find(row => row.staffId !== context.ownerStaffId && row.staffId !== context.minimalStaffId)
      if (!account)
        throw new Error('An independent reviewer account is required for HTTP seeding')
      const auth = new HttpAuthProvisioner(options.client)
      const { subjectId } = await auth.ensureUser({ email: account.email, name: account.name, password: context.authPassword }, { preserveSession: true })
      if (submitted.marksReview.editedBySubjectIds.includes(subjectId) || submitted.marksReview.submittedBy === subjectId)
        throw new Error('Seed reviewer must differ from the editor')
      await postCoreCommand(requestOptions, 'linkActorSubject', { subjectId, staffMemberId: account.staffId })
      const group = await postEntityFindById(requestOptions, 'classGroups', submitted.classGroupId) as { academicYearId: string }
      await postCoreCommand(requestOptions, 'assignStaffPermission', { id: `seed-review:${submitted.classGroupId}`, schoolId: context.schoolId, staffId: account.staffId, academicYearId: group.academicYearId, permission: Permission.GRADE_VALIDATE, useDefaultScopes: false, customScopes: [{ kind: 'class_group', classGroupId: submitted.classGroupId }] })
      await options.client.withCookieSnapshot(async () => {
        await auth.ensureUser({ email: account.email, name: account.name, password: context.authPassword })
        await postCoreCommand({ client: options.client, actor: { schoolId: context.schoolId, actorId: account.staffId, academicYearId: group.academicYearId } }, state === 'correction-approved' ? 'approveAssessmentMarksCorrection' : 'rejectAssessmentMarksCorrection', { requestId: `seed-decision:${assessmentId}`, correctionId: correction.id, expectedVersion: correction.version, ...(state === 'correction-rejected' ? { reason: 'Keep the original comment' } : {}) })
      })
    }),
    createAssessment: record => withSeedPortError('assessments.createAssessment', async () => {
      await postCoreCommand(requestOptions, 'createAssessment', record)
    }),
    recordAssessmentResult: record => withSeedPortError('assessments.recordAssessmentResult', async () => {
      const assessment = await postEntityFindById(requestOptions, 'assessments', record.assessmentId) as Assessment['data']
      await postCoreCommand(requestOptions, 'recordAssessmentResult', { ...record, requestId: `seed-mark:${record.id}`, expectedRevision: assessment.marksRevision })
    }),
  }
}
