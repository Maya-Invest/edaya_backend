import type { GradeScaleInput } from '@edaya/core'
import type {
  FixtureReportCardDefinition,
  FixtureReportCardGradeScale,
  FixtureReportCardResult,
} from '../../types'
import {
  ReportCardDefinitionKind,
  ReportCardDefinitionSectionRole,
  ReportCardDefinitionStatus,
} from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../../shared/ids'

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

const demoCiSixthGradeSections = [
  {
    id: 'ci-rcs-6-fond',
    name: 'Matières fondamentales',
    role: ReportCardDefinitionSectionRole.Subjects,
    order: 1,
    weight: 2,
    coefficient: 2,
    subjectIds: ['ci-subj-fr', 'ci-subj-math', 'ci-subj-hg'],
  },
  {
    id: 'ci-rcs-6-sci',
    name: 'Sciences & langues',
    role: ReportCardDefinitionSectionRole.Subjects,
    order: 2,
    weight: 2,
    coefficient: 1.5,
    subjectIds: ['ci-subj-svt', 'ci-subj-ang', 'ci-subj-edhc'],
  },
  {
    id: 'ci-rcs-6-eps',
    name: 'EPS',
    role: ReportCardDefinitionSectionRole.Subjects,
    order: 3,
    weight: 1,
    coefficient: 1,
    subjectIds: ['ci-subj-eps'],
  },
  {
    id: 'ci-rcs-6-synth',
    name: 'Synthèse trimestrielle',
    role: ReportCardDefinitionSectionRole.Summary,
    order: 4,
    weight: 0,
    subjectIds: [],
  },
  {
    id: 'ci-rcs-6-appr',
    name: 'Appréciations',
    role: ReportCardDefinitionSectionRole.Comments,
    order: 5,
    weight: 0,
    subjectIds: [],
  },
] as const

const demoCiFifthGradeSections = [
  {
    id: 'ci-rcs-5-fond',
    name: 'Matières fondamentales',
    role: ReportCardDefinitionSectionRole.Subjects,
    order: 1,
    weight: 2,
    coefficient: 2,
    subjectIds: ['ci-subj-fr', 'ci-subj-math', 'ci-subj-hg'],
  },
  {
    id: 'ci-rcs-5-sci',
    name: 'Sciences & langues',
    role: ReportCardDefinitionSectionRole.Subjects,
    order: 2,
    weight: 2,
    coefficient: 1.5,
    subjectIds: ['ci-subj-pc', 'ci-subj-svt', 'ci-subj-ang'],
  },
  {
    id: 'ci-rcs-5-eps',
    name: 'EPS',
    role: ReportCardDefinitionSectionRole.Subjects,
    order: 3,
    weight: 1,
    coefficient: 1,
    subjectIds: ['ci-subj-eps'],
  },
  {
    id: 'ci-rcs-5-synth',
    name: 'Synthèse trimestrielle',
    role: ReportCardDefinitionSectionRole.Summary,
    order: 4,
    weight: 0,
    subjectIds: [],
  },
  {
    id: 'ci-rcs-5-appr',
    name: 'Appréciations',
    role: ReportCardDefinitionSectionRole.Comments,
    order: 5,
    weight: 0,
    subjectIds: [],
  },
] as const

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
    sections: demoCiSixthGradeSections,
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
    sections: demoCiFifthGradeSections,
  },
] as const satisfies readonly FixtureReportCardDefinition[]

function ciTrimesterOneResult({
  id,
  studentId,
  classGroupId,
  reportCardDefinitionId,
  classRank,
  classSize,
  narrativeStatus,
  homeroomComment = '',
}: {
  id: string
  studentId: string
  classGroupId: string
  reportCardDefinitionId: string
  classRank: number
  classSize: number
  narrativeStatus: 'published' | 'generated'
  homeroomComment?: string
}): FixtureReportCardResult {
  return {
    id,
    studentId,
    classGroupId,
    periodId: 'ci-2025-t1',
    reportCardDefinitionId,
    gradeScaleId: 'ci-gs-20',
    narrativeStatus,
    overallAverage: 12 + classRank,
    classRank,
    classSize,
    homeroomComment,
    generatedAt: '2025-12-15',
    publishedAt: narrativeStatus === 'published' ? '2025-12-19' : undefined,
    sectionMarks: {},
  }
}

/** Trimestre 1 — bulletins pour les classes du compte enseignant démo (6ème A/B, 5ème A). */
export const demoCiReportCardResults = [
  ...[
    ['ci-rcr-s1-t1', 'ci-s1', 'ci-6a', 1, 6, 'published', 'Bon début d\'année.'],
    ['ci-rcr-s2-t1', 'ci-s2', 'ci-6a', 2, 6, 'published', 'Travail régulier.'],
    ['ci-rcr-s3-t1', 'ci-s3', 'ci-6a', 3, 6, 'published', ''],
    ['ci-rcr-s4-t1', 'ci-s4', 'ci-6a', 4, 6, 'published', ''],
    ['ci-rcr-s5-t1', 'ci-s5', 'ci-6a', 5, 6, 'generated', ''],
    ['ci-rcr-s6-t1', 'ci-s6', 'ci-6a', 6, 6, 'published', ''],
  ].map(([id, studentId, classGroupId, classRank, classSize, narrativeStatus, homeroomComment]) =>
    ciTrimesterOneResult({
      id,
      studentId,
      classGroupId,
      reportCardDefinitionId: 'ci-rcd-6',
      classRank: Number(classRank),
      classSize: Number(classSize),
      narrativeStatus: narrativeStatus as 'published' | 'generated',
      homeroomComment,
    })),
  ...[
    ['ci-rcr-s7-t1', 'ci-s7', 'ci-6b', 1, 4, 'published', 'Élève sérieux.'],
    ['ci-rcr-s8-t1', 'ci-s8', 'ci-6b', 2, 4, 'published', ''],
    ['ci-rcr-s9-t1', 'ci-s9', 'ci-6b', 3, 4, 'published', ''],
    ['ci-rcr-s10-t1', 'ci-s10', 'ci-6b', 4, 4, 'generated', ''],
  ].map(([id, studentId, classGroupId, classRank, classSize, narrativeStatus, homeroomComment]) =>
    ciTrimesterOneResult({
      id,
      studentId,
      classGroupId,
      reportCardDefinitionId: 'ci-rcd-6',
      classRank: Number(classRank),
      classSize: Number(classSize),
      narrativeStatus: narrativeStatus as 'published' | 'generated',
      homeroomComment,
    })),
  ...[
    ['ci-rcr-s11-t1', 'ci-s11', 'ci-5a', 1, 2, 'published', 'Bonne adaptation en 5ème.'],
    ['ci-rcr-s12-t1', 'ci-s12', 'ci-5a', 2, 2, 'published', ''],
  ].map(([id, studentId, classGroupId, classRank, classSize, narrativeStatus, homeroomComment]) =>
    ciTrimesterOneResult({
      id,
      studentId,
      classGroupId,
      reportCardDefinitionId: 'ci-rcd-5',
      classRank: Number(classRank),
      classSize: Number(classSize),
      narrativeStatus: narrativeStatus as 'published' | 'generated',
      homeroomComment,
    })),
] as const satisfies readonly FixtureReportCardResult[]
