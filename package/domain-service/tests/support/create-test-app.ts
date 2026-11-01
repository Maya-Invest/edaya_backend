import type { ActorMetadata } from '@edaya/authorization'
import type { FileStoragePort, Filter, NotificationGatewayPort, QueryOptions } from '@edaya/core'
import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { noOpNotificationGateway, School, StaffMember } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { PostgresCommandJournal } from '../../../adaptor-postgres/src/stores/command-journal-store'
import { PostgresDurableWork } from '../../../adaptor-postgres/src/stores/durable-work-store'
import { acquireDatabase } from './database-pool'
import { matchesFilter } from './filter-matcher'
import { testFileStorage } from './test-file-storage'

interface EntityWithId {
  readonly id: string
}

interface TransactionParticipant {
  begin: () => void
  commit: () => void
  rollback: () => void
}

export function createStore<T extends EntityWithId>(participants: TransactionParticipant[] = []) {
  const entries = new Map<string, T>()
  let snapshot: Map<string, T> | undefined
  participants.push({
    begin: () => {
      snapshot = new Map(entries)
    },
    commit: () => {
      snapshot = undefined
    },
    rollback: () => {
      entries.clear()
      for (const [id, entity] of snapshot ?? []) {
        entries.set(id, entity)
      }
      snapshot = undefined
    },
  })
  const store = {
    forAccess: (): never => { throw new Error('Authorization tests require the native repository fixture') },
    assertAccess: async (): Promise<never> => { throw new Error('Authorization tests require the native repository fixture') },
    findById: async (id: string) => entries.get(id),
    findByIds: async (ids: readonly string[]) => ids.map(id => entries.get(id)).filter((entity): entity is T => entity !== undefined),
    findOne: async (options?: Filter<T>) => {
      const results = await store.list(options)
      return results[0]
    },
    list: async (options?: QueryOptions<T>) => {
      let result = [...entries.values()]
      if (options) {
        // Extract filter by omitting $ prefixed keys
        const filter: any = {}
        for (const key of Object.keys(options)) {
          if (!key.startsWith('$')) {
            filter[key] = (options as any)[key]
          }
        }
        if (Object.keys(filter).length > 0) {
          result = result.filter(entity => matchesFilter(entity, filter))
        }

        if (options.$orderBy) {
          result.sort((a, b) => {
            for (const { field, direction } of options.$orderBy!) {
              const valA = a[field]
              const valB = b[field]
              if (valA < valB)
                return direction === 'asc' ? -1 : 1
              if (valA > valB)
                return direction === 'asc' ? 1 : -1
            }
            return 0
          })
        }
        if (options.$offset !== undefined || options.$limit !== undefined) {
          const offset = options.$offset ?? 0
          result = result.slice(offset, options.$limit !== undefined ? offset + options.$limit : undefined)
        }
      }
      return result
    },
    save: async (entity: T) => {
      entries.set(entity.id, entity)
    },
    delete: async (id: string) => {
      entries.delete(id)
    },
    count: async (filter?: Filter<T>) => {
      const all = [...entries.values()]
      if (!filter)
        return all.length
      return all.filter(entity => matchesFilter(entity, filter)).length
    },
    batchSave: async (entitiesToSave: T[]) => {
      for (const entity of entitiesToSave) {
        entries.set(entity.id, entity)
      }
      return entitiesToSave.map(e => e.id)
    },
    batchDelete: async (ids: readonly string[]) => {
      for (const id of ids) {
        entries.delete(id)
      }
    },
  }
  return store
}

const failureResources = {
  classSubjectMatterRepository: 'classSubjectMatters',
  messageDeliveryRepository: 'messageDeliveries',
  reportCardResultRepository: 'results',
  lessonSessionRepository: 'lessonSessions',
  activitySessionRepository: 'activitySessions',
  studentClassEnrollmentRepository: 'enrollments',
  studentFeeRepository: 'studentCharges',
} as const
export type FailableRepository = keyof typeof failureResources

