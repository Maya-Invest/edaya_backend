import type { AccessSeedPort } from '../domains/access/port'
import type { ActivitiesSeedPort } from '../domains/activities/port'
import type { AssessmentsSeedPort } from '../domains/assessments/port'
import type { AttachmentsSeedPort } from '../domains/attachments/port'
import type { AttendanceSeedPort } from '../domains/attendance/port'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { CommunicationsSeedPort } from '../domains/communications/port'
import type { CurriculumSeedPort } from '../domains/curriculum/port'
import type { DisciplineSeedPort } from '../domains/discipline/port'
import type { FinanceSeedPort } from '../domains/finance/port'
import type { PopulationSeedPort } from '../domains/population/port'
import type { ProfilePicturesSeedPort } from '../domains/profile-pictures/port'
import type { ReportCardsSeedPort } from '../domains/report-cards/port'
import type { SchedulingSeedPort } from '../domains/scheduling/port'
import type { SchoolLifeSeedPort } from '../domains/school-life/port'
import type { SchoolStructureSeedPort } from '../domains/school-structure/port'
import type { StudentSupportSeedPort } from '../domains/student-support/port'
import type { TeachersSeedPort } from '../domains/teachers/port'
import type { SeedProgressReporter } from '../support/seed-progress'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import type { DevAccessSeedResult } from './run-dev-access-seed'
import type { DevAuthLinkResult } from './run-dev-auth-link'
import type { DevAuthProvisionResult } from './run-dev-auth-provision'
import type { DevSchoolSeedResult } from './run-dev-school-seed'
import { DEV_AUTH_PASSWORD } from '@edaya/fixtures/demo-login'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { ownerSubjectIdFromAuthProvision } from '../bootstrap/dev-staff-auth-seed'
import { createInProcessAccessSeedPort } from '../domains/access/in-process'
import { createInProcessActivitiesSeedPort } from '../domains/activities/in-process'
import { createInProcessAssessmentsSeedPort } from '../domains/assessments/in-process'
import { createInProcessAttachmentsSeedPort } from '../domains/attachments/in-process'
import { createInProcessAttendanceSeedPort } from '../domains/attendance/in-process'
import { createInProcessAuthLinkSeedPort } from '../domains/auth-link/in-process'
import { createInProcessCommunicationsSeedPort } from '../domains/communications/in-process'
import { createInProcessCurriculumSeedPort } from '../domains/curriculum/in-process'
import { createInProcessDisciplineSeedPort } from '../domains/discipline/in-process'
import { createInProcessFinanceSeedPort } from '../domains/finance/in-process'
import { createInProcessPopulationSeedPort } from '../domains/population/in-process'
import { createInProcessProfilePicturesSeedPort } from '../domains/profile-pictures/in-process'
import { seedDevProfilePictures } from '../domains/profile-pictures/workflow'
import { createInProcessReportCardsSeedPort } from '../domains/report-cards/in-process'
import { createInProcessSchedulingSeedPort } from '../domains/scheduling/in-process'
import { createInProcessSchoolLifeSeedPort } from '../domains/school-life/in-process'
import { createInProcessSchoolStructureSeedPort } from '../domains/school-structure/in-process'
import { createInProcessStudentSupportSeedPort } from '../domains/student-support/in-process'
import { createInProcessTeachersSeedPort } from '../domains/teachers/in-process'
import { runDevAccessSeedWithPort } from './run-dev-access-seed'
import { runDevAuthLinkWithPort } from './run-dev-auth-link'
import { runDevAuthProvision } from './run-dev-auth-provision'
import { runDevSchoolSeed } from './run-dev-school-seed'

export type DevSeedScope = 'school' | 'auth' | 'auth:link' | 'access' | 'profile-pictures' | 'all'

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
  /** Explicit teacher portal adapter; defaults to the in-process application adapter. */
  teachersPort?: TeachersSeedPort
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
  profilePicturesPort?: ProfilePicturesSeedPort
  /** API origin used to build seeded profile photo URLs. */
  apiBaseUrl?: string
  /** Skip profile photo uploads (local file storage unavailable or explicit opt-out). */
  skipProfilePhotos?: boolean
  /** Skip fixture attachment registration. */
  skipAttachments?: boolean
  profilePhotosSkipReason?: string
  progress?: SeedProgressReporter
}

export interface RunDevSeedsResults {
  school: DevSchoolSeedResult | null
  authProvision: DevAuthProvisionResult | null
  authLink: DevAuthLinkResult | null
  access: DevAccessSeedResult | null
  profilePhotos: number | null
  profilePhotosSkipped?: boolean
  profilePhotosSkipReason?: string
}

export interface LogDevSeedResultsOptions {
  isEphemeralDatabase?: boolean
}

