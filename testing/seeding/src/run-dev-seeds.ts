import type { AccessSeedPort } from './access/port'
import type { ActivitiesSeedPort } from './activities/port'
import type { AssessmentsSeedPort } from './assessments/port'
import type { AttachmentsSeedPort } from './attachments/port'
import type { AttendanceSeedPort } from './attendance/port'
import type { AuthLinkSeedPort } from './auth-link/port'
import type { CommunicationsSeedPort } from './communications/port'
import type { CurriculumSeedPort } from './curriculum/port'
import type { DisciplineSeedPort } from './discipline/port'
import type { FinanceSeedPort } from './finance/port'
import type { LearningContentSeedPort } from './learning-content/port'
import type { PopulationSeedPort } from './population/port'
import type { ReportCardsSeedPort } from './report-cards/port'
import type { DevAccessSeedResult } from './run-dev-access-seed'
import type { DevAuthLinkResult } from './run-dev-auth-link'
import type { DevAuthProvisionResult } from './run-dev-auth-provision'
import type { DevSchoolSeedResult } from './run-dev-school-seed'
import type { SchedulingSeedPort } from './scheduling/port'
import type { SchoolLifeSeedPort } from './school-life/port'
import type { SchoolStructureSeedPort } from './school-structure/port'
import type { StudentSupportSeedPort } from './student-support/port'
import type { AuthProvisioner, SeedApplication } from './types'
import {
  DEV_AUTH_PASSWORD,
} from '@edaya/dev-fixtures'
import { createInProcessAccessSeedPort } from './access/in-process'
import { createInProcessActivitiesSeedPort } from './activities/in-process'
import { createInProcessAssessmentsSeedPort } from './assessments/in-process'
import { createInProcessAttachmentsSeedPort } from './attachments/in-process'
import { createInProcessAttendanceSeedPort } from './attendance/in-process'
import { createInProcessAuthLinkSeedPort } from './auth-link/in-process'
import { createInProcessCommunicationsSeedPort } from './communications/in-process'
import { createInProcessCurriculumSeedPort } from './curriculum/in-process'
import { ownerSubjectIdFromAuthProvision } from './dev-staff-auth-seed'
import { createInProcessDisciplineSeedPort } from './discipline/in-process'
import { createInProcessFinanceSeedPort } from './finance/in-process'
import { createInProcessLearningContentSeedPort } from './learning-content/in-process'
import { createInProcessPopulationSeedPort } from './population/in-process'
import { createInProcessReportCardsSeedPort } from './report-cards/in-process'
import { runDevAccessSeedWithPort } from './run-dev-access-seed'
import { runDevAuthLinkWithPort } from './run-dev-auth-link'
import { runDevAuthProvision } from './run-dev-auth-provision'
import { runDevSchoolSeed } from './run-dev-school-seed'
import { createInProcessSchedulingSeedPort } from './scheduling/in-process'
import { createInProcessSchoolLifeSeedPort } from './school-life/in-process'
import { createInProcessSchoolStructureSeedPort } from './school-structure/in-process'
import { createInProcessStudentSupportSeedPort } from './student-support/in-process'

export type DevSeedScope = 'school' | 'auth' | 'auth:link' | 'access' | 'all'

