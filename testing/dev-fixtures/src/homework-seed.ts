import { SEED_DEADLINES } from './activities-deadlines-seed'
import { SEED_SCHOOL_ID } from './dataset'

const SUBJECT_TO_CLASS_SUBJECT_6A = {
  'Mathematics': 'cs-6a-math',
  'French Literature': 'cs-6a-fr',
  'Natural Sciences': 'cs-6a-sci',
  'History & Geography': 'cs-6a-hist',
} as const

const DEADLINE_TYPE_TO_HOMEWORK_TYPE = {
  Homework: 'homework',
  Project: 'project',
  Reading: 'reading',
  Lab: 'lab',
} as const

export const SEED_HOMEWORK_ASSIGNMENTS = SEED_DEADLINES.map(deadline => ({
  id: deadline.id,
  schoolId: SEED_SCHOOL_ID,
  classGroupId: deadline.classGroupId,
  classSubjectId: SUBJECT_TO_CLASS_SUBJECT_6A[deadline.subject as keyof typeof SUBJECT_TO_CLASS_SUBJECT_6A],
  title: deadline.title,
  description: deadline.description,
  dueDate: deadline.dueDate,
  assignedDate: deadline.assignedDate,
  type: DEADLINE_TYPE_TO_HOMEWORK_TYPE[deadline.type],
  attachments: deadline.attachments.map(attachment => ({ ...attachment })),
}))

export const SEED_HOMEWORK_SUBMISSIONS = SEED_DEADLINES.flatMap(deadline =>
  deadline.submissions.map(submission => ({
    id: `hs-${deadline.id}-${submission.studentId}`,
    homeworkAssignmentId: deadline.id,
    studentId: submission.studentId,
    status: submission.status,
    submittedAt: 'date' in submission ? submission.date : undefined,
  })),
)