/** Uses the production SQL compiler and transaction implementation; no test authorization evaluator. */
export async function createTestApp(actor?: ActorMetadata, options: { owner?: boolean, notificationGateway?: NotificationGatewayPort, fileStorage?: FileStoragePort, documentRenderer?: import('@edaya/core').DocumentRendererPort } = {}) {
  const { repositories: nativeRepositories, atomic: atomicExecution, db, connection } = await acquireDatabase()
  let saveFailure: { repository: FailableRepository, remainingAttempts: number } | undefined
  const failSaveOnAttempt = (repository: FailableRepository, attempt = 1) => {
    saveFailure = { repository, remainingAttempts: attempt }
  }
  function withSaveFailure<T extends object>(store: T, key: FailableRepository): T {
    return new Proxy(store, {
      get(target, property) {
        const method = Reflect.get(target, property)
        if (typeof method !== 'function')
          return method
        if (property === 'forAccess' || property === 'forSchool')
          return (...args: unknown[]) => withSaveFailure(Reflect.apply(method, target, args), key)
        return async (...args: unknown[]) => {
          if (property === 'save' && saveFailure?.repository === key && --saveFailure.remainingAttempts === 0) {
            saveFailure = undefined
            throw new Error(`Simulated ${key} save failure`)
          }
          return Reflect.apply(method, target, args)
        }
      },
    })
  }
  const schoolRepositories = new Proxy(nativeRepositories, {
    get(target, property) {
      const value = Reflect.get(target, property)
      const failureKey = (Object.keys(failureResources) as FailableRepository[]).find(key => failureResources[key] === property)
      return failureKey ? withSaveFailure(value, failureKey) : typeof value === 'function' ? value.bind(target) : value
    },
  })
  const defaultActor = actor ?? createStaffActorMetadata({
    subjectId: 'admin-user',
    staffMemberId: 'admin',
    schoolId: 'school',
    requestId: 'service-test',
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Strong,
  })
  if (defaultActor.kind === 'staff') {
    await nativeRepositories.schools.save(new School({ id: defaultActor.schoolId, name: 'Fixture school', timeZone: 'UTC', financeCurrency: 'USD', ...((options.owner ?? !actor) ? { ownerSubjectId: defaultActor.subjectId } : {}) }))
    await nativeRepositories.staffMembers.save(new StaffMember({ id: defaultActor.staffMemberId, schoolId: defaultActor.schoolId, firstName: 'Fixture', lastName: 'Staff', accountKind: defaultActor.accountKind, ...(defaultActor.accountKind === 'human' ? { subjectId: defaultActor.subjectId } : { serviceId: 'fixture-service' }) }))
  }
  const durableWork = new PostgresDurableWork(connection)
  const application = new SchoolApplication({
    atomicExecution,
    commandJournal: new PostgresCommandJournal(),
    durableWork,
    documentRenderer: options.documentRenderer,
    notificationGateway: options.notificationGateway ?? noOpNotificationGateway,
    fileStorage: options.fileStorage ?? testFileStorage,
    repositories: schoolRepositories,
    accountInvitationsEnabled: false,
  })
  const testRepositories = {

    schoolRepository: schoolRepositories.schools,
    schools: schoolRepositories.schools,
    students: schoolRepositories.students,
    staffMembers: schoolRepositories.staffMembers,
    catalogServiceRepository: schoolRepositories.catalogServices,
    studentFeeRepository: schoolRepositories.studentCharges,
    studentChargeRepository: schoolRepositories.studentCharges,
    studentYearAccountRepository: schoolRepositories.studentYearAccounts,
    payments: schoolRepositories.payments,
    attendance: schoolRepositories.attendance,
    incidents: schoolRepositories.incidents,
    academicYearRepository: schoolRepositories.academicYears,
    academicPeriodRepository: schoolRepositories.academicPeriods,
    periodDefinitionRepository: schoolRepositories.periodDefinitions,
    gradeLevelRepository: schoolRepositories.gradeLevels,
    classGroupRepository: schoolRepositories.classGroups,
    studentRepository: schoolRepositories.students,
    StudentClassEnrollmentRepository: schoolRepositories.enrollments,
    guardianRepository: schoolRepositories.guardians,
    guardianStudentLinkRepository: schoolRepositories.guardianLinks,
    staffMemberRepository: schoolRepositories.staffMembers,
    staffAssignmentRepository: schoolRepositories.staffAssignments,
    teacherRepository: schoolRepositories.teachers,
    teacherAssignmentRepository: schoolRepositories.teacherAssignments,
    subjectRepository: schoolRepositories.subjects,
    subjectMatterRepository: schoolRepositories.subjectMatters,
    classSubjectRepository: schoolRepositories.classSubjects,
    classSubjectMatterRepository: schoolRepositories.classSubjectMatters,
    classSubjectProgressRepository: schoolRepositories.classSubjectProgress,
    lessonSessionRepository: schoolRepositories.lessonSessions,
    attendanceOccurrenceRepository: schoolRepositories.attendances,
    assessmentRepository: schoolRepositories.assessments,
    attendanceRepository: schoolRepositories.attendance,
    assessmentResultRepository: schoolRepositories.assessmentResults,
    gradeScaleRepository: schoolRepositories.gradeScales,
    reportModuleRepository: schoolRepositories.reportModules,
    reportCardResultRepository: schoolRepositories.results,
    announcementRepository: schoolRepositories.announcements,
    announcementTargetRepository: schoolRepositories.announcementTargets,
    messageDeliveryRepository: schoolRepositories.messageDeliveries,
    catalogServices: schoolRepositories.catalogServices,
    studentServiceEnrollments: schoolRepositories.studentServiceEnrollments,
    studentCharges: schoolRepositories.studentCharges,
    studentYearAccounts: schoolRepositories.studentYearAccounts,
    allocations: schoolRepositories.allocations,
    studentAccountEntries: schoolRepositories.studentAccountEntries,
    paymentRepository: schoolRepositories.payments,
    scheduleRepository: schoolRepositories.schedules,
    calendarEventRepository: schoolRepositories.calendarEvents,
    attachmentRepository: schoolRepositories.attachments,
    resourceRepository: schoolRepositories.resources,
    resourceAssignmentRepository: schoolRepositories.resourceAssignments,
    studentNoteRepository: schoolRepositories.studentNotes,
    studentHealthProfileRepository: schoolRepositories.studentHealthProfiles,
    studentDisciplinaryActionRepository: schoolRepositories.studentDisciplinaryActions,
    disciplinaryActionRepository: schoolRepositories.disciplinaryActions,
    studentIncidentInvolvementRepository: schoolRepositories.studentIncidentInvolvements,
    incidentRepository: schoolRepositories.incidents,
    schoolNotificationTemplates: schoolRepositories.schoolNotificationTemplates,
  }
  return {
    app: application.forActor(defaultActor),
    application,
    durableWork,
    repositories: testRepositories,
    schoolRepositories,
    forActor: (boundActor: ActorMetadata) => application.forActor(boundActor),
    failSaveOnAttempt,
    atomicExecution,
    db,
  }
}

/** Explicit curriculum fixture setup; generic school fixtures remain category-free. */
export async function createCurriculumTestApp(...args: Parameters<typeof createTestApp>) {
  const fixture = await createTestApp(...args)
  const { subjectCategories } = (await import('../../../../tooling/fixtures/src/onboarding/ivory-coast/parse-ivory-coast-templates')).IVORY_COAST_ONBOARDING_DATASET
  const { ensureDatasetSubjectCategories } = await import('../../src/capabilities/academics/dataset-subject-categories')
  const { SubjectCategoryEntity } = await import('@edaya/core')
  for (const school of await fixture.schoolRepositories.schools.list()) {
    await ensureDatasetSubjectCategories(fixture.schoolRepositories, school.id, subjectCategories)
    await fixture.schoolRepositories.subjectCategories.save(new SubjectCategoryEntity({ id: 'test-category', schoolId: school.id, name: 'Fixture category' }))
  }
  return fixture
}
