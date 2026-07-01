import type {
  StructureTemplateCurriculumEntry,
  StructureTemplateDefinition,
  StructureTemplateId,
  StructureTemplateReportCardDomainCategory,
  StructureTemplateSubject,
} from '../types'
import exhaustiveSchoolSeed from '../../../data/onboarding/ivory-coast/exhaustive-school-seed.json'

interface RawIvoryCoastLevel {
  code: string
  name: string
  exam_year?: boolean
  exam_name?: string
}

interface RawIvoryCoastSubject {
  code: string
  name: string
  domain: string
}

interface RawIvoryCoastCurriculumEntry {
  level_codes: string[]
  subject_code: string
  coefficient: number
  matters: string[]
}

interface RawIvoryCoastTemplateBlock {
  description: string
  report_card_structure: {
    grading_scale: number
    periods: Array<{ code: string, name: string, weight: number }>
    passing_grade: number
  }
  levels: RawIvoryCoastLevel[]
  subjects: RawIvoryCoastSubject[]
  curriculum: RawIvoryCoastCurriculumEntry[]
}

type RawIvoryCoastSeed = Record<'Primaire' | 'College' | 'Lycee', RawIvoryCoastTemplateBlock>

const TEMPLATE_META: Record<keyof RawIvoryCoastSeed, {
  id: StructureTemplateId
  label: string
  cycle: string
}> = {
  Primaire: {
    id: 'ci-primaire',
    label: 'Côte d\'Ivoire — Primaire',
    cycle: 'Primaire',
  },
  College: {
    id: 'ci-college',
    label: 'Côte d\'Ivoire — Collège',
    cycle: 'Collège',
  },
  Lycee: {
    id: 'ci-lycee',
    label: 'Côte d\'Ivoire — Lycée',
    cycle: 'Lycée',
  },
}

const DOMAIN_ORDER = [
  'Langues',
  'Sciences',
  'Univers Social',
  'Arts',
  'Développement Physique',
] as const

function maxCoefficientBySubject(
  curriculum: RawIvoryCoastCurriculumEntry[],
): Map<string, number> {
  const coefficients = new Map<string, number>()
  for (const entry of curriculum) {
    const current = coefficients.get(entry.subject_code) ?? 0
    coefficients.set(entry.subject_code, Math.max(current, entry.coefficient))
  }
  return coefficients
}

function deriveDomainCategories(
  subjects: RawIvoryCoastSubject[],
  curriculum: RawIvoryCoastCurriculumEntry[],
): StructureTemplateReportCardDomainCategory[] {
  const subjectByCode = new Map(subjects.map(subject => [subject.code, subject]))
  const weightByDomain = new Map<string, number>()

  for (const entry of curriculum) {
    const subject = subjectByCode.get(entry.subject_code)
    if (!subject) {
      continue
    }
    weightByDomain.set(
      subject.domain,
      (weightByDomain.get(subject.domain) ?? 0) + entry.coefficient,
    )
  }

  const domains = [...weightByDomain.keys()].sort((left, right) => {
    const leftIndex = DOMAIN_ORDER.indexOf(left as typeof DOMAIN_ORDER[number])
    const rightIndex = DOMAIN_ORDER.indexOf(right as typeof DOMAIN_ORDER[number])
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
  })

  return domains.map((domain, index) => ({
    domain,
    label: domain,
    order: index + 1,
    coefficient: 1,
    weight: weightByDomain.get(domain) ?? 1,
  }))
}

function toSubjects(
  rawSubjects: RawIvoryCoastSubject[],
  curriculum: RawIvoryCoastCurriculumEntry[],
): StructureTemplateSubject[] {
  const maxCoefficients = maxCoefficientBySubject(curriculum)
  return rawSubjects.map(subject => ({
    code: subject.code,
    shortName: subject.name,
    domain: subject.domain,
    defaultCoefficient: maxCoefficients.get(subject.code) ?? 1,
  }))
}

function toCurriculum(
  rawSubjects: RawIvoryCoastSubject[],
  curriculum: RawIvoryCoastCurriculumEntry[],
): StructureTemplateCurriculumEntry[] {
  const subjectByCode = new Map(rawSubjects.map(subject => [subject.code, subject]))
  return curriculum.map((entry) => {
    const subject = subjectByCode.get(entry.subject_code)
    const levelCodes = [...entry.level_codes]
    return {
      levelCodes,
      subjectCode: entry.subject_code,
      longName: subject
        ? `${subject.name} — ${levelCodes.join('/')}`
        : `${entry.subject_code} — ${levelCodes.join('/')}`,
      coefficient: entry.coefficient,
      matters: [...entry.matters],
    }
  })
}

function toStructureTemplate(
  cycleKey: keyof RawIvoryCoastSeed,
  block: RawIvoryCoastTemplateBlock,
): StructureTemplateDefinition {
  const meta = TEMPLATE_META[cycleKey]
  const subjects = toSubjects(block.subjects, block.curriculum)
  const curriculum = toCurriculum(block.subjects, block.curriculum)

  return {
    id: meta.id,
    countryCode: 'CI',
    label: meta.label,
    description: block.description,
    cycle: meta.cycle,
    reportCardStructure: {
      gradingScale: block.report_card_structure.grading_scale,
      passingGrade: block.report_card_structure.passing_grade,
      periods: block.report_card_structure.periods.map(period => ({
        code: period.code,
        name: period.name,
        weight: period.weight,
      })),
      domainCategories: deriveDomainCategories(block.subjects, block.curriculum),
    },
    gradeLevels: block.levels.map((level, index) => ({
      id: `${meta.id}:${level.code}`,
      code: level.code,
      name: level.name,
      shortLabel: level.code,
      order: index + 1,
      ...(level.exam_year ? { examYear: true } : {}),
      ...(level.exam_name ? { examName: level.exam_name } : {}),
    })),
    subjects,
    curriculum,
  }
}

const SOURCE = exhaustiveSchoolSeed as RawIvoryCoastSeed

export const IVORY_COAST_STRUCTURE_TEMPLATES: readonly StructureTemplateDefinition[] = (
  Object.keys(TEMPLATE_META) as Array<keyof RawIvoryCoastSeed>
).map(cycleKey => toStructureTemplate(cycleKey, SOURCE[cycleKey]))
