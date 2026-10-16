import type { GradeScaleInput } from '@edaya/core'
import type {
  FixtureReportCardDefinition,
  FixtureReportCardGradeScale,
  FixtureReportCardResult,
} from '../../types'
import { rangesFromThresholds, ReportCardDefinitionKind, ReportCardDefinitionSectionRole, ReportCardDefinitionStatus } from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../../shared/ids'
import { demoCiClassRosters } from '../rosters'

export const demoCiGradeScales = [
  {
    id: 'ci-gs-20',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Sur 20',
    minScore: 0,
    maxScore: 20,
    decimalPlaces: 2,
    intervalConvention: 'continuous',
    roundingMode: 'nearest',
    description: 'Barème standard — note sur 20.',
    isDefault: true,
    ranges: rangesFromThresholds([
      { id: 'ci-gs-20-d', letter: 'D', minScore: 0, interpretation: 'Insuffisant' },
      { id: 'ci-gs-20-c', letter: 'C', minScore: 10, interpretation: 'Assez bien' },
      { id: 'ci-gs-20-b', letter: 'B', minScore: 14, interpretation: 'Bien' },
      { id: 'ci-gs-20-a', letter: 'A', minScore: 16, interpretation: 'Très bien' },
    ], 20),
  },
] as const satisfies readonly GradeScaleInput[]

export const demoCiReportCardGradeScaleFixtures = [
  {
    scale: demoCiGradeScales[0],
  },
] as const satisfies readonly FixtureReportCardGradeScale[]

function buildSections(
  prefix: string,
  includeEdhc: boolean,
): readonly {
  id: string
  name: string
  role: ReportCardDefinitionSectionRole
  order: number
  weight: number
  coefficient?: number
  subjectIds: readonly string[]
}[] {
  const sciSubjects = includeEdhc
    ? ['ci-subj-svt', 'ci-subj-ang', 'ci-subj-edhc']
    : ['ci-subj-pc', 'ci-subj-svt', 'ci-subj-ang']

  return [
    {
      id: `${prefix}-fond`,
      name: 'Matières fondamentales',
      role: ReportCardDefinitionSectionRole.Subjects,
      order: 1,
      weight: 2,
      coefficient: 2,
      subjectIds: ['ci-subj-fr', 'ci-subj-math', 'ci-subj-hg'],
    },
    {
      id: `${prefix}-sci`,
      name: 'Sciences & langues',
      role: ReportCardDefinitionSectionRole.Subjects,
      order: 2,
      weight: 2,
      coefficient: 1.5,
      subjectIds: sciSubjects,
    },
    {
      id: `${prefix}-eps`,
      name: 'EPS',
      role: ReportCardDefinitionSectionRole.Subjects,
      order: 3,
      weight: 1,
      coefficient: 1,
      subjectIds: ['ci-subj-eps'],
    },
    {
      id: `${prefix}-synth`,
      name: 'Synthèse trimestrielle',
      role: ReportCardDefinitionSectionRole.Summary,
      order: 4,
      weight: 0,
      subjectIds: [],
    },
    {
      id: `${prefix}-appr`,
      name: 'Appréciations',
      role: ReportCardDefinitionSectionRole.Comments,
      order: 5,
      weight: 0,
      subjectIds: [],
    },
  ]
}

