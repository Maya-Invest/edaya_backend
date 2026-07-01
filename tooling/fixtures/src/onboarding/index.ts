export { IVORY_COAST_STRUCTURE_TEMPLATES } from './ivory-coast/parse-ivory-coast-templates'

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
  StructureTemplateReportCardStructure,
  StructureTemplateSubject,
} from './types'
