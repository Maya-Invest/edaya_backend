import type { AuthorizationPolicy } from '../../../authorization'
import type { ReportCardResult } from '../../../entities/assessments/report-card-result'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared/common'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess } from '../../../authorization'
import { ReportCardResultStatus } from '../../../entities/assessments/report-card-result'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, indirectTenant, read, readByIds, write } from '../../../shared/common'

export const reportCardResultConfig: EntityConfigFactory<ReportCardResult> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.results,
    tenant: reportCardResultTenant(),
    read: read(action(policy, 'queries.read_report_card_detail'), readByIds((actor, ids) => policy.checkReportCardResultAccess(actor, ids))),
    write: write(action(policy, 'assessments.publish_report_card'), authorizeReportCardResult(policy), authorizeReportCardResultDelete(policy)),
    gates: {
      preSave: validateReportCardResultSave,
    },
    atomicExecution,
  })

function reportCardResultTenant(): EntityTenantResolver<ReportCardResult> {
  return indirectTenant(async (entity, repositories) => {
    const student = await repositories.students.findById(entity.studentId)
    return student?.schoolId
  })
}

async function validateReportCardResultSave(
  result: ReportCardResult,
  _existing: ReportCardResult | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [student, classGroup, period, definition] = await Promise.all([
    repositories.students.findById(result.studentId),
    repositories.classGroups.findById(result.classGroupId),
    repositories.academicPeriods.findById(result.periodId),
    repositories.definitions.findById(result.reportCardDefinitionId),
  ])
  if (
    !student
    || !classGroup
    || student.schoolId !== classGroup.schoolId
    || !period
    || period.schoolId !== student.schoolId
    || period.academicYearId !== classGroup.academicYearId
    || !definition
    || definition.schoolId !== student.schoolId
    || definition.academicYearId !== period.academicYearId
  ) {
    denyResourceAccess()
  }

  const published = await repositories.results.findOne({
    studentId: result.studentId,
    periodId: result.periodId,
    status: ReportCardResultStatus.Published,
  })
  if (!published || published.status !== ReportCardResultStatus.Published) {
    return
  }
  throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${result.studentId} and period ${result.periodId} is immutable`)
}

function authorizeReportCardResult(policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardResult>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
    if (existing)
      await policy.checkReportCardResultAccess(actor, [existing.id])
  }
}

function authorizeReportCardResultDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardResult>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkReportCardResultAccess(actor, [entity.id])
  }
}
