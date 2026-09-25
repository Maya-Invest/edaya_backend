import type { CatalogService } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, CatalogServiceStatus } from '@edaya/core'
import { assertSchoolCurrency } from '../../../../capabilities/finance/school-currency'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const catalogServiceConfig: EntityConfigFactory<CatalogService> = ({ repositories, atomicExecution }) => {
  return config({
    repository: repositories.catalogServices,
    tenant: directSchoolTenant(),
    resource: 'catalogServices',
    gates: {
      preSave: validateCatalogServiceSave,
      preDelete: validateCatalogServiceDelete,
    },
    atomicExecution,
  })
}

export async function validateCatalogServiceSave(
  service: CatalogService,
  existing: CatalogService | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await assertSchoolCurrency(repositories, service.schoolId, service.defaultPrice.currency)
  const [school, academicYear] = await Promise.all([
    repositories.schools.findById(service.schoolId),
    repositories.academicYears.findById(service.academicYearId),
  ])
  if (!school || !academicYear || academicYear.schoolId !== service.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.schoolId !== service.schoolId || existing.academicYearId !== service.academicYearId)) {
    denyResourceAccess()
  }
}

export async function validateCatalogServiceDelete(
  service: CatalogService,
  repositories: SchoolRepositories,
): Promise<void> {
  const enrollments = await repositories.studentServiceEnrollments.list({ catalogServiceId: service.id })
  if (enrollments.length > 0 || service.status !== CatalogServiceStatus.Draft) {
    throw new BusinessRuleViolationError('CATALOG_SERVICE_HAS_DEPENDENCIES', `Cannot delete catalog service ${service.id}: enrollments exist or the service is not a draft`)
  }
}
