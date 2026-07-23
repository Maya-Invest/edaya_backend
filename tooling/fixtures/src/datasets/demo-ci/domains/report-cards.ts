import type { GradeScaleInput } from '@edaya/core'
import type {
  FixtureReportCardDefinition,
  FixtureReportCardGradeScale,
  FixtureReportCardResult,
  FixtureReportCardSubjectMark,
} from '../../types'
import { ReportCardDefinitionKind, ReportCardDefinitionSectionRole, ReportCardDefinitionStatus } from '@edaya/core'
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
    description: 'Barème standard — note sur 20, seuil de réussite à 10.',
    isDefault: true,
    ranges: [
      { letter: 'D', minScore: 0, maxScore: 9.99, isPassing: false, interpretation: 'Insuffisant' },
      { letter: 'C', minScore: 10, maxScore: 13.99, isPassing: true, interpretation: 'Assez bien' },
      { letter: 'B', minScore: 14, maxScore: 15.99, isPassing: true, interpretation: 'Bien' },
      { letter: 'A', minScore: 16, maxScore: 20, isPassing: true, interpretation: 'Très bien' },
    ],
  },
] as const satisfies readonly GradeScaleInput[]

export const demoCiReportCardGradeScaleFixtures = [
  {
    narrativePassingScore: 10,
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

function appreciationForPeriod(periodSuffix: 't1' | 't2' | 't3'): string {
  if (periodSuffix === 't1') {
    return 'Bon trimestre.'
  }
  if (periodSuffix === 't2') {
    return 'En progression.'
  }
  return 'Fin d\'année satisfaisante.'
}

function buildSectionMarks(
  reportCardDefinitionId: string,
  overallAverage: number,
  periodSuffix: 't1' | 't2' | 't3',
): Record<string, FixtureReportCardSubjectMark[]> {
  const fixture = demoCiReportCardDefinitionFixtures.find(
    entry => entry.definition.id === reportCardDefinitionId,
  )
  if (!fixture) {
    return {}
  }
  const marks: Record<string, FixtureReportCardSubjectMark[]> = {}
  for (const section of fixture.sections) {
    if (section.subjectIds.length === 0) {
      continue
    }
    marks[section.id] = section.subjectIds.map((subjectId, subjectIndex) => ({
      subjectId,
      average: Math.max(
        0,
        Math.round((overallAverage - 0.8 + subjectIndex * 0.35) * 10) / 10,
      ),
      coefficient: section.coefficient ?? 1,
      appreciation: appreciationForPeriod(periodSuffix),
    }))
  }
  return marks
}

function buildTrimesterResults(
	periodId: string,
	periodSuffix: 't1' | 't2' | 't3',
	generatedAt: string,
	publishedAt: string,
): FixtureReportCardResult[] {
	const results: FixtureReportCardResult[] = []
	// Rotate + shift scores so each trimester has distinct averages/ranks in demos.
	const rotation = periodSuffix === 't1' ? 0 : periodSuffix === 't2' ? 2 : 4
	const trimesterBoost = periodSuffix === 't1' ? 0 : periodSuffix === 't2' ? 1.2 : -0.8

	for (const [classGroupId, studentIds] of Object.entries(demoCiClassRosters)) {
		const classSize = studentIds.length
		const reportCardDefinitionId = classReportCardDefinition[classGroupId]!

		for (const [index, studentId] of studentIds.entries()) {
			const performanceSlot = (index + rotation) % classSize
			const overallAverage = Math.round((12.5 + performanceSlot + trimesterBoost) * 10) / 10
			const classRank = performanceSlot + 1
			const narrativeStatus = classRank === classSize && classSize > 2 ? 'generated' : 'published'

			results.push({
				id: `ci-rcr-${studentId.replace('ci-s', 's')}-${periodSuffix}`,
				studentId,
				classGroupId,
				periodId,
				reportCardDefinitionId,
				gradeScaleId: 'ci-gs-20',
				narrativeStatus,
				overallAverage,
				classRank,
				classSize,
				homeroomComment: homeroomComments[studentId] ?? '',
				generatedAt,
				publishedAt: narrativeStatus === 'published' ? publishedAt : undefined,
				sectionMarks: buildSectionMarks(reportCardDefinitionId, overallAverage, periodSuffix),
			})
		}
	}

	return results
}

/** Trimestres 1–3 — bulletins pour les 30 élèves du collège. */
export const demoCiReportCardResults = [
	...buildTrimesterResults('ci-2025-t1', 't1', '2025-12-15', '2025-12-19'),
	...buildTrimesterResults('ci-2025-t2', 't2', '2026-03-24', '2026-03-28'),
	...buildTrimesterResults('ci-2025-t3', 't3', '2026-06-30', '2026-07-04'),
] as const satisfies readonly FixtureReportCardResult[]
