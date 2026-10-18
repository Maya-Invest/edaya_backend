import type { SchoolRepositories } from '../../ports/school-repositories'

export const WORKFLOW_REPOSITORY_KEYS = {
  setup: ['schools', 'academicYears', 'staffPermissionProfiles', 'gradeLevels'],
  accessControl: ['staffMembers', 'guardians', 'students', 'guardianLinks', 'teachers', 'staffPermissionProfiles', 'staffPermissionProfileBindings', 'staffPermissionAssignments', 'staffPermissionScopeDefaults', 'staffManualPermissionAssignments', 'academicYears'],
  academics: [
    'subjects',
    'subjectMatters',
    'sections',
    'assessments',
    'lessonSessions',
    'classGroups',
    'classSubjectProgress',
    'classSubjectMatters',
    'classSubjects',
    'gradeLevels',
  ],
  assessments: [
    'gradeScales',
    'assessmentDependencies',
    'marksCorrections',
    'students',
    'lessonSessions',
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
    'documentIssuances',
    'documentNumberSeries',
    'attachments',
    'schools',
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
    'assessments',
    'teacherAssignments',
    'teacherUnavailabilities',
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
  finance: [
    'financeProjections',
    'schools',
    'catalogServices',
    'studentServiceEnrollments',
    'studentCharges',
    'studentYearAccounts',
    'students',
    'payments',
    'allocations',
    'studentAccountEntries',
    'academicYears',
    'guardianLinks',
  ],
  invitations: ['accountInvitations', 'staffMembers', 'guardians', 'students', 'guardianLinks', 'teachers', 'schools', 'schoolNotificationTemplates'],
  documents: [
    'documentIssuances',
    'documentNumberSeries',
    'schools',
    'academicYears',
    'academicPeriods',
    'students',
    'enrollments',
    'classGroups',
    'results',
    'attachments',
    'payments',
    'studentCharges',
    'studentYearAccounts',
    'allocations',
    'studentAccountEntries',
    'incidents',
    'lessonSessions',
    'schedules',
    'attendance',
    'teachers',
    'teacherAssignments',
    'classSubjects',
    'subjects',
    'guardians',
    'guardianLinks',
  ],
  familyFeedback: [
    'familyFeedbackCampaigns',
    'familyFeedbackSlots',
    'familyFeedbackResponses',
    'familyFeedbackSnapshots',
    'familyFeedbackCommentReadAudit',
    'teacherAssignments',
    'teachers',
    'classSubjects',
    'classGroups',
    'subjects',
    'academicYears',
    'academicPeriods',
    'enrollments',
    'students',
    'guardians',
    'guardianLinks',
    'staffMembers',
    'staffPermissionAssignments',
    'schools',
  ],
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

export type DocumentsWorkflowRepositories = WorkflowRepositoryDeps<'documents'>

export type FamilyFeedbackWorkflowRepositories = WorkflowRepositoryDeps<'familyFeedback'>