export function parseDevSeedScope(argv: string[]): DevSeedScope {
  const arg = argv.slice(2).find(entry => !entry.startsWith('-'))

  if (!arg || arg === 'all') {
    return 'all'
  }

  if (arg === 'school' || arg === 'auth' || arg === 'auth:link' || arg === 'access' || arg === 'profile-pictures') {
    return arg
  }

  throw new Error(`Unknown seed scope: ${arg}. Usage: bun repo seed.ts [school|auth|auth:link|access|profile-pictures|all]`)
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
  const teachersPort = options.teachersPort
    ?? createInProcessTeachersSeedPort(requireApplication('teachersPort'))
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
  const profilePicturesPort = options.profilePicturesPort
    ?? createInProcessProfilePicturesSeedPort({
      application: requireApplication('profilePicturesPort'),
      apiBaseUrl: options.apiBaseUrl ?? 'http://localhost:9999',
    })
  const results: RunDevSeedsResults = {
    school: null,
    authProvision: null,
    authLink: null,
    access: null,
    profilePhotos: null,
  }

  if (scope === 'all') {
    if (!options.skipAuthProvision) {
      results.authProvision = await runDevAuthProvision(auth, {
        baseUrl: options.apiBaseUrl,
        progress: options.progress,
      })
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
      teachersPort,
      schedulingPort,
      attendancePort,
      assessmentsPort,
      reportCardsPort,
      financePort,
      activitiesPort,
      schoolLifePort,
      studentSupportPort,
      disciplinePort,
      communicationsPort,
      attachmentsPort,
      profilePicturesPort,
      apiBaseUrl: options.apiBaseUrl,
      skipProfilePhotos: options.skipProfilePhotos,
      skipAttachments: options.skipAttachments,
      progress: options.progress,
    })
    if (options.skipProfilePhotos) {
      results.profilePhotos = 0
      results.profilePhotosSkipped = true
      results.profilePhotosSkipReason = options.profilePhotosSkipReason
    }
    results.access = await runDevAccessSeedWithPort(
      accessSeedPort,
      {
        auth,
        ownerSubjectId,
        authLinkPort,
        assignmentsPort: options.accessAssignmentsSeedPort,
        beforeAssignments: options.beforeAccessAssignments,
        progress: options.progress,
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
      teachersPort,
      schedulingPort,
      attendancePort,
      assessmentsPort,
      reportCardsPort,
      financePort,
      activitiesPort,
      schoolLifePort,
      studentSupportPort,
      disciplinePort,
      communicationsPort,
      attachmentsPort,
      profilePicturesPort,
      apiBaseUrl: options.apiBaseUrl,
      skipProfilePhotos: options.skipProfilePhotos,
      skipAttachments: options.skipAttachments,
      progress: options.progress,
    })
    if (options.skipProfilePhotos) {
      results.profilePhotos = 0
      results.profilePhotosSkipped = true
      results.profilePhotosSkipReason = options.profilePhotosSkipReason
    }
  }

  if (scope === 'auth') {
    results.authProvision = await runDevAuthProvision(auth, {
      baseUrl: options.apiBaseUrl,
      progress: options.progress,
    })
  }

  if (scope === 'auth:link') {
    results.authLink = await runDevAuthLinkWithPort(authLinkPort, auth, {
      communicationsPort,
    })
  }

  if (scope === 'access') {
    results.access = await runDevAccessSeedWithPort(
      accessSeedPort,
      {
        auth,
        authLinkPort,
        assignmentsPort: options.accessAssignmentsSeedPort,
        beforeAssignments: options.beforeAccessAssignments,
        progress: options.progress,
      },
    )
  }

  if (scope === 'profile-pictures') {
    if (options.skipProfilePhotos) {
      results.profilePhotos = 0
      results.profilePhotosSkipped = true
      results.profilePhotosSkipReason = options.profilePhotosSkipReason
      return results
    }
    if (!profilePicturesPort) {
      throw new Error('profilePicturesPort must be provided for profile-pictures seed scope')
    }
    const context = resolveDevSeedContext()
    const profilePhotoTotal = (context.dataset.entities.staffMembers?.length ?? 0)
      + (context.dataset.entities.students?.length ?? 0)
      + (context.dataset.entities.guardians?.length ?? 0)
    const runProfilePictures = async (tick: (by?: number) => void) =>
      seedDevProfilePictures(
        profilePicturesPort,
        {
          apiBaseUrl: options.apiBaseUrl ?? '',
          onProgress: tick,
        },
        context.dataset,
      )
    const counts = options.progress
      ? await options.progress.step(runProfilePictures, { total: profilePhotoTotal })
      : await runProfilePictures(() => {})
    results.profilePhotos = counts.profilePhotos
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
      console.log(
        `Auth link linked ${results.authLink.linkedStaff} staff, `
        + `${results.authLink.linkedTeachers} teacher(s), and `
        + `${results.authLink.linkedGuardians} guardian(s): ${emails}`,
      )
    }
    else {
      // eslint-disable-next-line no-console
      console.log('Auth link skipped:', results.authLink.reason)
    }
  }

  if (results.access) {
    if (results.access.status === 'seeded') {
      // eslint-disable-next-line no-console
      console.log(`Access seed loaded: ${results.access.permissionAssignments} permission rows, ${results.access.staffAssignments} staff assignments`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log('Access seed skipped:', results.access.reason)
    }
  }

  if (results.profilePhotosSkipped) {
    // eslint-disable-next-line no-console
    console.log(`Profile photos skipped${results.profilePhotosSkipReason ? `: ${results.profilePhotosSkipReason}` : ''}`)
  }
  else if (results.profilePhotos !== null) {
    // eslint-disable-next-line no-console
    console.log(`Profile photos seeded: ${results.profilePhotos}`)
  }

  if (options.isEphemeralDatabase) {
    // eslint-disable-next-line no-console
    console.log('Note: in-memory school data is lost when the API process exits.')
  }
}
