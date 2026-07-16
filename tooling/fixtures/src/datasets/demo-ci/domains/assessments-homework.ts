import type { AssessmentInput, AssessmentResultInput } from '@edaya/core'
import { AssessmentKind, DeadlineComplianceStatus } from '@edaya/core'
import { demoCiClassRosters } from '../rosters'

const CI_T1 = 'ci-2025-t1'
const CI_T2 = 'ci-2025-t2'
const CI_T3 = 'ci-2025-t3'

export const demoCiHomeworkAssessments = [
  {
    id: 'ci-hw-t1-math',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-math',
    periodId: CI_T1,
    title: 'Feuille d\'exercices — fractions',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Exercices 1 à 8 sur les fractions équivalentes.',
    attachments: [{ name: 'fractions_ws.pdf', size: '180 KB' }],
    dueAt: '2025-11-10T12:00:00.000Z',
  },
  {
    id: 'ci-hw-t1-fr',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-fr',
    periodId: CI_T1,
    title: 'Lecture — La Cigale et la Fourmi',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Lire la fable et répondre aux questions de compréhension.',
    attachments: [],
    dueAt: '2025-12-08T12:00:00.000Z',
  },
  {
    id: 'ci-hw-t2-math',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-math',
    periodId: CI_T2,
    title: 'Constructions géométriques',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Construire des triangles et mesurer les angles.',
    attachments: [{ name: 'constructions.pdf', size: '95 KB' }],
    dueAt: '2026-02-24T12:00:00.000Z',
  },
  {
    id: 'ci-hw-t2-hg',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-hg',
    periodId: CI_T2,
    title: 'Carte — civilisations africaines',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Localiser les grands royaumes sur la carte fournie.',
    attachments: [{ name: 'carte_afrique.pdf', size: '240 KB' }],
    dueAt: '2026-03-18T12:00:00.000Z',
  },
  {
    id: 'ci-hw-6b-math',
    classGroupId: 'ci-6b',
    classSubjectId: 'ci-cs-6b-math',
    periodId: CI_T3,
    title: 'Fiche de révision — algèbre',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Réviser les équations pour le contrôle à venir.',
    attachments: [],
    dueAt: '2026-05-10T12:00:00.000Z',
  },
  {
    id: 'ci-hw-t3-math',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-math',
    periodId: CI_T3,
    title: 'Feuille d\'exercices n°4',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Exercices 1 à 12, page 84. Montrer tout le raisonnement.',
    attachments: [{ name: 'exercices_ch4.pdf', size: '320 KB' }],
    dueAt: '2026-05-18T12:00:00.000Z',
  },
  {
    id: 'ci-hw-t3-fr',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-fr',
    periodId: CI_T3,
    title: 'Rédaction — Le Loup et l\'Agneau',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Analyse de 300 mots sur la morale de la fable.',
    attachments: [{ name: 'fable_text.pdf', size: '120 KB' }],
    dueAt: '2026-05-22T12:00:00.000Z',
  },
  {
    id: 'ci-hw-t3-svt',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-svt',
    periodId: CI_T3,
    title: 'Lecture — biologie cellulaire',
    kind: AssessmentKind.Homework,
    maxScore: 20,
    coefficient: 1,
    description: 'Lire le chapitre 6 et répondre aux questions.',
    attachments: [],
    dueAt: '2026-05-25T12:00:00.000Z',
  },
] as const satisfies readonly AssessmentInput[]

const homeworkStatuses: Record<string, readonly DeadlineComplianceStatus[]> = {
  'ci-hw-t1-math': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Late,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Missed,
  ],
  'ci-hw-t1-fr': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Missed,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
  ],
  'ci-hw-t2-math': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Late,
  ],
  'ci-hw-t2-hg': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Missed,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
  ],
  'ci-hw-6b-math': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Missed,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
  ],
  'ci-hw-t3-math': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Missed,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Late,
  ],
  'ci-hw-t3-fr': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Missed,
    DeadlineComplianceStatus.Missed,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Missed,
  ],
  'ci-hw-t3-svt': [
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
    DeadlineComplianceStatus.Met,
  ],
}

function buildHomeworkSubmissions(): AssessmentResultInput[] {
  const submissions: AssessmentResultInput[] = []

  for (const homework of demoCiHomeworkAssessments) {
    const roster = demoCiClassRosters[homework.classGroupId as keyof typeof demoCiClassRosters] ?? []
    const statuses = homeworkStatuses[homework.id] ?? []
    for (const [index, studentId] of roster.entries()) {
      submissions.push({
        id: `ci-hs-${homework.id}-${studentId}`,
        assessmentId: homework.id,
        studentId,
        status: statuses[index] ?? DeadlineComplianceStatus.Met,
      })
    }
  }

  return submissions
}

export const demoCiHomeworkSubmissions = buildHomeworkSubmissions() as readonly AssessmentResultInput[]
