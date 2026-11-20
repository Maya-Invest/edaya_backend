import type { ActorMetadata, EdayaSparkS2sKeyMode } from '@edaya/authorization'
import type { CommandJson } from '@edaya/core'
import type { ApplyStructureTemplateResult } from './apply-structure-template'
import type { InviteStaffMembersResult } from './invite-staff-members'
import type { OnboardingAccountStatus } from './onboarding-account-state'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type { OnboardingDataset } from './onboarding-dataset'
import type { RegisterSchoolOwnerSession } from './register-school-with-owner'
import type { OnboardingStaffInviteRoleKey } from './staff-invite-roles'
import { ActorAssuranceLevel, createSchoolBootstrapActor, createStaffActorMetadata } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { digestCommandRequest } from '../../services/commands/command-execution'
import { applyStructureTemplate, resolveDatasetStructure } from './apply-structure-template'
import { ensureAcademicStructureFromDraft } from './ensure-academic-structure-from-draft'
import { inviteStaffMembers } from './invite-staff-members'
import { completeOnboardingWizard } from './onboarding-account-state'
import { onboardingDatasetSchema } from './onboarding-dataset'
import { registerSchoolWithOwner } from './register-school-with-owner'
import { isOnboardingStaffInviteRoleKey } from './staff-invite-roles'

interface ProvisionOnboardingSession extends RegisterSchoolOwnerSession {
  session?: {
    assuranceLevel: ActorAssuranceLevel
    createdAt?: Date
    id?: string
  }
}

export interface ProvisionOnboardingSchoolInput {
  shortName?: string
  name: string
  timeZone: string
  financeCurrency?: string
  city: string
  country: string
  academicYearLabel: string
  academicYearStart: string
  academicYearEnd: string
  periodType: 'trimester' | 'semester'
  periods: Array<{
    label: string
    start: string
    end: string
  }>
}

export interface ProvisionOnboardingStructureInput {
  templates: string[]
  dataset: OnboardingDataset
  levels: Array<{
    gradeLevelId: string
    classCount: number
    capacity: number
    classNamingMode?: 'alphabetical' | 'numerical'
  }>
}

export interface ProvisionOnboardingInviteInput {
  identifier?: string | null
  email: string
  role: string
}

export interface ProvisionOnboardingInput {
  ownerIdentifier?: string | null
  schoolId: string
  requestId: string
  school: ProvisionOnboardingSchoolInput
  structure: ProvisionOnboardingStructureInput
  invites?: ProvisionOnboardingInviteInput[]
}

export interface ProvisionOnboardingResult {
  schoolId: string
  yearId: string
  periodId: string
  structure: ApplyStructureTemplateResult | null
  staff: InviteStaffMembersResult
  status: OnboardingAccountStatus
  phases: Array<{ phase: string, ms: number }>
  replayed?: boolean
}

