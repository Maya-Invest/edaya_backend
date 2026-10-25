import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { AutoBillingRun, CatalogService } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactoryInput } from '../../services/entities/entity-config'
import { resolveAuditActorId } from '@edaya/authorization'
import { BusinessRuleViolationError, CatalogServiceStatus, StudentClassEnrollmentStatus } from '@edaya/core'
import { CommandExecution, digestCommandRequest } from '../../services/commands/command-execution'
import { schoolCommandScope } from '../../services/commands/school-command-scope'

export const AUTO_BILLING_WORK_KIND = 'finance.auto-billing'
export const assignmentLock = (feeId: string, studentId: string, yearId: string) => `service-assignment:${feeId}:${studentId}:${yearId}`

export async function billingConfigurationRevision(fee: CatalogService): Promise<string> {
  return digestCommandRequest({ autoBilling: fee.autoBilling, name: fee.name, category: fee.category, price: fee.defaultPrice.amount, currency: fee.defaultPrice.currency, terms: fee.billingTerms })
}

export async function isAutoBillingEligible(repositories: SchoolRepositories, fee: CatalogService, studentId: string): Promise<boolean> {
  if (!fee.isActive || fee.autoBilling.mode === 'off')
    return false
  const student = await repositories.students.findById(studentId)
  if (!student || student.schoolId !== fee.schoolId)
    return false
  const enrollment = await repositories.enrollments.findOne({ studentId, academicYearId: fee.academicYearId, status: StudentClassEnrollmentStatus.Active })
  const group = enrollment && await repositories.classGroups.findById(enrollment.classGroupId)
  if (!group || group.schoolId !== fee.schoolId || group.academicYearId !== fee.academicYearId)
    return false
  if (fee.autoBilling.mode === 'all')
    return true
  if (fee.autoBilling.gradeLevelIds && !fee.autoBilling.gradeLevelIds.includes(group.gradeLevelId))
    return false
  if (fee.autoBilling.placementStatusIds) {
    const profile = await repositories.studentAcademicYearProfiles.findOne({ schoolId: fee.schoolId, studentId, academicYearId: fee.academicYearId })
    if (!profile?.placementStatusId || !fee.autoBilling.placementStatusIds.includes(profile.placementStatusId))
      return false
  }
  return true
}

export async function validateAutoBillingReferences(fee: CatalogService, repositories: SchoolRepositories): Promise<void> {
  if (fee.autoBilling.mode !== 'matching')
    return
  for (const id of fee.autoBilling.gradeLevelIds ?? []) {
    const level = await repositories.gradeLevels.findById(id)
    if (!level || level.schoolId !== fee.schoolId)
      throw new BusinessRuleViolationError('AUTO_BILLING_GRADE_INVALID', 'Select a grade level in this school')
  }
  for (const id of fee.autoBilling.placementStatusIds ?? []) {
    const status = await repositories.placementStatuses.findById(id)
    if (!status || status.schoolId !== fee.schoolId)
      throw new BusinessRuleViolationError('AUTO_BILLING_STATUS_INVALID', 'Select a placement status in this school')
  }
}

export async function scheduleFeeBilling(context: EntityConfigFactoryInput, fee: CatalogService, actor: SchoolScopedActorMetadata, trigger: AutoBillingRun['trigger'], studentId?: string): Promise<void> {
  if (!fee.isActive || fee.autoBilling.mode === 'off')
    return
  if (!context.commandJournal)
    throw new Error('Auto billing requires a transactional command journal')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const run: AutoBillingRun = {
    id,
    schoolId: fee.schoolId,
    catalogServiceId: fee.id,
    academicYearId: fee.academicYearId,
    studentId,
    trigger,
    triggeredById: resolveAuditActorId(actor),
    configurationRevision: await billingConfigurationRevision(fee),
    status: 'pending',
    workId: id,
    cursor: '',
    createdCount: 0,
    skippedCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  await new CommandExecution(context.atomicExecution, context.commandJournal).execute({
    scope: await schoolCommandScope(actor, 'scheduleAutoBilling', id),
    input: { id },
    resultMode: 'ordinary',
    authorize: async () => {
      if (actor.schoolId !== fee.schoolId)
        throw new BusinessRuleViolationError('AUTO_BILLING_SCOPE_INVALID', 'Fee belongs to another school')
    },
    execute: async () => {
      await context.repositories.autoBilling.save(run)
      return { id }
    },
    persistResult: result => result,
    replay: async stored => stored,
    audit: () => [{ event: 'autoBillingScheduled', resourceType: 'catalogServices', resourceId: fee.id }],
    outbox: () => [{ id, kind: AUTO_BILLING_WORK_KIND, version: 1, resourceType: 'autoBillingRuns', resourceId: id }],
  })
}

export async function scheduleStudentBilling(context: EntityConfigFactoryInput, actor: SchoolScopedActorMetadata, studentId: string, academicYearId: string, trigger: AutoBillingRun['trigger']): Promise<void> {
  let cursor = ''
  while (true) {
    const fees = await context.repositories.catalogServices.list({ schoolId: actor.schoolId, academicYearId, status: CatalogServiceStatus.Active, id: { $gt: cursor }, $orderBy: [{ field: 'id', direction: 'asc' }], $limit: 100 })
    for (const fee of fees) await scheduleFeeBilling(context, fee, actor, trigger, studentId)
    if (fees.length < 100)
      return
    cursor = fees.at(-1)!.id
  }
}
