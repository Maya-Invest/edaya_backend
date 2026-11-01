import type { StudentSubjectEnrollment } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

export const studentSubjectEnrollmentConfig: EntityConfigFactory<StudentSubjectEnrollment> = ({ repositories, atomicExecution }) => config({
  repository: repositories.subjectEnrollments,
  resource: 'subjectEnrollments',
  tenant: indirectTenant(async (entity, repos) => {
    const placement = await repos.enrollments.findById(entity.studentClassEnrollmentId)
    return placement ? (await repos.students.findById(placement.studentId))?.schoolId : undefined
  }),
  gates: {
    preSave: async () => { throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_COMMAND_REQUIRED', 'Use subject enrollment commands') },
    preDelete: async () => { throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_COMMAND_REQUIRED', 'Cancel subject enrollment through the enrollment command') },
  },
  atomicExecution,
})