interface StoredProvisionResult {
  schoolId: string
  yearId: string
  periodId: string
  gradeLevelCount: number
  classGroupCount: number
  subjectCount: number
  classSubjectCount: number
  gradeScaleCount: number
  reportModuleCount: number
  reportSubjectAssignmentCount: number
  hasStructure: boolean
  staffInviteCount: number
  permissionAssignmentsEnsured: number
  wizardCompleted: boolean
  maxReachedStep: number
  schoolStepSubmitted: boolean
  structureStepSubmitted: boolean
  phases: Array<{ phase: string, ms: number }>
  [key: string]: CommandJson
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function requireUuid(value: string, code: string, message: string): string {
  const trimmed = value.trim()
  if (!isUuid(trimmed)) {
    throw new BusinessRuleViolationError(code, message)
  }
  return trimmed
}

function toOwnerSession(session: RegisterSchoolOwnerSession) {
  return {
    user: {
      id: session.user.id,
      emailVerified: session.user.emailVerified,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...(session.user.name ? { name: session.user.name } : {}),
    },
  }
}

function parseInvites(invites: ProvisionOnboardingInviteInput[] | undefined): Array<{
  email: string
  role: OnboardingStaffInviteRoleKey
  identifier?: string | null
}> {
  if (!invites?.length) {
    return []
  }
  return invites.map((invite) => {
    if (!isOnboardingStaffInviteRoleKey(invite.role)) {
      throw new BusinessRuleViolationError(
        'STAFF_INVITE_INVALID_ROLE',
        `Invalid staff invite role: ${invite.role}`,
      )
    }
    return {
      email: invite.email.trim().toLowerCase(),
      role: invite.role,
      identifier: invite.identifier,
    }
  })
}

function clampStep(value: number): OnboardingAccountStatus['maxReachedStep'] {
  if (value === 2 || value === 3 || value === 4) {
    return value
  }
  return 1
}

function persistProvisionResult(result: ProvisionOnboardingResult): StoredProvisionResult {
  return {
    schoolId: result.schoolId,
    yearId: result.yearId,
    periodId: result.periodId,
    gradeLevelCount: result.structure?.gradeLevelCount ?? 0,
    classGroupCount: result.structure?.classGroupCount ?? 0,
    subjectCount: result.structure?.subjectCount ?? 0,
    classSubjectCount: result.structure?.classSubjectCount ?? 0,
    gradeScaleCount: result.structure?.gradeScaleCount ?? 0,
    reportModuleCount: result.structure?.reportModuleCount ?? 0,
    reportSubjectAssignmentCount: result.structure?.reportSubjectAssignmentCount ?? 0,
    hasStructure: result.structure != null,
    staffInviteCount: result.staff.invitedCount,
    permissionAssignmentsEnsured: result.staff.permissionAssignmentsEnsured,
    wizardCompleted: result.status.wizardCompleted,
    maxReachedStep: result.status.maxReachedStep,
    schoolStepSubmitted: result.status.schoolStepSubmitted,
    structureStepSubmitted: result.status.structureStepSubmitted,
    phases: result.phases.map(phase => ({ phase: phase.phase, ms: phase.ms })),
  }
}

function storedToResult(stored: StoredProvisionResult, replayed: boolean): ProvisionOnboardingResult {
  return {
    schoolId: stored.schoolId,
    yearId: stored.yearId,
    periodId: stored.periodId,
    structure: stored.hasStructure
      ? {
          gradeLevelCount: stored.gradeLevelCount,
          classGroupCount: stored.classGroupCount,
          subjectCount: stored.subjectCount,
          classSubjectCount: stored.classSubjectCount,
          gradeScaleCount: stored.gradeScaleCount,
          reportModuleCount: stored.reportModuleCount,
          reportSubjectAssignmentCount: stored.reportSubjectAssignmentCount,
          phases: [],
        }
      : null,
    staff: {
      invitedCount: stored.staffInviteCount,
      permissionAssignmentsEnsured: stored.permissionAssignmentsEnsured,
    },
    status: {
      wizardCompleted: stored.wizardCompleted === true,
      maxReachedStep: clampStep(stored.maxReachedStep),
      schoolStepSubmitted: stored.schoolStepSubmitted === true,
      structureStepSubmitted: stored.structureStepSubmitted === true,
    },
    phases: stored.phases,
    ...(replayed ? { replayed: true } : {}),
  }
}

async function resolveOwnerActorAfterRegister(
  application: OnboardingSchoolApplication,
  session: ProvisionOnboardingSession,
  schoolId: string,
  requestId: string,
): Promise<ActorMetadata> {
  const staff = await application.repositories.staffMembers.findOne({
    subjectId: session.user.id,
    schoolId,
  })
  if (!staff) {
    throw new BusinessRuleViolationError(
      'ONBOARDING_OWNER_STAFF_MISSING',
      'Owner staff member was not found after school registration',
    )
  }
  return createStaffActorMetadata({
    schoolId,
    requestId,
    staffMemberId: staff.id,
    subjectId: session.user.id,
    authenticatedAt: session.session?.createdAt ?? new Date(),
    sessionId: session.session?.id,
    assuranceLevel: session.session?.assuranceLevel
      ?? (session.user.emailVerified ? ActorAssuranceLevel.Verified : ActorAssuranceLevel.Standard),
  })
}

async function assertProvisionCallerAvailable(
  application: OnboardingSchoolApplication,
  subjectId: string,
  schoolId: string,
): Promise<void> {
  const [staff, guardian, student, teacher] = await Promise.all([
    application.repositories.staffMembers.findOne({ subjectId }),
    application.repositories.guardians.findOne({ subjectId }),
    application.repositories.students.findOne({ subjectId }),
    application.repositories.teachers.findOne({ subjectId }),
  ])

  if (staff && staff.schoolId === schoolId) {
    return
  }

  if (staff || guardian || student || teacher) {
    throw new BusinessRuleViolationError(
      'SUBJECT_ALREADY_LINKED',
      'This account is already linked to a school actor',
    )
  }
}

async function executeProvision(
  application: OnboardingSchoolApplication,
  session: ProvisionOnboardingSession,
  input: ProvisionOnboardingInput,
  options: {
    existingActor?: ActorMetadata
    inviteBaseUrl?: string
    edayaSparkS2sKeyMode?: EdayaSparkS2sKeyMode
  },
  schoolId: string,
  requestId: string,
): Promise<ProvisionOnboardingResult> {
  const phases: Array<{ phase: string, ms: number }> = []
  const track = async <T>(phase: string, run: () => Promise<T>): Promise<T> => {
    const phaseStarted = performance.now()
    try {
      return await run()
    }
    finally {
      phases.push({ phase, ms: performance.now() - phaseStarted })
    }
  }

  const templates = input.structure.templates
  const invites = parseInvites(input.invites)
  let actor: ActorMetadata

  if (options.existingActor?.kind === 'staff' && options.existingActor.schoolId === schoolId) {
    actor = options.existingActor
  }
  else {
    await track('registerSchool', async () => {
      return registerSchoolWithOwner(application, toOwnerSession(session), {
        id: schoolId,
        name: input.school.name,
        shortName: input.school.shortName,
        ownerIdentifier: input.ownerIdentifier,
        timeZone: input.school.timeZone,
        financeCurrency: input.school.financeCurrency,
        city: input.school.city,
        country: input.school.country,
        requestId,
        ...(options.edayaSparkS2sKeyMode
          ? { edayaSparkS2sKeyMode: options.edayaSparkS2sKeyMode }
          : {}),
      })
    })
    actor = await track('resolveOwnerActor', async () => {
      return resolveOwnerActorAfterRegister(application, session, schoolId, requestId)
    })
  }

  const academic = await track('ensureAcademicStructure', async () => {
    return ensureAcademicStructureFromDraft(application, actor, {
      schoolId,
      academicYearLabel: input.school.academicYearLabel,
      academicYearStart: input.school.academicYearStart,
      academicYearEnd: input.school.academicYearEnd,
      periodType: input.school.periodType,
      periods: input.school.periods,
    })
  })

  let structure: ApplyStructureTemplateResult | null = null
  try {
    structure = await applyStructureTemplate(application, actor, {
      templates,
      dataset: input.structure.dataset,
      academicYearId: academic.yearId,
      levels: input.structure.levels,
    })
    for (const phase of structure.phases) {
      phases.push(phase)
    }
  }
  catch (error) {
    if (
      error instanceof BusinessRuleViolationError
      && error.code === 'STRUCTURE_ALREADY_CONFIGURED'
    ) {
      structure = null
    }
    else {
      throw error
    }
  }

  let staff: InviteStaffMembersResult = { invitedCount: 0, permissionAssignmentsEnsured: 0 }
  if (invites.length > 0) {
    staff = await track('inviteStaffMembers', async () => {
      return inviteStaffMembers(application, actor, { invites }, {
        inviteBaseUrl: options.inviteBaseUrl,
        registrationActor: createSchoolBootstrapActor({ schoolId, requestId, onBehalfOfSubjectId: session.user.id }),
      })
    })
  }

  const status = await track('completeWizard', async () => {
    return completeOnboardingWizard(application.repositories, actor)
  })

  return {
    schoolId,
    yearId: academic.yearId,
    periodId: academic.periodId,
    structure,
    staff,
    status,
    phases,
  }
}

export async function provisionOnboarding(
  application: OnboardingSchoolApplication,
  session: ProvisionOnboardingSession,
  input: ProvisionOnboardingInput,
  options: {
    requestId?: string
    existingActor?: ActorMetadata
    inviteBaseUrl?: string
    allowPublicSchoolRegistration: boolean
    edayaSparkS2sKeyMode?: EdayaSparkS2sKeyMode
  },
): Promise<ProvisionOnboardingResult> {
  if (!options.allowPublicSchoolRegistration && options.existingActor?.kind !== 'staff') {
    throw new BusinessRuleViolationError(
      'PUBLIC_SCHOOL_REGISTRATION_DISABLED',
      'Public school registration is disabled',
    )
  }

  input = { ...input, structure: { ...input.structure, dataset: onboardingDatasetSchema.parse(input.structure.dataset) } }
  resolveDatasetStructure(input.structure)

  const schoolId = requireUuid(input.schoolId, 'ONBOARDING_SCHOOL_ID_INVALID', 'A stable school identity is required')
  const requestId = requireUuid(
    input.requestId || options.requestId || '',
    'ONBOARDING_REQUEST_ID_INVALID',
    'A stable provision request identity is required',
  )
  const subjectId = session.user.id
  const callerId = await digestCommandRequest(['identity', subjectId])
  const scopedRequestId = await digestCommandRequest(requestId)

  return application.commandExecution.execute({
    scope: {
      schoolId,
      command: 'onboarding.provision',
      callerId,
      requestId: scopedRequestId,
    },
    input: {
      schoolId,
      requestId,
      school: input.school,
      ownerIdentifier: input.ownerIdentifier,
      structure: {
        templates: input.structure.templates,
        levels: input.structure.levels,
        dataset: input.structure.dataset,
      },
      invites: parseInvites(input.invites),
    },
    resultMode: 'ordinary',
    lockKeys: [`school-owner:${subjectId}`, `onboarding-provision:${schoolId}`],
    authorize: async () => {
      await assertProvisionCallerAvailable(application, subjectId, schoolId)
    },
    replay: async (stored: StoredProvisionResult) => {
      const school = await application.repositories.schools.findById(stored.schoolId)
      if (!school || school.ownerSubjectId !== subjectId) {
        throw new BusinessRuleViolationError(
          'COMMAND_REPLAY_CONFLICT',
          'Provision receipt does not match this account',
        )
      }
      return storedToResult(stored, true)
    },
    persistResult: persistProvisionResult,
    audit: result => [{
      event: 'onboarding.school_provisioned',
      resourceType: 'school',
      resourceId: result.schoolId,
    }],
    execute: async () => executeProvision(application, session, input, options, schoolId, requestId),
  })
}
