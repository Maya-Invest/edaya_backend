import type { SchoolRepositories } from '../../ports/school-repositories'

export const WORKFLOW_REPOSITORY_KEYS = {
  setup: ['schools', 'academicYears'],
  accessControl: ['staffMembers', 'guardians', 'students', 'guardianLinks', 'teachers'],
  academics: [
    'lessonSessions',
    'classGroups',
    'classSubjectProgress',
    'classSubjectMatters',
    'classSubjects',
    'gradeLevelSubjects',
    'gradeLevelSubjectMatters',
    'gradeLevels',
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
    'classGroups',
  ],
  student: [
    'enrollments',
    'guardianLinks',
    'gradeLevels',
    'guardians',
    'classGroups',
    'studentPhotoSubmissions',
    'attachments',
  ],
  scheduling: [
    'schedules',
    'calendarEvents',
    'attendance',
    'attendances',
    'lessonSessions',
    'students',
    'enrollments',
    'activitySessions',
    'classGroups',
    'academicYears',
    'schools',
    'classSubjects',
    'subjects',
    'activities',
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
    'teachers',
  ],
  behavior: [
    'studentIncidentInvolvements',
    'disciplinaryActions',
    'incidents',
    'students',
    'enrollments',
  ],
  finance: ['fees', 'studentFees', 'students', 'payments'],
  invitations: ['accountInvitations', 'staffMembers', 'guardians', 'students', 'guardianLinks', 'teachers', 'schools', 'schoolNotificationTemplates'],
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

export type AcademicsWorkflowRepositories = WorkflowRepositoryDeps<'academics'>

export type AssessmentsWorkflowRepositories = WorkflowRepositoryDeps<'assessments'>

export type StudentWorkflowRepositories = WorkflowRepositoryDeps<'student'>

export type SchedulingWorkflowRepositories = WorkflowRepositoryDeps<'scheduling'>

export type CommunicationsWorkflowRepositories = WorkflowRepositoryDeps<'communications'>

export type BehaviorWorkflowRepositories = WorkflowRepositoryDeps<'behavior'>

export type FinanceWorkflowRepositories = WorkflowRepositoryDeps<'finance'>