export const demoCiReportCardDefinitionFixtures = [
  {
    narrativeStatus: 'published',
    definition: {
      id: 'ci-rcd-6',
      schoolId: DEMO_CI_SCHOOL_ID,
      academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
      gradeLevelId: 'ci-gl-6',
      gradeScaleId: 'ci-gs-20',
      passThreshold: 10,
      name: 'Bulletin trimestriel — 6ème',
      kind: ReportCardDefinitionKind.Default,
      status: ReportCardDefinitionStatus.Published,
      isDefault: true,
      description: 'Bulletin trimestriel — 6ème',
    },
    sections: buildSections('ci-rcs-6', true),
  },
  {
    narrativeStatus: 'published',
    definition: {
      id: 'ci-rcd-5',
      schoolId: DEMO_CI_SCHOOL_ID,
      academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
      gradeLevelId: 'ci-gl-5',
      gradeScaleId: 'ci-gs-20',
      passThreshold: 10,
      name: 'Bulletin trimestriel — 5ème',
      kind: ReportCardDefinitionKind.Default,
      status: ReportCardDefinitionStatus.Published,
      isDefault: true,
      description: 'Bulletin trimestriel — 5ème',
    },
    sections: buildSections('ci-rcs-5', false),
  },
  {
    narrativeStatus: 'published',
    definition: {
      id: 'ci-rcd-4',
      schoolId: DEMO_CI_SCHOOL_ID,
      academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
      gradeLevelId: 'ci-gl-4',
      gradeScaleId: 'ci-gs-20',
      passThreshold: 10,
      name: 'Bulletin trimestriel — 4ème',
      kind: ReportCardDefinitionKind.Default,
      status: ReportCardDefinitionStatus.Published,
      isDefault: true,
      description: 'Bulletin trimestriel — 4ème',
    },
    sections: buildSections('ci-rcs-4', false),
  },
  {
    narrativeStatus: 'published',
    definition: {
      id: 'ci-rcd-3',
      schoolId: DEMO_CI_SCHOOL_ID,
      academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
      gradeLevelId: 'ci-gl-3',
      gradeScaleId: 'ci-gs-20',
      passThreshold: 10,
      name: 'Bulletin trimestriel — 3ème',
      kind: ReportCardDefinitionKind.Default,
      status: ReportCardDefinitionStatus.Published,
      isDefault: true,
      description: 'Bulletin trimestriel — 3ème',
    },
    sections: buildSections('ci-rcs-3', false),
  },
] as const satisfies readonly FixtureReportCardDefinition[]

const classReportCardDefinition: Record<string, string> = {
  'ci-6a': 'ci-rcd-6',
  'ci-6b': 'ci-rcd-6',
  'ci-5a': 'ci-rcd-5',
  'ci-4a': 'ci-rcd-4',
  'ci-3a': 'ci-rcd-3',
}

const homeroomComments: Partial<Record<string, string>> = {
  'ci-s1': 'Bon début d\'année.',
  'ci-s2': 'Travail régulier.',
  'ci-s7': 'Élève sérieux.',
  'ci-s11': 'Bonne adaptation en 5ème.',
  'ci-s19': 'Progrès notables en 4ème.',
  'ci-s23': 'Bon niveau en 3ème, à confirmer au brevet.',
}

function buildTrimesterResults(
  periodId: string,
  periodSuffix: string,
  generatedAt: string,
  publishedAt: string | undefined,
): FixtureReportCardResult[] {
  const results: FixtureReportCardResult[] = []

  for (const [classGroupId, studentIds] of Object.entries(demoCiClassRosters)) {
    const classSize = studentIds.length
    const reportCardDefinitionId = classReportCardDefinition[classGroupId]!

    for (const [index, studentId] of studentIds.entries()) {
      const classRank = index + 1
      const narrativeStatus = publishedAt ? (classRank === classSize && classSize > 2 ? 'generated' : 'published') : 'generated'

      results.push({
        id: `ci-rcr-${studentId.replace('ci-s', 's')}-${periodSuffix}`,
        studentId,
        classGroupId,
        periodId,
        reportCardDefinitionId,
        gradeScaleId: 'ci-gs-20',
        narrativeStatus,
        overallAverage: 12 + classRank,
        classRank,
        classSize,
        homeroomComment: homeroomComments[studentId] ?? '',
        generatedAt,
        publishedAt: narrativeStatus === 'published' ? publishedAt : undefined,
        sectionMarks: {},
      })
    }
  }

  return results
}

/** Published guardian examples; the remaining students stay eligible for grading. */
export const demoCiReportCardResults = [
  ...buildTrimesterResults('ci-2025-t1', 't1', '2026-12-15', undefined).map(result =>
    ['ci-s1', 'ci-s4'].includes(result.studentId)
      ? { ...result, narrativeStatus: 'published' as const, publishedAt: '2026-12-16' }
      : result),
] as const satisfies readonly FixtureReportCardResult[]
