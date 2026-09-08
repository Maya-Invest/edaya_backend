import type { OnboardingSchoolApplication } from '../../../src/capabilities/onboarding/onboarding-application'
import { StaffMember } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { registerSchoolWithOwner } from '../../../src/capabilities/onboarding/register-school-with-owner'
import { createInMemoryTestApp } from '../../support/create-test-app'

function asSchoolApp(mem: ReturnType<typeof createInMemoryTestApp>): OnboardingSchoolApplication {
  const fullRepositories = (mem.app as { baseService?: { repositories: OnboardingSchoolApplication['repositories'] } })
    .baseService
    ?.repositories
    ?? mem.repositories as unknown as OnboardingSchoolApplication['repositories']

  return {
    repositories: fullRepositories,
    forActor: mem.forActor,
  } as OnboardingSchoolApplication
}

describe('registerSchoolWithOwner', () => {
  it('assigns the caller as school owner', async () => {
    const mem = createInMemoryTestApp()
    const application = asSchoolApp(mem)

    const result = await registerSchoolWithOwner(application, {
      user: { id: 'subject-1', email: 'admin@school.edu', name: 'Admin User' },
    }, {
      name: 'École Self',
      timeZone: 'Africa/Abidjan',
      requestId: 'req-1',
    })

    expect(result.school.ownerSubjectId).toBe('subject-1')
    expect(result.school.pendingOwnerStaffId).toBeUndefined()
  })

  it('rejects when the subject is already linked', async () => {
    const mem = createInMemoryTestApp()
    const application = asSchoolApp(mem)

    await application.repositories.staffMembers.save(new StaffMember({
      id: 'staff-existing',
      schoolId: 'sch-existing',
      firstName: 'Existing',
      lastName: 'Staff',
      subjectId: 'subject-2',
      email: 'admin@school.edu',
      isActive: true,
    }))

    await expect(registerSchoolWithOwner(application, {
      user: { id: 'subject-2', email: 'admin@school.edu', name: 'Admin User' },
    }, {
      name: 'École Conflict',
      timeZone: 'Africa/Abidjan',
      requestId: 'req-2',
    })).rejects.toMatchObject({ code: 'SUBJECT_ALREADY_LINKED' })
  })
})