export interface RunDevSeedsOptions {
  scope: DevSeedScope
  application?: SeedApplication
  auth: AuthProvisioner
  /** When true, skip auth user sign-up (already done before session bootstrap). */
  skipAuthProvision?: boolean
  /** School owner subject id when auth provision ran outside runDevSeeds. */
  ownerSubjectId?: string
  /** Explicit auth-link adapter; defaults to the in-process application adapter. */
  authLinkPort?: AuthLinkSeedPort
  /** Explicit access-bootstrap adapter; defaults to the in-process application adapter. */
  accessSeedPort?: AccessSeedPort
  /** Optional separate port for staff/class assignments (e.g. owner session over HTTP). */
  accessAssignmentsSeedPort?: AccessSeedPort
  /** Runs before staff/class assignment writes when using a separate assignments port. */
  beforeAccessAssignments?: () => Promise<void>
  /** Explicit school-foundation adapter; defaults to the in-process application adapter. */
  schoolStructurePort?: SchoolStructureSeedPort
  /** Explicit student/guardian adapter; defaults to the in-process application adapter. */
  populationPort?: PopulationSeedPort
  /** Explicit curriculum adapter; defaults to the in-process application adapter. */
  curriculumPort?: CurriculumSeedPort
  /** Explicit scheduling adapter; defaults to the in-process application adapter. */
  schedulingPort?: SchedulingSeedPort
  /** Explicit attendance adapter; defaults to the in-process application adapter. */
  attendancePort?: AttendanceSeedPort
  /** Explicit assessments adapter; defaults to the in-process application adapter. */
  assessmentsPort?: AssessmentsSeedPort
  /** Explicit report-cards adapter; defaults to the in-process application adapter. */
  reportCardsPort?: ReportCardsSeedPort
  /** Explicit finance adapter; defaults to the in-process application adapter. */
  financePort?: FinanceSeedPort
  /** Explicit learning-content adapter; defaults to the in-process application adapter. */
  learningContentPort?: LearningContentSeedPort
  /** Explicit extracurricular-activities adapter; defaults to the in-process application adapter. */
  activitiesPort?: ActivitiesSeedPort
  /** Explicit calendar/incident adapter; defaults to the in-process application adapter. */
  schoolLifePort?: SchoolLifeSeedPort
  /** Explicit student-support adapter; defaults to the in-process application adapter. */
  studentSupportPort?: StudentSupportSeedPort
  /** Explicit discipline adapter; defaults to the in-process application adapter. */
  disciplinePort?: DisciplineSeedPort
  /** Explicit communications adapter; defaults to the in-process application adapter. */
  communicationsPort?: CommunicationsSeedPort
  /** Explicit attachments adapter; defaults to the in-process application adapter. */
  attachmentsPort?: AttachmentsSeedPort
}

export interface RunDevSeedsResults {
  school: DevSchoolSeedResult | null
  authProvision: DevAuthProvisionResult | null
  authLink: DevAuthLinkResult | null
  access: DevAccessSeedResult | null
}

export interface LogDevSeedResultsOptions {
  isEphemeralDatabase?: boolean
}

export function parseDevSeedScope(argv: string[]): DevSeedScope {
  const arg = argv[2]

  if (!arg || arg === 'all') {
    return 'all'
  }

  if (arg === 'school' || arg === 'auth' || arg === 'auth:link' || arg === 'access') {
    return arg
  }

  throw new Error(`Unknown seed scope: ${arg}. Usage: bun seed.ts [school|auth|auth:link|access|all]`)
}

