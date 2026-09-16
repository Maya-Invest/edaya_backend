export { HttpAuthProvisioner, signInViaHttp } from '../bootstrap/auth/http-provisioner'
export {
  logProvisionedServiceAccountKey,
  provisionSeedingServiceAccountHttp,
  type ProvisionSeedingServiceAccountResult,
  SEEDING_SERVICE_ID,
} from '../bootstrap/service-account'
export {
  countPublishedProfilePhotos,
  deriveRepairScopesFromFindings,
  type HttpSeedValidationResult,
  logSeedDoctorRepairResult,
  logSeedDoctorResult,
  parseSkipProfilePhotosFlag,
  probeLocalFilesService,
  type ProfilePhotoPreflightResult,
  resolveLocalFilesUrl,
  resolveProfilePhotoSeedPlan,
  runHttpSeedDoctor,
  runHttpSeedDoctorWithRepair,
  runHttpSeedValidation,
  SEED_DOCTOR_REPAIR_CHAIN,
  type SeedDoctorFinding,
  type SeedDoctorRepairResult,
  type SeedDoctorRepairScope,
  type SeedDoctorRepairStep,
  type SeedDoctorResult,
  type SeedDoctorStatus,
  type SeedEntityValidationResult,
  type SeedQueryValidationResult,
  seedScopeUsesProfilePhotos,
} from '../diagnostics'
export { createHttpAccessSeedPort } from '../domains/access/adapters/http'
export { createHttpActivitiesSeedPort } from '../domains/activities/adapters/http'
export { createHttpAssessmentsSeedPort } from '../domains/assessments/adapters/http'
export { createHttpAttachmentsSeedPort } from '../domains/attachments/adapters/http'
export { createHttpAttendanceSeedPort } from '../domains/attendance/adapters/http'
export { createHttpAuthLinkSeedPort } from '../domains/auth-link/adapters/http'
export { createHttpCommunicationsSeedPort } from '../domains/communications/adapters/http'
export { createHttpCurriculumSeedPort } from '../domains/curriculum/adapters/http'
export { createHttpDisciplineSeedPort } from '../domains/discipline/adapters/http'
export { createHttpDocumentsSeedPort } from '../domains/documents/adapters/http'
export { createHttpFamilyFeedbackSeedPort } from '../domains/family-feedback/adapters/http'
export { createHttpFinanceSeedPort } from '../domains/finance/adapters/http'
export { createHttpPopulationSeedPort } from '../domains/population/adapters/http'
export { createHttpProfilePicturesSeedPort } from '../domains/profile-pictures/adapters/http'
export { createHttpSchoolBrandingSeedPort } from '../domains/school-branding/adapters/http'
export { createHttpReportCardsSeedPort } from '../domains/report-cards/adapters/http'
export { createHttpSchedulingSeedPort } from '../domains/scheduling/adapters/http'
export { createHttpSchoolLifeSeedPort } from '../domains/school-life/adapters/http'
export { createHttpSchoolStructureSeedPort } from '../domains/school-structure/adapters/http'
export { createHttpStudentSupportSeedPort } from '../domains/student-support/adapters/http'
export { createHttpTeachersSeedPort } from '../domains/teachers/adapters/http'
export {
  type HttpDevSeedScope,
  type HttpSmokeSeedResult,
  logHttpDevSeedResults,
  parseHttpDevSeedScope,
  runHttpDevSeeds,
  type RunHttpDevSeedsOptions,
  type RunHttpDevSeedsResults,
  runHttpVerifyDemoStaffGrants,
} from '../runtime/orchestrator'
export {
  type CoreHttpRequestOptions,
  createSeedSchoolClient,
  createSeedTransport,
  executeCoreCommand,
  type ExecuteCoreCommandOptions,
  type HttpFetch,
  HttpSeedClient,
  type HttpSeedClientOptions,
  isSeedEntityKey,
  postCoreCommand,
  postEntityFindById,
  postEntityFindOne,
  postEntityList,
  postEntitySave,
  type SeedCommandKey,
  seedCommandPublicName,
  type SeedEntityKey,
  seedEntityPublicName,
  type SeedSchoolClient,
  type SeedTransportOptions,
  waitForApi,
  type WaitForApiOptions,
} from '../transport/http'
