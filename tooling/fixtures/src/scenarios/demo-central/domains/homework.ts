import { SEED_SCHOOL_ID } from '../core'
import { SEED_DEADLINES } from './activities-deadlines'

const SUBJECT_TO_CLASS_SUBJECT: Record<string, Record<string, string>> = {
  '6a': {
    'Mathematics': 'cs-6a-math',
    'French Literature': 'cs-6a-fr',
    'Natural Sciences': 'cs-6a-sci',
    'History & Geography': 'cs-6a-hist',
  },
  '6b': {
    'Mathematics': 'cs-6b-math',
    'French Literature': 'cs-6b-fr',
  },
}

const DEADLINE_TYPE_TO_HOMEWORK_TYPE = {
  Homework: 'homework',
  Project: 'project',
  Reading: 'reading',
  Lab: 'lab',
} as const

export const SEED_HOMEWORK_ASSIGNMENTS = SEED_DEADLINES.map((deadline) => {
  const classSubjects = SUBJECT_TO_CLASS_SUBJECT[deadline.classGroupId]
  const classSubjectId = classSubjects?.[deadline.subject]
  if (!classSubjectId) {
    throw new Error(`No class subject for ${deadline.classGroupId} / ${deadline.subject}`)
  }
  return {
    id: deadline.id,
    schoolId: SEED_SCHOOL_ID,
    classGroupId: deadline.classGroupId,
    classSubjectId,
    title: deadline.title,
    description: deadline.description,
    dueDate: deadline.dueDate,
    assignedDate: deadline.assignedDate,
    type: DEADLINE_TYPE_TO_HOMEWORK_TYPE[deadline.type],
    attachments: deadline.attachments.map(attachment => ({ ...attachment })),
  }
})

export const SEED_HOMEWORK_SUBMISSIONS = SEED_DEADLINES.flatMap(deadline =>
  deadline.submissions.map(submission => ({
    id: `hs-${deadline.id}-${submission.studentId}`,
    homeworkAssignmentId: deadline.id,
    studentId: submission.studentId,
    status: submission.status,
    submittedAt: 'date' in submission ? submission.date : undefined,
  })),
)

export function countSeedHomeworkAssignments(): number {
  return SEED_HOMEWORK_ASSIGNMENTS.length
}
