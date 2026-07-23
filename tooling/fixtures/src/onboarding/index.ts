export {
  IVORY_COAST_STRUCTURE_TEMPLATES,
  loadIvoryCoastFixture,
  parseIvoryCoastStructureTemplates,
  toStructureTemplateId,
} from './ivory-coast/parse-ivory-coast-templates'

export {
  BUILTIN_STRUCTURE_TEMPLATES,
  classDisplayName,
  isStructureTemplateId,
  listStructureTemplatesForCountry,
  parseGradeLevelTemplateId,
  resolveCountryCode,
  resolveStructureTemplates,
} from './registry'

export type {
  CountryCode,
  StructureTemplateCurriculumEntry,
  StructureTemplateDefinition,
  StructureTemplateGradeLevel,
  StructureTemplateId,
  StructureTemplateReportCardDomainCategory,
  StructureTemplateReportCardPeriod,
  StructureTemplateReportCardSection,
  StructureTemplateReportCardSectionRole,
  StructureTemplateReportCardStructure,
  StructureTemplateSubject,
} from './types'
