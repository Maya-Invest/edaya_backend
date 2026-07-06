import type { SchoolRepositories } from '../../ports/repositories/school-repositories'

export const WORKFLOW_REPOSITORY_KEYS = {
  setup: ['schools', 'academicYears'],
  accessControl: ['staffMembers', 'guardians', 'students', 'guardianLinks', 'teachers'],
  academics: [
    'lessonSessions',
    'classGroups',
    'classSubjectProgress',
    'classSubjectMatters',
    'classSubjects',
  ],
  assessments: [
    'academicPeriods',
    'definitions',
    'results',
    'classSubjects',
    'sections',
    'enrollments',
    'gradeLevels',
    'attendance',
    'assessmentResults',
    'assessments',
  ],
  student: [
    'enrollments',
    'guardianLinks',
    'gradeLevels',
    'guardians',
    'classGroups',
  ],
  scheduling: [
    'schedules',
    'calendarEvents',
    'attendance',
    'attendances',
    'lessonSessions',
    'students',
    'enrollments',
  ],
  communications: [
    'announcementTargets',
    'messageDeliveries',
    'announcements',
    'classGroups',
    'gradeLevels',
    'staffMembers',
    'guardians',
    'students',
    'guardianLinks',
    'enrollments',
  ],
  behavior: [
    'studentIncidentInvolvements',
    'disciplinaryActions',
    'incidents',
    'students',
    'enrollments',
  ],
  finance: ['fees', 'studentFees', 'students', 'payments'],
  invitations: ['accountInvitations', 'staffMembers', 'guardians', 'students', 'guardianLinks', 'teachers', 'schools'],
} as const satisfies Record<string, readonly (keyof SchoolRepositories)[]>

export type WorkflowRepositoryScope = keyof typeof WORKFLOW_REPOSITORY_KEYS

export type WorkflowRepositoryDeps<Workflow extends WorkflowRepositoryScope>
  = Pick<SchoolRepositories, (typeof WORKFLOW_REPOSITORY_KEYS)[Workflow][number]>

export function pickWorkflowRepositories<Workflow extends WorkflowRepositoryScope>(
  workflow: Workflow,
  repositories: SchoolRepositories,
): WorkflowRepositoryDeps<Workflow> {
  const keys = WORKFLOW_REPOSITORY_KEYS[workflow]
  const picked = {} as WorkflowRepositoryDeps<Workflow>
  for (const key of keys) {
    Object.assign(picked, { [key]: repositories[key] })
  }
  return picked
}

export type AccessControlWorkflowRepositories = WorkflowRepositoryDeps<'accessControl'>

export type InvitationWorkflowRepositories = WorkflowRepositoryDeps<'invitations'>

export type SetupWorkflowRepositories = WorkflowRepositoryDeps<'setup'>
