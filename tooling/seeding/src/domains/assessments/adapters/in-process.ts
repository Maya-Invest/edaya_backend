import type { SeedApplication } from '../../../support/types'
import type { AssessmentsSeedPort } from '../port'
import { ActorAssuranceLevel, createStaffActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AssessmentResult, Permission, StaffPermissionAssignment } from '@edaya/core'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAssessmentsSeedPort(
  application: SeedApplication,
): AssessmentsSeedPort {
  const service = createInProcessSeedService(application, 'dev-assessments-seed')

  const editors = new Map<string, ReturnType<SeedApplication['forActor']>>()
  const resolveEditor = async (assessmentId: string) => {
    const assessment = await application.repositories.assessments.findById(assessmentId)
    if (!assessment)
      throw new Error('Seed assessment missing')
    const group = await application.repositories.classGroups.findById(assessment.classGroupId)
    const assignment = await application.repositories.teacherAssignments.findOne({ classSubjectId: assessment.classSubjectId })
    const teacher = assignment ? await application.repositories.teachers.findById(assignment.teacherId) : undefined
    if (!group)
      throw new Error('Seed assessment class missing')
    if (!teacher) {
      const context = resolveDevSeedContext()
      const staffId = context.staffAccounts.find(account => account.staffId !== context.ownerStaffId)?.staffId
      const staff = staffId ? await application.repositories.staffMembers.findById(staffId) : undefined
      if (!staff)
        throw new Error(`Seed assessment ${assessmentId} requires an accountable editor`)
      const subjectId = staff.subjectId ?? `fixture-editor:${staff.id}`
      if (!staff.subjectId)
        await service.accessControlWorkflow.linkActorSubject({ staffMemberId: staff.id, subjectId })
      for (const permission of [Permission.GRADE_INPUT, Permission.GRADE_UPDATE, Permission.GRADE_READ]) {
        await service.baseService.entities.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: `seed-editor:${group.id}:${permission}`, schoolId: group.schoolId, staffId: staff.id, academicYearId: group.academicYearId, permission, scopes: [{ kind: 'class_group', classGroupId: group.id }] }))
      }
      return application.forActor(createStaffActorMetadata({ schoolId: group.schoolId, staffMemberId: staff.id, subjectId, academicYearId: group.academicYearId, requestId: `seed-editor:${assessmentId}`, authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
    }
    const subjectId = teacher.subjectId ?? `fixture-teacher:${teacher.id}`
    if (!teacher.subjectId)
      await service.accessControlWorkflow.linkActorSubject({ teacherId: teacher.id, subjectId })
    return application.forActor(createTeacherActorMetadata({ schoolId: group.schoolId, teacherId: teacher.id, subjectId, academicYearId: group.academicYearId, requestId: `seed-editor:${assessmentId}`, authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
  }

  const editor = async (assessmentId: string) => {
    let actor = editors.get(assessmentId)
    if (!actor) {
      actor = await resolveEditor(assessmentId)
      editors.set(assessmentId, actor)
    }
    return actor
  }

  return {
    recordAssessmentResults: records => withSeedPortError('assessments.recordAssessmentResults', async () => {
      if (!records.length)
        return
      if (records.some(record => record.assessmentId !== records[0]!.assessmentId))
        throw new Error('Seed mark batch must share an evaluation')
      const teacher = await editor(records[0]!.assessmentId)
      await teacher.baseService.entities.assessmentResults.batchSave(records.map(record => new AssessmentResult(record)))
    }),
    finalizeMarks: (assessmentId, state) => withSeedPortError('assessments.finalizeMarks', async () => {
      if (state === 'draft')
        return
      const teacher = await editor(assessmentId)
      const detail = await teacher.getAssessmentMarksReview({ assessmentId })
      const missing = detail.missingStudentIds.map(studentId => new AssessmentResult({
        id: detail.results.find(result => result.studentId === studentId)?.id ?? `ar-${assessmentId}-${studentId}`,
        assessmentId,
        studentId,
        designation: 'absent',
      }))
      if (missing.length)
        await teacher.baseService.entities.assessmentResults.batchSave(missing)
      const revision = detail.assessment.marksRevision + missing.length
      const submitted = await teacher.assessmentsWorkflow.submitAssessmentMarks({ requestId: `seed-submit:${assessmentId}`, assessmentId, expectedRevision: revision })
      if (state === 'submitted')
        return
      const mark = (await teacher.getAssessmentMarksReview({ assessmentId })).results[0]
      if (!mark)
        throw new Error('Seed correction requires a mark')
      const correction = await teacher.assessmentsWorkflow.requestAssessmentMarksCorrection({ requestId: `seed-correction:${assessmentId}`, assessmentId, expectedRevision: submitted.marksRevision, reason: 'Verify the recorded mark comment', changes: [{ resultId: mark.id, proposed: { score: mark.score ?? null, designation: mark.designation ?? 'scored', status: mark.status ?? null, notes: 'Comment checked against the original assessment' } }] })
      if (state === 'correction-pending')
        return
      const context = resolveDevSeedContext()
      const staff = await application.repositories.staffMembers.findById(context.ownerStaffId)
      const group = await application.repositories.classGroups.findById(submitted.classGroupId)
      if (!staff || !group)
        throw new Error('Seed reviewer missing')
      const subjectId = staff.subjectId ?? `fixture-reviewer:${staff.id}`
      if (!staff.subjectId)
        await service.accessControlWorkflow.linkActorSubject({ staffMemberId: staff.id, subjectId })
      await service.baseService.entities.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: `seed-review:${group.id}`, schoolId: group.schoolId, staffId: staff.id, academicYearId: group.academicYearId, permission: Permission.GRADE_VALIDATE, scopes: [{ kind: 'class_group', classGroupId: group.id }] }))
      const reviewer = application.forActor(createStaffActorMetadata({ schoolId: group.schoolId, staffMemberId: staff.id, subjectId, academicYearId: group.academicYearId, requestId: `seed-review:${assessmentId}`, authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }))
      const decision = { requestId: `seed-decision:${assessmentId}`, correctionId: correction.id, expectedVersion: correction.version }
      if (state === 'correction-approved')
        await reviewer.assessmentsWorkflow.approveAssessmentMarksCorrection(decision)
      else await reviewer.assessmentsWorkflow.rejectAssessmentMarksCorrection({ ...decision, reason: 'Keep the original comment' })
    }),
    createAssessment: record => withSeedPortError('assessments.createAssessment', async () => {
      await service.assessmentsWorkflow.createAssessment({
        ...record,
        ...(record.dueAt ? { dueAt: new Date(record.dueAt) } : {}),
        ...(record.completedAt ? { completedAt: new Date(record.completedAt) } : {}),
        ...(record.startsAt ? { startsAt: new Date(record.startsAt) } : {}),
        ...(record.endsAt ? { endsAt: new Date(record.endsAt) } : {}),
        attachments: record.attachments?.map(attachment => ({ ...attachment })),
      })
    }),
    recordAssessmentResult: record => withSeedPortError('assessments.recordAssessmentResult', async () => {
      const assessment = await service.baseService.entities.assessments.findById(record.assessmentId)
      if (!assessment)
        throw new Error('Seed assessment missing')
      await (await editor(record.assessmentId)).assessmentsWorkflow.recordAssessmentResult({ ...record, requestId: `seed-mark:${record.id}`, expectedRevision: assessment.marksRevision })
    }),
  }
}
