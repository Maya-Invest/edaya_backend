export { bulkDataset } from './datasets/bulk'
export { bulkCiDataset } from './datasets/bulk/index-ci'
export { demoDataset, demoDataset as devSeedDataset } from './datasets/demo'
export { demoCiDataset } from './datasets/demo-ci'
export { demoCiSchoolOwnerStaffId } from './datasets/demo-ci/people'
export { demoSchoolOwnerStaffId } from './datasets/demo/people'
export { integrationDataset } from './datasets/integration'
export { minimalDataset } from './datasets/minimal'
export type {
  FixtureAllocationPlan,
  FixtureAnnouncementMaterializePlan,
  FixtureAttendanceSession,
  FixtureCalendarEvent,
  FixtureCatalogBillingTerms,
  FixtureCatalogInstallment,
  FixtureCatalogService,
  FixtureDailyAttendanceDay,
  FixtureDataset,
  FixtureDatasetEntities,
  FixtureDatasetExtensions,
  FixtureDatasetPurpose,
  FixturePayment,
  FixtureReportCardDefinition,
  FixtureReportCardGradeScale,
  FixtureReportCardResult,
  FixtureReportCardSection,
  FixtureReportCardSubjectMark,
  FixtureSchedulingSessionProgressAnchor,
  FixtureSchedulingSlot,
  FixtureStudentServiceEnrollment,
} from './datasets/types'
export {
  resolveActiveSeedSchoolId,
  resolveDevSeedContext,
  resolveDevSeedDatasetId,
} from './meta/resolve-dev-seed-context'
export type { DevSeedContext, DevSeedDatasetId } from './meta/resolve-dev-seed-context'
export { createAuthorizationScenario } from './shared/authorization-scenario'
