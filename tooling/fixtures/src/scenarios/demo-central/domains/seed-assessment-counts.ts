import { countSeedAssessmentResults as countInClassAssessmentResults, countSeedAssessments as countInClassAssessments } from './assessments'
import { countSeedHomeworkAssignments, SEED_HOMEWORK_SUBMISSIONS } from './homework'

export function countSeedAssessments(): number {
  return countInClassAssessments() + countSeedHomeworkAssignments()
}

export function countSeedAssessmentResults(): number {
  return countInClassAssessmentResults() + SEED_HOMEWORK_SUBMISSIONS.length
}
