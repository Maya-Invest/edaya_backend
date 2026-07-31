import type {
  StructureTemplateCurriculumEntry,
  StructureTemplateDefinition,
  StructureTemplateId,
  StructureTemplateReportCardDomainCategory,
  StructureTemplateReportCardSection,
  StructureTemplateReportCardSectionRole,
  StructureTemplateReportCardStructure,
  StructureTemplateSubject,
} from '../types'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  IVORY_COAST_FIXTURE_MASTER,
  IVORY_COAST_LEVEL_FILES,
} from './ivory-coast-fixture-bundle'

function defaultDataRoot(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../data/onboarding/ivory-coast',
  )
}

interface RawPeriod {
  code: string
  name: string
  weight: number
}

interface RawIvoryCoastLevelSubject {
  code: string
  name: string
  domain: string
  coefficient: number
  matters: string[]
  /** LV2 etc. — offered by the school, not both taken by every pupil. */
  optional?: boolean
}

interface RawIvoryCoastReportCardSection {
  role: string
  label: string
  order: number
  subject_codes?: string[]
}

/** Cycle chrome lives in the master fixture — shared periods / grading. */
interface RawIvoryCoastCycleModel {
  description: string
  periods: RawPeriod[]
  grading_scale: number
  passing_grade: number
  include_summary?: boolean
  include_comments?: boolean
  levels: RawIvoryCoastLevelRef[]
}

interface RawIvoryCoastLevelRef {
  order: number
  file: string
}

/** One file per grade level — identity, subjects, bulletin sections. */
interface RawIvoryCoastLevelFile {
  code: string
  name: string
  exam_year?: boolean
  exam_name?: string
  sections?: RawIvoryCoastReportCardSection[]
  subjects: RawIvoryCoastLevelSubject[]
}

interface ResolvedIvoryCoastLevel {
  code: string
  name: string
  order: number
  exam_year?: boolean
  exam_name?: string
  sections: RawIvoryCoastReportCardSection[]
  subjects: RawIvoryCoastLevelSubject[]
}

interface ResolvedIvoryCoastCycle {
  description: string
  periods: RawPeriod[]
  grading_scale: number
  passing_grade: number
  include_summary?: boolean
  include_comments?: boolean
  levels: ResolvedIvoryCoastLevel[]
}

const DOMAIN_ORDER = [
  'Langues',
  'Sciences',
  'Univers Social',
  'Arts',
  'Développement Physique',
] as const

const CYCLE_LABELS: Record<string, string> = {
  College: 'Collège',
  Lycee: 'Lycée',
  Primaire: 'Primaire',
  Prescolaire: 'Préscolaire',
  Technique: 'Technique',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRawPeriod(value: unknown): value is RawPeriod {
  if (!isRecord(value)) {
    return false
  }
  const candidate = value as Partial<RawPeriod>
  return typeof candidate.code === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.weight === 'number'
}

function isRawLevelSubject(value: unknown): value is RawIvoryCoastLevelSubject {
  if (!isRecord(value)) {
    return false
  }
  const candidate = value as Partial<RawIvoryCoastLevelSubject>
  return typeof candidate.code === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.domain === 'string'
    && typeof candidate.coefficient === 'number'
    && Array.isArray(candidate.matters)
    && (candidate.optional === undefined || typeof candidate.optional === 'boolean')
}

function isRawSection(value: unknown): value is RawIvoryCoastReportCardSection {
  if (!isRecord(value)) {
    return false
  }
  const candidate = value as Partial<RawIvoryCoastReportCardSection>
  return typeof candidate.role === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.order === 'number'
}

function isRawLevelRef(value: unknown): value is RawIvoryCoastLevelRef {
  if (!isRecord(value)) {
    return false
  }
  const candidate = value as Partial<RawIvoryCoastLevelRef>
  return typeof candidate.order === 'number'
    && typeof candidate.file === 'string'
}

function isRawCycleModel(value: unknown): value is RawIvoryCoastCycleModel {
  if (!isRecord(value)) {
    return false
  }
  const candidate = value as Partial<RawIvoryCoastCycleModel>
  return typeof candidate.description === 'string'
    && Array.isArray(candidate.periods)
    && candidate.periods.every(isRawPeriod)
    && typeof candidate.grading_scale === 'number'
    && typeof candidate.passing_grade === 'number'
    && Array.isArray(candidate.levels)
    && candidate.levels.every(isRawLevelRef)
}

function isRawLevelFile(value: unknown): value is RawIvoryCoastLevelFile {
  if (!isRecord(value)) {
    return false
  }
  const candidate = value as Partial<RawIvoryCoastLevelFile>
  return typeof candidate.code === 'string'
    && typeof candidate.name === 'string'
    && Array.isArray(candidate.subjects)
    && candidate.subjects.every(isRawLevelSubject)
    && (
      candidate.sections === undefined
      || (Array.isArray(candidate.sections) && candidate.sections.every(isRawSection))
    )
}

/** `College` → `ci-college`, `Collège` → `ci-college`, `Lycee` → `ci-lycee`. */
export function toStructureTemplateId(cycleKey: string): StructureTemplateId {
  const slug = cycleKey
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) {
    throw new Error(`Invalid structure template cycle key: ${JSON.stringify(cycleKey)}`)
  }

  return `ci-${slug}`
}

