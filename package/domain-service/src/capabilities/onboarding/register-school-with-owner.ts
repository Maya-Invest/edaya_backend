import type { EdayaSparkS2sKeyMode } from '@edaya/authorization'
import type { School } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { OnboardingSchoolApplication } from './onboarding-application'
import { randomUUID } from 'node:crypto'
import { createSchoolBootstrapActor, provisionEdayaSparkReadS2sClient } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'

export interface RegisterSchoolOwnerSession {
  user: {
    id: string
    email?: string
    name?: string
    emailVerified?: boolean
  }
}

export interface RegisterSchoolWithOwnerInput {
  shortName?: string
  name: string
  timeZone: string
  financeCurrency?: string
  country?: string
  city?: string
  requestId: string
  id?: string
  ownerStaffId?: string
  ownerFirstName?: string
  ownerLastName?: string
  ownerEmail?: string
  edayaSparkS2sKeyMode?: EdayaSparkS2sKeyMode
}

export interface RegisterSchoolWithOwnerResult {
  school: School
}

interface SelectedStaffProfile { schoolId: string, staffMemberId: string }

async function assertMayRegisterSchool(
  repositories: SchoolRepositories,
  subjectId: string,
  source?: SelectedStaffProfile,
): Promise<void> {
  if (source) {
    const [school, staff] = await Promise.all([
      repositories.schools.findById(source.schoolId),
      repositories.staffMembers.findById(source.staffMemberId),
    ])
    if (school?.ownerSubjectId === subjectId && staff?.schoolId === source.schoolId && staff.isActive && staff.accountKind === 'human' && staff.subjectId === subjectId)
      return
  }
  const [staff, guardian, student, teacher] = await Promise.all([
    repositories.staffMembers.findOne({ subjectId }),
    repositories.guardians.findOne({ subjectId }),
    repositories.students.findOne({ subjectId }),
    repositories.teachers.findOne({ subjectId }),
  ])

  if (staff || guardian || student || teacher) {
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
  source?: SelectedStaffProfile,
): Promise<RegisterSchoolWithOwnerResult> {
  const subjectId = session.user.id

  const schoolId = input.id ?? randomUUID()
  const owner = input.ownerFirstName && input.ownerLastName
    ? {
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
        ...(input.ownerEmail ? { email: input.ownerEmail } : {}),
      }
    : resolveOwnerProfile(session)

  const callerStaffId = input.ownerStaffId ?? randomUUID()
  const actor = createSchoolBootstrapActor({
    schoolId,
    requestId: input.requestId,
  })
  const service = application.forActor(actor)

  return service.baseService.atomicExecution.execute(async () => {
    await assertMayRegisterSchool(application.repositories, subjectId, source)
    if (await application.repositories.schools.findById(schoolId) || await application.repositories.staffMembers.findById(callerStaffId))
      throw new BusinessRuleViolationError('ONBOARDING_ID_ALREADY_USED', 'School registration requires a new school and staff profile')
    const school = await service.setupWorkflow.registerSchool({
      id: schoolId,
      name: input.name,
      shortName: input.shortName,
      timeZone: input.timeZone,
      financeCurrency: input.financeCurrency,
      ownerSubjectId: subjectId,
      ...(input.country ? { country: input.country } : {}),
      ...(input.city ? { city: input.city } : {}),
    })

    await service.setupWorkflow.registerStaffMember({
      id: callerStaffId,
      schoolId,
      firstName: owner.firstName,
      lastName: owner.lastName,
      sendAccountInvitation: false,
      ...(owner.email ? { email: owner.email } : {}),
    })

    await service.accessControlWorkflow.linkActorSubject({ staffMemberId: callerStaffId, subjectId })

    const persistedSchool = await application.repositories.schools.findById(schoolId)
    if (!persistedSchool?.ownerSubjectId) {
      throw new BusinessRuleViolationError(
        'ONBOARDING_OWNER_ASSIGNMENT_FAILED',
        'Failed to assign the caller as school owner',
      )
    }

    await provisionEdayaSparkReadS2sClient(application.repositories.s2sClients, {
      schoolId,
      createdBySubjectId: subjectId,
      keyMode: input.edayaSparkS2sKeyMode ?? 'deterministic',
    })

    return { school: persistedSchool ?? school }
  }, { lockKeys: [`school-owner:${subjectId}`, `register-school:${schoolId}`, `register-staff:${callerStaffId}`] })
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
