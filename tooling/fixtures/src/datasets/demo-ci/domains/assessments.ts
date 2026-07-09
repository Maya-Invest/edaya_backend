import type { AssessmentInput } from '@edaya/core'
import { AssessmentKind } from '@edaya/core'
import { demoCiClassRosters } from '../rosters'

const CI_T1_PERIOD_ID = 'ci-2025-t1'

function t1Assessment(
  id: string,
  classGroupId: string,
  classSubjectId: string,
  title: string,
  startsAt: string,
  coefficient = 1,
): AssessmentInput {
  return {
    id,
    classGroupId,
    classSubjectId,
    periodId: CI_T1_PERIOD_ID,
    title,
    kind: AssessmentKind.Other,
    maxScore: 20,
    coefficient,
    startsAt,
    endsAt: startsAt.replace('T09:00', 'T10:00'),
  }
}

function scoreMap(studentIds: readonly string[], start = 15): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [index, studentId] of studentIds.entries()) {
    result[studentId] = Math.max(8, start - index)
  }
  return result
}

export const demoCiInClassAssessments = [
  t1Assessment('ci-asm-6a-t1-math', 'ci-6a', 'ci-cs-6a-math', 'Évaluation — nombres et calcul', '2025-11-15T09:00:00.000Z', 2),
  t1Assessment('ci-asm-6a-t1-fr', 'ci-6a', 'ci-cs-6a-fr', 'Compréhension écrite', '2025-12-05T09:00:00.000Z'),
  t1Assessment('ci-asm-6a-t1-hg', 'ci-6a', 'ci-cs-6a-hg', 'Interrogation — civilisations', '2025-10-22T09:00:00.000Z'),
  t1Assessment('ci-asm-6a-t1-svt', 'ci-6a', 'ci-cs-6a-svt', 'Le monde vivant', '2025-11-28T09:00:00.000Z', 2),
  t1Assessment('ci-asm-6a-t1-ang', 'ci-6a', 'ci-cs-6a-ang', 'Reading & vocabulary', '2025-12-10T09:00:00.000Z'),
  t1Assessment('ci-asm-6a-t1-edhc', 'ci-6a', 'ci-cs-6a-edhc', 'Citoyenneté — devoirs et droits', '2025-11-08T09:00:00.000Z'),
  t1Assessment('ci-asm-6a-t1-eps', 'ci-6a', 'ci-cs-6a-eps', 'Évaluation motricité', '2025-12-12T09:00:00.000Z'),

  t1Assessment('ci-asm-6b-t1-math', 'ci-6b', 'ci-cs-6b-math', 'Évaluation — nombres et calcul', '2025-11-16T09:00:00.000Z', 2),
  t1Assessment('ci-asm-6b-t1-fr', 'ci-6b', 'ci-cs-6b-fr', 'Compréhension écrite', '2025-12-06T09:00:00.000Z'),
  t1Assessment('ci-asm-6b-t1-hg', 'ci-6b', 'ci-cs-6b-hg', 'Interrogation — civilisations', '2025-10-23T09:00:00.000Z'),
  t1Assessment('ci-asm-6b-t1-ang', 'ci-6b', 'ci-cs-6b-ang', 'Reading & vocabulary', '2025-12-11T09:00:00.000Z'),
  t1Assessment('ci-asm-6b-t1-eps', 'ci-6b', 'ci-cs-6b-eps', 'Évaluation motricité', '2025-12-13T09:00:00.000Z'),

  t1Assessment('ci-asm-5a-t1-math', 'ci-5a', 'ci-cs-5a-math', 'Évaluation — fonctions', '2025-11-17T09:00:00.000Z', 2),
  t1Assessment('ci-asm-5a-t1-fr', 'ci-5a', 'ci-cs-5a-fr', 'Dissertation', '2025-12-07T09:00:00.000Z'),
  t1Assessment('ci-asm-5a-t1-hg', 'ci-5a', 'ci-cs-5a-hg', 'Analyse documentaire', '2025-10-24T09:00:00.000Z'),
  t1Assessment('ci-asm-5a-t1-pc', 'ci-5a', 'ci-cs-5a-pc', 'TP — transformations chimiques', '2025-11-20T09:00:00.000Z', 2),
  t1Assessment('ci-asm-5a-t1-svt', 'ci-5a', 'ci-cs-5a-svt', 'Génétique', '2025-11-29T09:00:00.000Z', 2),
  t1Assessment('ci-asm-5a-t1-ang', 'ci-5a', 'ci-cs-5a-ang', 'Oral comprehension', '2025-12-14T09:00:00.000Z'),
  t1Assessment('ci-asm-5a-t1-eps', 'ci-5a', 'ci-cs-5a-eps', 'Course endurance', '2025-12-15T09:00:00.000Z'),

  t1Assessment('ci-asm-4a-t1-math', 'ci-4a', 'ci-cs-4a-math', 'Évaluation — équations', '2025-11-18T09:00:00.000Z', 2),
  t1Assessment('ci-asm-4a-t1-fr', 'ci-4a', 'ci-cs-4a-fr', 'Commentaire composé', '2025-12-08T09:00:00.000Z'),
  t1Assessment('ci-asm-4a-t1-pc', 'ci-4a', 'ci-cs-4a-pc', 'TP — réactions acide-base', '2025-11-21T09:00:00.000Z', 2),
  t1Assessment('ci-asm-4a-t1-hg', 'ci-4a', 'ci-cs-4a-hg', 'Cartographie', '2025-10-25T09:00:00.000Z'),

  t1Assessment('ci-asm-3a-t1-math', 'ci-3a', 'ci-cs-3a-math', 'Évaluation — fonctions affines', '2025-11-19T09:00:00.000Z', 2),
  t1Assessment('ci-asm-3a-t1-fr', 'ci-3a', 'ci-cs-3a-fr', 'Dissertation — argumentation', '2025-12-09T09:00:00.000Z'),
  t1Assessment('ci-asm-3a-t1-pc', 'ci-3a', 'ci-cs-3a-pc', 'TP — électricité', '2025-11-22T09:00:00.000Z', 2),
  t1Assessment('ci-asm-3a-t1-svt', 'ci-3a', 'ci-cs-3a-svt', 'Écosystèmes', '2025-11-30T09:00:00.000Z', 2),
] as const satisfies readonly AssessmentInput[]

export const demoCiAssessmentResultScores = Object.fromEntries(
  demoCiInClassAssessments.map((assessment) => {
    const roster = demoCiClassRosters[assessment.classGroupId as keyof typeof demoCiClassRosters] ?? []
    return [assessment.id, scoreMap(roster)]
  }),
) as Record<string, Partial<Record<string, number>>>
