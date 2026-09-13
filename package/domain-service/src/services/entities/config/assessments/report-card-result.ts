import type { ReportCardResult } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { assertDraftReportCardForTeacherComment, BusinessRuleViolationError, ReportCardResultStatus } from '@edaya/core'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/assessments/report-card-result.ts (PR3)
export const reportCardResultConfig: EntityConfigFactory<ReportCardResult> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.results,
    tenant: reportCardResultTenant(),
    resource: 'results',

    gates: {
      preSave: validateReportCardResultSave,
      preDelete: validateReportCardResultDelete,
    },
    atomicExecution,
  })

function reportCardResultTenant(): EntityTenantResolver<ReportCardResult> {
  return indirectTenant(async (entity: ReportCardResult, repositories: SchoolRepositories) => {
    const student = await repositories.students.findById(entity.studentId)
    return student?.schoolId
  })
}

async function validateReportCardResultSave(
  result: ReportCardResult,
  existing: ReportCardResult | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (existing) {
    assertDraftReportCardForTeacherComment(existing)
  }
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

async function validateReportCardResultDelete(
  result: ReportCardResult,
): Promise<void> {
  if (result.status === ReportCardResultStatus.Published) {
    throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${result.studentId} and period ${result.periodId} is immutable`)
  }
}