export async function runDevSeeds(options: RunDevSeedsOptions): Promise<RunDevSeedsResults> {
  const { scope, application, auth } = options
  const requireApplication = (portName: string): SeedApplication => {
    if (!application) {
      throw new Error(`${portName} must be provided when no in-process seed application is available`)
    }
    return application
  }
  const authLinkPort = options.authLinkPort
    ?? createInProcessAuthLinkSeedPort(requireApplication('authLinkPort'))
  const accessSeedPort = options.accessSeedPort
    ?? createInProcessAccessSeedPort(requireApplication('accessSeedPort'))
  const schoolStructurePort = options.schoolStructurePort
    ?? createInProcessSchoolStructureSeedPort(requireApplication('schoolStructurePort'))
  const populationPort = options.populationPort
    ?? createInProcessPopulationSeedPort(requireApplication('populationPort'))
  const curriculumPort = options.curriculumPort
    ?? createInProcessCurriculumSeedPort(requireApplication('curriculumPort'))
  const schedulingPort = options.schedulingPort
    ?? createInProcessSchedulingSeedPort(requireApplication('schedulingPort'))
  const attendancePort = options.attendancePort
    ?? createInProcessAttendanceSeedPort(requireApplication('attendancePort'))
  const assessmentsPort = options.assessmentsPort
    ?? createInProcessAssessmentsSeedPort(requireApplication('assessmentsPort'))
  const reportCardsPort = options.reportCardsPort
    ?? createInProcessReportCardsSeedPort(requireApplication('reportCardsPort'))
  const financePort = options.financePort
    ?? createInProcessFinanceSeedPort(requireApplication('financePort'))
  const learningContentPort = options.learningContentPort
    ?? createInProcessLearningContentSeedPort(requireApplication('learningContentPort'))
  const activitiesPort = options.activitiesPort
    ?? createInProcessActivitiesSeedPort(requireApplication('activitiesPort'))
  const schoolLifePort = options.schoolLifePort
    ?? createInProcessSchoolLifeSeedPort(requireApplication('schoolLifePort'))
  const studentSupportPort = options.studentSupportPort
    ?? createInProcessStudentSupportSeedPort(requireApplication('studentSupportPort'))
  const disciplinePort = options.disciplinePort
    ?? createInProcessDisciplineSeedPort(requireApplication('disciplinePort'))
  const communicationsPort = options.communicationsPort
    ?? createInProcessCommunicationsSeedPort(requireApplication('communicationsPort'))
  const attachmentsPort = options.attachmentsPort
    ?? createInProcessAttachmentsSeedPort(requireApplication('attachmentsPort'))
  const results: RunDevSeedsResults = {
    school: null,
    authProvision: null,
    authLink: null,
    access: null,
  }

  if (scope === 'all') {
    if (!options.skipAuthProvision) {
      results.authProvision = await runDevAuthProvision(auth)
    }
    const ownerSubjectId = options.ownerSubjectId ?? (
      results.authProvision ? ownerSubjectIdFromAuthProvision(results.authProvision) : undefined
    )
    results.school = await runDevSchoolSeed(application, {
      ownerSubjectId,
      auth,
      authLinkPort,
      schoolStructurePort,
      populationPort,
      curriculumPort,
      schedulingPort,
      attendancePort,
      assessmentsPort,
      reportCardsPort,
      financePort,
      learningContentPort,
      activitiesPort,
      schoolLifePort,
      studentSupportPort,
      disciplinePort,
      communicationsPort,
      attachmentsPort,
    })
    results.access = await runDevAccessSeedWithPort(
      accessSeedPort,
      {
        auth,
        ownerSubjectId,
        authLinkPort,
        assignmentsPort: options.accessAssignmentsSeedPort,
        beforeAssignments: options.beforeAccessAssignments,
      },
    )
    return results
  }

  if (scope === 'school') {
    results.school = await runDevSchoolSeed(application, {
      auth,
      authLinkPort,
      schoolStructurePort,
      populationPort,
      curriculumPort,
      schedulingPort,
      attendancePort,
      assessmentsPort,
      reportCardsPort,
      financePort,
      learningContentPort,
      activitiesPort,
      schoolLifePort,
      studentSupportPort,
      disciplinePort,
      communicationsPort,
      attachmentsPort,
    })
  }

  if (scope === 'auth') {
    results.authProvision = await runDevAuthProvision(auth)
  }

  if (scope === 'auth:link') {
    results.authLink = await runDevAuthLinkWithPort(authLinkPort, auth)
  }

  if (scope === 'access') {
    results.access = await runDevAccessSeedWithPort(
      accessSeedPort,
      {
        auth,
        authLinkPort,
        assignmentsPort: options.accessAssignmentsSeedPort,
        beforeAssignments: options.beforeAccessAssignments,
      },
    )
  }

  return results
}

export function logDevSeedResults(
  results: RunDevSeedsResults,
  options: LogDevSeedResultsOptions = {},
): void {
  if (results.school) {
    if (results.school.status === 'skipped') {
      // eslint-disable-next-line no-console
      console.log(`School seed skipped (${results.school.reason}): ${results.school.schoolCount} school(s) already in database.`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`School seed loaded (${results.school.schoolId}): ${results.school.students} students, ${results.school.staff} staff`)
    }
  }

  if (results.authProvision) {
    const emails = results.authProvision.accounts.map(account => account.email).join(', ')
    // eslint-disable-next-line no-console
    console.log(`Auth provision seeded ${results.authProvision.accounts.length} account(s): ${emails} (password: ${DEV_AUTH_PASSWORD})`)
  }

  if (results.authLink) {
    if (results.authLink.status === 'seeded') {
      const emails = results.authLink.accounts.map(account => account.email).join(', ')
      // eslint-disable-next-line no-console
      console.log(`Auth link linked ${results.authLink.linkedStaff} staff and ${results.authLink.linkedGuardians} guardian(s): ${emails}`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log('Auth link skipped:', results.authLink.reason)
    }
  }

  if (results.access) {
    if (results.access.status === 'seeded') {
      // eslint-disable-next-line no-console
      console.log(`Access seed loaded: ${results.access.roles} roles, ${results.access.assignments} assignments`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log('Access seed skipped:', results.access.reason)
    }
  }

  if (options.isEphemeralDatabase) {
    // eslint-disable-next-line no-console
    console.log('Note: in-memory school data is lost when the API process exits.')
  }
}
