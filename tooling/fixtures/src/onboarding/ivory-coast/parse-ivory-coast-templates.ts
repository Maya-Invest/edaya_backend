import type { OnboardingDataset } from '@edaya/service'
import type { StructureTemplateDefinition, StructureTemplateReportCardStructure } from '../types'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { onboardingDatasetManifestSchema, onboardingDatasetSchema, onboardingGradeLevelSchema } from '@edaya/service'
import { IVORY_COAST_FIXTURE_MASTER, IVORY_COAST_LEVEL_FILES } from './ivory-coast-fixture-bundle'

const CATEGORY_DOMAINS: Record<string, string> = { SCIENTIFIC: 'Sciences', LITERARY: 'Littéraire', LANGUAGES: 'Langues', HUMANITIES: 'Univers Social', SPORT: 'Développement Physique', ARTS: 'Arts' }
const DOMAIN_ORDER = ['Langues', 'Sciences', 'Univers Social', 'Arts', 'Développement Physique']

export function toStructureTemplateId(cycle: string): string {
  return `ci-${cycle.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
}

export function loadIvoryCoastFixtureFromRecords(master: Record<string, unknown>, files: Record<string, unknown>): OnboardingDataset {
  const manifest = onboardingDatasetManifestSchema.parse(master)
  return onboardingDatasetSchema.parse({ ...manifest, templates: manifest.templates.map(template => ({ ...template, gradeLevels: template.gradeLevels.map(({ file }) => {
    if (path.isAbsolute(file) || file.includes('..') || file.includes('\\'))
      throw new Error(`Unsafe onboarding level file: ${file}`)
    if (!Object.hasOwn(files, file))
      throw new Error(`Missing onboarding level file: ${file}`)
    return onboardingGradeLevelSchema.parse(files[file])
  }) })) })
}

export function loadIvoryCoastFixtureSync(dataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data/onboarding/ivory-coast')): OnboardingDataset {
  const master = JSON.parse(readFileSync(path.join(dataRoot, 'fixture.json'), 'utf8'))
  const manifest = onboardingDatasetManifestSchema.parse(master)
  const files: Record<string, unknown> = {}
  for (const template of manifest.templates) {
    for (const { file } of template.gradeLevels) {
      if (path.isAbsolute(file) || file.includes('..') || file.includes('\\'))
        throw new Error(`Unsafe onboarding level file: ${file}`)
      files[file] = JSON.parse(readFileSync(path.join(dataRoot, file), 'utf8'))
    }
  }
  return loadIvoryCoastFixtureFromRecords(master, files)
}
export async function loadIvoryCoastFixture(dataRoot?: string): Promise<OnboardingDataset> {
  return loadIvoryCoastFixtureSync(dataRoot)
}

/** One-way projection for consumers awaiting canonical dataset adoption. */
export function parseIvoryCoastStructureTemplates(dataset: OnboardingDataset): StructureTemplateDefinition[] {
  return dataset.templates.map((template) => {
    const calendar = dataset.calendarProfiles.find(row => row.code === template.calendarProfileCode)!
    const domain = (categoryCode: string) => CATEGORY_DOMAINS[categoryCode] ?? dataset.subjectCategories.find(row => row.code === categoryCode)!.name
    const categories = (levels: typeof template.gradeLevels) => {
      const weights = new Map<string, number>()
      for (const level of levels) {
        for (const subject of level.subjects) weights.set(domain(subject.categoryCode), (weights.get(domain(subject.categoryCode)) ?? 0) + subject.coefficient)
      }
      return [...weights.keys()].sort((a, b) => DOMAIN_ORDER.indexOf(a) - DOMAIN_ORDER.indexOf(b)).map((name, index) => ({ domain: name, label: name, order: index + 1, coefficient: 1, weight: weights.get(name)! }))
    }
    const structure = (level?: typeof template.gradeLevels[number]): StructureTemplateReportCardStructure => ({
      gradingScale: dataset.gradeScales.find(row => row.code === (level ?? template.gradeLevels[0]!).gradingPolicy.gradeScaleCode)!.maxScore,
      passingGrade: (level ?? template.gradeLevels[0]!).gradingPolicy.passThreshold,
      periods: calendar.periods.map(row => ({ ...row })),
      ...template.reportPresentation,
      domainCategories: categories(level ? [level] : template.gradeLevels),
      ...(level ? { modules: [...level.reportModules].sort((a, b) => a.order - b.order).map(module => ({ name: module.name, order: module.order, weightingMode: module.weightingMode, ...(module.explicitWeight !== undefined ? { explicitWeight: module.explicitWeight } : {}), subjectCodes: level.subjects.filter(row => row.reportModuleCode === module.code).sort((a, b) => a.reportOrder - b.reportOrder).map(row => row.code) })) } : {}),
    })
    const subjects = new Map<string, StructureTemplateDefinition['subjects'][number]>()
    for (const level of template.gradeLevels) {
      for (const subject of level.subjects) {
        const previous = subjects.get(subject.code)
        subjects.set(subject.code, { code: subject.code, shortName: subject.shortName, domain: domain(subject.categoryCode), defaultCoefficient: Math.max(previous?.defaultCoefficient ?? 0, subject.coefficient), categoryCode: subject.categoryCode })
      }
    }
    return {
      id: template.id,
      countryCode: dataset.countryCode,
      label: template.label,
      description: template.description,
      cycle: template.cycle,
      subjectCategories: dataset.subjectCategories.map(row => ({ ...row })),
      reportCardStructure: structure(),
      gradeLevels: template.gradeLevels.map(({ subjects: _subjects, reportModules: _modules, gradingPolicy: _policy, ...level }) => ({ ...level, reportCardStructure: structure(template.gradeLevels.find(row => row.id === level.id)!) })),
      subjects: [...subjects.values()],
      curriculum: template.gradeLevels.flatMap(level => level.subjects.map(subject => ({ levelCode: level.code, subjectCode: subject.code, ...(subject.name !== subject.shortName ? { longName: subject.name } : {}), coefficient: subject.coefficient, matters: [...subject.chapters].sort((a, b) => a.order - b.order).map(row => row.title), ...(subject.isOptional ? { isOptional: true } : {}) }))),
    }
  })
}
export const IVORY_COAST_ONBOARDING_DATASET = loadIvoryCoastFixtureFromRecords(IVORY_COAST_FIXTURE_MASTER, IVORY_COAST_LEVEL_FILES)
export const IVORY_COAST_STRUCTURE_TEMPLATES: readonly StructureTemplateDefinition[] = parseIvoryCoastStructureTemplates(IVORY_COAST_ONBOARDING_DATASET)