function cycleDisplayName(cycleKey: string): string {
  return CYCLE_LABELS[cycleKey] ?? cycleKey
}

function parseSections(
  rawSections: RawIvoryCoastReportCardSection[] | undefined,
): StructureTemplateReportCardSection[] | undefined {
  if (!rawSections?.length) {
    return undefined
  }

  const allowed = new Set<StructureTemplateReportCardSectionRole>(['subjects', 'summary', 'comments'])
  return rawSections
    .filter(section => allowed.has(section.role as StructureTemplateReportCardSectionRole))
    .map(section => ({
      role: section.role as StructureTemplateReportCardSectionRole,
      label: section.label,
      order: section.order,
      ...(section.subject_codes ? { subjectCodes: [...section.subject_codes] } : {}),
    }))
    .sort((left, right) => left.order - right.order)
}

function parseCycleReportCard(
  cycle: ResolvedIvoryCoastCycle,
  level?: ResolvedIvoryCoastLevel,
): StructureTemplateReportCardStructure {
  const sections = parseSections(level?.sections)
  return {
    gradingScale: cycle.grading_scale,
    passingGrade: cycle.passing_grade,
    periods: cycle.periods.map(period => ({
      code: period.code,
      name: period.name,
      weight: period.weight,
    })),
    ...(sections ? { sections } : {}),
    ...(cycle.include_summary !== undefined ? { includeSummary: cycle.include_summary } : {}),
    ...(cycle.include_comments !== undefined ? { includeComments: cycle.include_comments } : {}),
    ...(level ? { domainCategories: deriveDomainCategories([level]) } : {}),
  }
}

function parseLevelReportCard(
  cycle: ResolvedIvoryCoastCycle,
  level: ResolvedIvoryCoastLevel,
): StructureTemplateReportCardStructure {
  const subjectCodes = new Set(level.subjects.map(subject => subject.code))
  for (const section of level.sections) {
    for (const code of section.subject_codes ?? []) {
      if (!subjectCodes.has(code)) {
        throw new Error(
          `Level ${level.code}: section "${section.label}" references subject ${code} `
          + 'which is not in this level\'s subjects.',
        )
      }
    }
  }
  return parseCycleReportCard(cycle, level)
}

function deriveSubjects(levels: ResolvedIvoryCoastLevel[]): StructureTemplateSubject[] {
  const byCode = new Map<string, StructureTemplateSubject>()
  for (const level of levels) {
    for (const subject of level.subjects) {
      const existing = byCode.get(subject.code)
      if (!existing) {
        byCode.set(subject.code, {
          code: subject.code,
          shortName: subject.name,
          domain: subject.domain,
          defaultCoefficient: subject.coefficient,
        })
        continue
      }
      if (existing.shortName !== subject.name || existing.domain !== subject.domain) {
        throw new Error(
          `Subject ${subject.code} metadata conflict: `
          + `"${existing.shortName}"/${existing.domain} vs "${subject.name}"/${subject.domain}`,
        )
      }
      byCode.set(subject.code, {
        ...existing,
        defaultCoefficient: Math.max(existing.defaultCoefficient, subject.coefficient),
      })
    }
  }
  return [...byCode.values()]
}

function deriveCurriculum(levels: ResolvedIvoryCoastLevel[]): StructureTemplateCurriculumEntry[] {
  return levels.flatMap(level => level.subjects.map(subject => ({
    levelCode: level.code,
    subjectCode: subject.code,
    coefficient: subject.coefficient,
    matters: [...subject.matters],
    ...(subject.optional ? { isOptional: true } : {}),
  })))
}

