import type { GradeScaleInput } from '@edaya/core'
import type {
  FixtureReportCardGradeScale,
  FixtureReportCardResult,
  FixtureReportConfiguration,
} from '../../types'
import { rangesFromThresholds } from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../../shared/ids'
import { demoCiClassRosters } from '../rosters'
import { demoCiSubjectId } from '../school'

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

export const demoCiReportConfigurationFixtures = ['6', '5', '4', '3'].map(level => ({
  schoolId: DEMO_CI_SCHOOL_ID,
  academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
  gradeLevelId: `ci-gl-${level}`,
  gradeScaleId: 'ci-gs-20',
  passThreshold: 10,
  modules: [
    { id: `ci-module-${level}-fundamental`, name: 'Matières fondamentales', order: 1, weightingMode: 'subject_coefficients' as const, subjectIds: ['ci-subj-fr', 'ci-subj-math', 'ci-subj-hg'] },
    { id: `ci-module-${level}-science`, name: 'Sciences & langues', order: 2, weightingMode: 'explicit' as const, explicitWeight: 2, subjectIds: level === '6' ? ['ci-subj-svt', 'ci-subj-ang', 'ci-subj-edhc'] : ['ci-subj-pc', 'ci-subj-svt', 'ci-subj-ang'] },
  ].map(module => ({ ...module, subjectIds: module.subjectIds.map(id => demoCiSubjectId(id, `ci-gl-${level}`)) })),
})) satisfies readonly FixtureReportConfiguration[]

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

    for (const [index, studentId] of studentIds.entries()) {
      const classRank = index + 1
      const narrativeStatus = publishedAt ? (classRank === classSize && classSize > 2 ? 'generated' : 'published') : 'generated'

      results.push({
        id: `ci-rcr-${studentId.replace('ci-s', 's')}-${periodSuffix}`,
        studentId,
        classGroupId,
        periodId,
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
