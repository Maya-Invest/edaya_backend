import type { EntityConfigFactory } from '../../entity-config'

import { BusinessRuleViolationError, GradeLevel } from '@edaya/core'
import { normalizeCommandRequest } from '../../../commands/command-execution'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/grade-level.ts (PR3)
export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = ({ repositories, atomicExecution, durableWork }) =>
  config({
    repository: repositories.gradeLevels,
    tenant: directSchoolTenant(),
    resource: 'gradeLevels',
    projectRead: async (level) => {
      if (!durableWork)
        return level
      const gradingPolicies = await Promise.all(level.gradingPolicies.map(async (policy) => {
        if (policy.status !== 'updating' || !policy.workId)
          return policy
        const state = await durableWork.getState(policy.workId)
        return !state || state.status === 'dead' || state.status === 'failed' ? { ...policy, status: 'failed' as const, failureCode: 'GRADING_UPDATE_FAILED' } : policy
      }))
      return new GradeLevel({ ...level.data, gradingPolicies })
    },
    writeLockGroup: 'academic-state',
    gates: { preSave: async (level, existing) => {
      if (normalizeCommandRequest(level.gradingPolicies) !== normalizeCommandRequest(existing?.gradingPolicies ?? []))
        throw new BusinessRuleViolationError('GRADING_COMMAND_REQUIRED', 'Use the grading configuration command')
    }, preDelete: async (level, repos) => {
      if (await repos.subjects.count({ gradeLevelId: level.id }) || (await repos.catalogServices.list({ schoolId: level.schoolId })).some(fee => fee.autoBilling.mode === 'matching' && fee.autoBilling.gradeLevelIds?.includes(level.id)))
        throw new BusinessRuleViolationError('GRADE_LEVEL_HAS_SUBJECTS', 'Remove subjects before deleting their grade level')
    } },

    atomicExecution,
  })
