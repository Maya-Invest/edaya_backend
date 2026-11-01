export { demoCiDataset } from './datasets/demo-ci'
export { demoCiSchoolOwnerStaffId } from './datasets/demo-ci/people'
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
  FixtureDocumentIssuance,
  FixturePayment,
  FixtureReportCardGradeScale,
  FixtureReportCardResult,
  FixtureReportCardSubjectMark,
  FixtureReportConfiguration,
  FixtureReportModule,
  FixtureSchedulingSessionProgressAnchor,
  FixtureSchedulingSlot,
  FixtureStudentServiceEnrollment,
} from './datasets/types'
export {
  resolveActiveSeedSchoolId,
  resolveDevSeedContext,
} from './meta/resolve-dev-seed-context'
export type { DevSeedContext, DevSeedDatasetId } from './meta/resolve-dev-seed-context'
export { bootstrapSeedDataset, routeSeedDataset, sliceSeedDataset } from './meta/seed-slice'
export type { SeedSliceSelection } from './meta/seed-slice'
export { createAuthorizationScenario } from './shared/authorization-scenario'
