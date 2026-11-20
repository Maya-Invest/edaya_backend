export {
  IVORY_COAST_STRUCTURE_TEMPLATES,
  loadIvoryCoastFixture,
  parseIvoryCoastStructureTemplates,
  toStructureTemplateId,
} from './ivory-coast/parse-ivory-coast-templates'

export { IVORY_COAST_ONBOARDING_DATASET, loadIvoryCoastFixtureFromRecords, loadIvoryCoastFixtureSync } from './ivory-coast/parse-ivory-coast-templates'

export {
  GRADE_LEVEL_CLASS_ID_PREFIX,
  nextClassGroupIdForGradeSeed,
  nextOnboardingClassGroupId,
} from './next-class-group-id'
export {
  BUILTIN_STRUCTURE_TEMPLATES,
  classDisplayName,
  classNameFromLabel,
  isStructureTemplateId,
  listStructureTemplatesForCountry,
  parseGradeLevelTemplateId,
  resolveCountryCode,
  resolveStructureTemplates,
} from './registry'
export type { ClassNamingMode } from './registry'

export { listOnboardingDatasets, resolveOnboardingDataset, resolveOnboardingDatasetInput } from './registry'

export {
  API_GRADE_LEVEL_TEMPLATE_TO_SEED_ID,
  structureClassGroupSeedId,
  structureGradeLevelSeedId,
} from './seed-ids'

export type { ApiGradeLevelTemplateId } from './seed-ids'
export type {
  CountryCode,
  StructureTemplateCurriculumEntry,
  StructureTemplateDefinition,
  StructureTemplateGradeLevel,
  StructureTemplateId,
  StructureTemplateReportCardDomainCategory,
  StructureTemplateReportCardPeriod,
  StructureTemplateReportCardStructure,
  StructureTemplateSubject,
} from './types'
export type { OnboardingDataset, OnboardingDatasetGradeLevel } from '@edaya/service'
