import type { School, SchoolType } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { OnboardingSchoolApplication } from './onboarding-application'
import { randomUUID } from 'node:crypto'
import { createBootstrapStaffActorMetadata } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'

export interface RegisterSchoolOwnerSession {
  user: {
    id: string
    email?: string
    name?: string
  }
}

export interface RegisterSchoolWithOwnerInput {
  name: string
  timeZone: string
  type?: SchoolType
  country?: string
  city?: string
  requestId: string
  id?: string
  ownerStaffId?: string
  ownerFirstName?: string
  ownerLastName?: string
  ownerEmail?: string
}

export interface RegisterSchoolWithOwnerResult {
  school: School
}

export async function assertSubjectUnlinked(
  repositories: SchoolRepositories,
  subjectId: string,
): Promise<void> {
  const [staff, guardian, student] = await Promise.all([
    repositories.staffMembers.findOne({ subjectId }),
    repositories.guardians.findOne({ subjectId }),
    repositories.students.findOne({ subjectId }),
  ])

  if (staff || guardian || student) {
    throw new BusinessRuleViolationError(
      'SUBJECT_ALREADY_LINKED',
      'This account is already linked to a school actor',
    )
  }
}

export function resolveOwnerProfile(session: RegisterSchoolOwnerSession): {
  firstName: string
  lastName: string
  email?: string
} {
  const parsed = parseDisplayName(session.user.name)
  const firstName = parsed.firstName || 'Owner'
  const lastName = parsed.lastName || 'Account'
  const email = session.user.email?.trim()

  return {
    firstName,
    lastName,
    ...(email ? { email } : {}),
  }
}

export async function registerSchoolWithOwner(
  application: OnboardingSchoolApplication,
  session: RegisterSchoolOwnerSession,
  input: RegisterSchoolWithOwnerInput,
): Promise<RegisterSchoolWithOwnerResult> {
  const subjectId = session.user.id
  await assertSubjectUnlinked(application.repositories, subjectId)

  const schoolId = input.id ?? randomUUID()
  const owner = input.ownerFirstName && input.ownerLastName
    ? {
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
        ...(input.ownerEmail ? { email: input.ownerEmail } : {}),
      }
    : resolveOwnerProfile(session)

  const callerStaffId = input.ownerStaffId ?? randomUUID()
  const actor = createBootstrapStaffActorMetadata({
    schoolId,
    requestId: input.requestId,
    staffMemberId: callerStaffId,
    subjectId,
  })
  const service = application.forActor(actor)

  const school = await service.setupWorkflow.registerSchool({
    id: schoolId,
    name: input.name,
    timeZone: input.timeZone,
    ownerSubjectId: subjectId,
    ...(input.type ? { type: input.type } : {}),
    ...(input.country ? { country: input.country } : {}),
    ...(input.city ? { city: input.city } : {}),
  })

  await service.setupWorkflow.registerStaffMember({
    id: callerStaffId,
    schoolId,
    firstName: owner.firstName,
    lastName: owner.lastName,
    subjectId,
    ...(owner.email ? { email: owner.email } : {}),
  })

  const persistedSchool = await application.repositories.schools.findById(schoolId)
  if (!persistedSchool?.ownerSubjectId) {
    throw new BusinessRuleViolationError(
      'ONBOARDING_OWNER_ASSIGNMENT_FAILED',
      'Failed to assign the caller as school owner',
    )
  }

  return { school: persistedSchool ?? school }
}

function parseDisplayName(name: string | undefined): { firstName?: string, lastName?: string } {
  const trimmed = name?.trim()
  if (!trimmed) {
    return {}
  }

  const [firstName, ...rest] = trimmed.split(/\s+/)
  const lastName = rest.join(' ').trim()
  return {
    firstName,
    ...(lastName ? { lastName } : {}),
  }
}