function deriveDomainCategories(
  levels: Array<{ subjects: RawIvoryCoastLevelSubject[] }>,
): StructureTemplateReportCardDomainCategory[] {
  const weightByDomain = new Map<string, number>()
  for (const level of levels) {
    for (const subject of level.subjects) {
      weightByDomain.set(
        subject.domain,
        (weightByDomain.get(subject.domain) ?? 0) + subject.coefficient,
      )
    }
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

function readJsonSync(filePath: string): unknown {
  if (!existsSync(filePath)) {
    throw new Error(`Ivory Coast fixture file not found: ${filePath}`)
  }
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown
}

function resolveLevel(
  ref: RawIvoryCoastLevelRef,
  levelFile: RawIvoryCoastLevelFile,
): ResolvedIvoryCoastLevel {
  return {
    code: levelFile.code,
    name: levelFile.name,
    order: ref.order,
    exam_year: levelFile.exam_year,
    exam_name: levelFile.exam_name,
    sections: levelFile.sections ?? [],
    subjects: levelFile.subjects,
  }
}

function resolveCycleLevels(
  cycleKey: string,
  rawCycle: RawIvoryCoastCycleModel,
  dataRoot: string,
  readLevel: (levelPath: string) => unknown,
): ResolvedIvoryCoastLevel[] {
  const levels = [...rawCycle.levels]
    .sort((left, right) => left.order - right.order)
    .map((ref) => {
      if (path.isAbsolute(ref.file) || ref.file.includes('..')) {
        throw new Error(`Cycle ${cycleKey}: level file must be a relative path, got ${ref.file}`)
      }
      const levelPath = path.join(dataRoot, ref.file)
      const rawLevel = readLevel(levelPath)
      if (!isRawLevelFile(rawLevel)) {
        throw new Error(`Invalid level file: ${levelPath}`)
      }
      return resolveLevel(ref, rawLevel)
    })

  const codes = new Set<string>()
  for (const level of levels) {
    if (codes.has(level.code)) {
      throw new Error(`Cycle ${cycleKey}: duplicate level code ${level.code}`)
    }
    codes.add(level.code)
  }

  return levels
}

function toResolvedCycles(
  master: Record<string, unknown>,
  masterPath: string,
  dataRoot: string,
  readLevel: (levelPath: string) => unknown,
): Record<string, ResolvedIvoryCoastCycle> {
  const resolved: Record<string, ResolvedIvoryCoastCycle> = {}

  for (const [cycleKey, rawCycle] of Object.entries(master)) {
    if (!isRawCycleModel(rawCycle)) {
      throw new Error(`Invalid cycle model for ${cycleKey} in ${masterPath}`)
    }

    resolved[cycleKey] = {
      description: rawCycle.description,
      periods: rawCycle.periods,
      grading_scale: rawCycle.grading_scale,
      passing_grade: rawCycle.passing_grade,
      include_summary: rawCycle.include_summary,
      include_comments: rawCycle.include_comments,
      levels: resolveCycleLevels(cycleKey, rawCycle, dataRoot, readLevel),
    }
  }

  return resolved
}

/** Load bundled fixture records (Cloudflare Worker / bundled runtimes). */
export function loadIvoryCoastFixtureFromRecords(
  master: Record<string, unknown>,
  levelFilesByRelativePath: Record<string, unknown>,
): Record<string, ResolvedIvoryCoastCycle> {
  if (!isRecord(master)) {
    throw new Error('Invalid Ivory Coast fixture master')
  }

  return toResolvedCycles(master, 'bundle', '', (levelPath) => {
    const relativePath = levelPath.replace(/\\/g, '/')
    const file = levelFilesByRelativePath[relativePath]
    if (file === undefined) {
      throw new Error(`Ivory Coast fixture file not found in bundle: ${relativePath}`)
    }
    return file
  })
}

/** Load master `fixture.json` and each referenced level file under `dataRoot`. */
export async function loadIvoryCoastFixture(
  dataRoot: string = defaultDataRoot(),
): Promise<Record<string, ResolvedIvoryCoastCycle>> {
  return loadIvoryCoastFixtureSync(dataRoot)
}

/** Synchronous loader for tests and local tooling (reads JSON from disk). */
export function loadIvoryCoastFixtureSync(
  dataRoot: string = defaultDataRoot(),
): Record<string, ResolvedIvoryCoastCycle> {
  const masterPath = path.join(dataRoot, 'fixture.json')
  const master = readJsonSync(masterPath)
  if (!isRecord(master)) {
    throw new Error(`Invalid Ivory Coast fixture master: ${masterPath}`)
  }
  return toResolvedCycles(master, masterPath, dataRoot, readJsonSync)
}

export function parseIvoryCoastStructureTemplates(
  seed: Record<string, ResolvedIvoryCoastCycle>,
): StructureTemplateDefinition[] {
  return Object.entries(seed).map(([cycleKey, cycle]) => {
    const templateId = toStructureTemplateId(cycleKey)
    const displayCycle = cycleDisplayName(cycleKey)
    const subjects = deriveSubjects(cycle.levels)
    const curriculum = deriveCurriculum(cycle.levels)

    return {
      id: templateId,
      countryCode: 'CI' as const,
      label: `Côte d'Ivoire — ${displayCycle}`,
      description: cycle.description,
      cycle: displayCycle,
      reportCardStructure: {
        ...parseCycleReportCard(cycle),
        domainCategories: deriveDomainCategories(cycle.levels),
      },
      gradeLevels: cycle.levels.map(level => ({
        id: `${templateId}:${level.code}`,
        code: level.code,
        name: level.name,
        shortLabel: level.code,
        order: level.order,
        reportCardStructure: parseLevelReportCard(cycle, level),
        ...(level.exam_year ? { examYear: true } : {}),
        ...(level.exam_name ? { examName: level.exam_name } : {}),
      })),
      subjects,
      curriculum,
    }
  })
}

export const IVORY_COAST_STRUCTURE_TEMPLATES: readonly StructureTemplateDefinition[]
  = parseIvoryCoastStructureTemplates(
    loadIvoryCoastFixtureFromRecords(IVORY_COAST_FIXTURE_MASTER, IVORY_COAST_LEVEL_FILES),
  )
