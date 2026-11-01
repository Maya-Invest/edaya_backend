import type { SchoolRepositories } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { pickWorkflowRepositories } from '../../src/services/runtime/workflow-repository-catalog'

describe('workflow repository catalog', () => {
  test('pickWorkflowRepositories returns only the declared keys', () => {
    const repositories = {
      staffMembers: { id: 'staff-repo' },
      staffManualPermissionAssignments: { id: 'manual-repo' },
      staffPermissionScopeDefaults: { id: 'default-repo' },
      guardians: { id: 'guardian-repo' },
      guardianLinks: { id: 'guardian-link-repo' },
      students: { id: 'student-repo' },
      schools: { id: 'school-repo' },
      gradeLevels: { id: 'grade-level-repo' },
      academicYears: { id: 'year-repo' },
      accountInvitations: { id: 'invitation-repo' },
      staffPermissionProfiles: { id: 'profile-repo' },
      staffPermissionProfileBindings: { id: 'binding-repo' },
      staffPermissionAssignments: { id: 'assignment-repo' },
      teachers: { id: 'teacher-repo' },
    } as unknown as SchoolRepositories

    const accessControl = pickWorkflowRepositories('accessControl', repositories)
    expect(Object.keys(accessControl).sort()).toEqual([
      'academicYears',
      'guardianLinks',
      'guardians',
      'staffManualPermissionAssignments',
      'staffMembers',
      'staffPermissionAssignments',
      'staffPermissionProfileBindings',
      'staffPermissionProfiles',
      'staffPermissionScopeDefaults',
      'students',
      'teachers',
    ])
    expect(accessControl.staffMembers).toBe(repositories.staffMembers)

    const setup = pickWorkflowRepositories('setup', repositories)
    expect(Object.keys(setup).sort()).toEqual(['academicYears', 'gradeLevels', 'schools', 'staffPermissionProfiles'])

    expect(setup.gradeLevels).toBe(repositories.gradeLevels)

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
