import type { SchoolRepositories } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { pickWorkflowRepositories, WORKFLOW_REPOSITORY_KEYS } from '../../src/services/runtime/workflow-repository-catalog'

describe('workflow repository catalog', () => {
  test('documents repository keys for workflows with narrow direct repository usage', () => {
    expect(WORKFLOW_REPOSITORY_KEYS.setup.length).toBeLessThan(4)
    expect(WORKFLOW_REPOSITORY_KEYS.accessControl.length).toBeLessThanOrEqual(5)
    expect(WORKFLOW_REPOSITORY_KEYS.finance.length).toBeLessThanOrEqual(4)
    expect(WORKFLOW_REPOSITORY_KEYS.invitations.length).toBeGreaterThan(4)
  })

  test('pickWorkflowRepositories returns only the declared keys', () => {
    const repositories = {
      staffMembers: { id: 'staff-repo' },
      guardians: { id: 'guardian-repo' },
      guardianLinks: { id: 'guardian-link-repo' },
      students: { id: 'student-repo' },
      schools: { id: 'school-repo' },
      academicYears: { id: 'year-repo' },
      accountInvitations: { id: 'invitation-repo' },
    } as unknown as SchoolRepositories

    const accessControl = pickWorkflowRepositories('accessControl', repositories)
    expect(Object.keys(accessControl).sort()).toEqual(['guardianLinks', 'guardians', 'staffMembers', 'students', 'teachers'])
    expect(accessControl.staffMembers).toBe(repositories.staffMembers)

    const setup = pickWorkflowRepositories('setup', repositories)
    expect(Object.keys(setup).sort()).toEqual(['academicYears', 'schools'])

    const invitations = pickWorkflowRepositories('invitations', repositories)
    expect(Object.keys(invitations).sort()).toEqual([
      'accountInvitations',
      'guardianLinks',
      'guardians',
      'schoolNotificationTemplates',
      'schools',
      'staffMembers',
      'students',
      'teachers',
    ])
  })
})
