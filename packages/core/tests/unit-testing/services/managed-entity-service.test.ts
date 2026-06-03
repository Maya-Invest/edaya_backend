import type { ActorMetadata } from '../../../src/authorization'
import type { BaseRepositoryInterface, SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { ManagedEntityService } from '../../../src'
import { ActorAssuranceLevel, AuthorizationError, AuthorizationErrorCode, createStaffActorMetadata } from '../../../src/authorization'
import {
  AcademicPeriod,
  AcademicPeriodType,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  AnnouncementTargetKind,
  Assessment,
  AssessmentKind,
  AssessmentResult,
  AttendanceJustificationStatus,
  AttendanceRecord,
  AttendanceStatus,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectMatterStatus,
  ClassSubjectProgress,
  EnrollmentEndReason,
  Fee,
  FeeStatus,
  GradeLevel,
  GradeScale,
  Incident,
  IncidentKind,
  IncidentStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardDefinitionSectionKind,
  ReportCardResult,
  ReportCardResultStatus,
  Resource,
  ResourceAssignment,
  ResourceKind,
  School,
  Session,
  SessionKind,
  StaffMember,
  StaffRole,
  Student,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
  StudentDisciplinaryAction,
  StudentDisciplinaryActionStatus,
  StudentFee,
  StudentNote,
  Subject,
  SubjectMatter,
} from '../../../src/entities'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import { AttendanceSummary } from '../../../src/value_object/attendance-summary'
import { createStore, createTestApp } from '../../support/in-memory-school-headless-app'

interface TestEntity {
  id: string
  schoolId: string
  parentId?: string
}

const actor: ActorMetadata = {
  kind: 'system',
  systemId: 'system',
  schoolId: 'school',
  requestId: 'request',
  reason: 'test',
}

function createRepository<T extends { id: string }>(): BaseRepositoryInterface<T> {
  return createStore<T>() as BaseRepositoryInterface<T>
}

describe('ManagedEntityService', () => {
  test('findByIds checks module, tenant, and entity access', async () => {
    const repository = createRepository<TestEntity>()
    const first = { id: 'entity-1', schoolId: 'school' }
    const second = { id: 'entity-2', schoolId: 'school' }
    await repository.batchSave([first, second])
    const checkModule = mock(async () => {})
    const checkAccess = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule,
          checkAccess,
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    const result = await service.findByIds(['entity-1', 'entity-2'])

    expect(result).toEqual([first, second])
    expect(checkModule).toHaveBeenCalledWith(actor)
    expect(checkAccess).toHaveBeenCalledWith(actor, [first, second], {})
  })

  test('passes undefined existing state to save gates for creates', async () => {
    const repository = createRepository<TestEntity>()
    const authorizeSave = mock(async () => {})
    const preSave = mock(async () => {})
    const entity = { id: 'entity-1', schoolId: 'school', parentId: 'parent-1' }
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave,
          authorizeDelete: mock(async () => {}),
        },
        gates: { preSave },
      },
    })

    await service.save(entity)

    expect(authorizeSave).toHaveBeenCalledWith(actor, entity, undefined, {})
    expect(preSave).toHaveBeenCalledWith(entity, undefined, {}, actor)
    await expect(repository.findById(entity.id)).resolves.toEqual(entity)
  })

  test('batchSave authorizes and gates each proposed entity with existing state', async () => {
    const repository = createRepository<TestEntity>()
    const existing = { id: 'entity-1', schoolId: 'school', parentId: 'old-parent' }
    const updated = { id: 'entity-1', schoolId: 'school', parentId: 'new-parent' }
    const created = { id: 'entity-2', schoolId: 'school' }
    await repository.save(existing)
    const authorizeSave = mock(async () => {})
    const preSave = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave,
          authorizeDelete: mock(async () => {}),
        },
        gates: { preSave },
      },
    })

    const result = await service.batchSave([updated, created])

    expect(result).toEqual(['entity-1', 'entity-2'])
    expect(authorizeSave).toHaveBeenCalledWith(actor, updated, existing, {})
    expect(authorizeSave).toHaveBeenCalledWith(actor, created, undefined, {})
    expect(preSave).toHaveBeenCalledWith(updated, existing, {}, actor)
    expect(preSave).toHaveBeenCalledWith(created, undefined, {}, actor)
    await expect(repository.findById('entity-1')).resolves.toEqual(updated)
    await expect(repository.findById('entity-2')).resolves.toEqual(created)
  })

  test('rejects proposed entities outside the actor tenant', async () => {
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository: createRepository<TestEntity>(),
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await expect(service.save({ id: 'entity-1', schoolId: 'other-school' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('delete is idempotent when the entity does not exist', async () => {
    const deleteEntity = mock(async () => {})
    const repository = {
      ...createRepository<TestEntity>(),
      delete: deleteEntity,
    }
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await service.delete('missing')

    expect(deleteEntity).not.toHaveBeenCalled()
  })

  test('batchDelete authorizes and gates existing entities only', async () => {
    const repository = createRepository<TestEntity>()
    const entity = { id: 'entity-1', schoolId: 'school' }
    await repository.save(entity)
    const authorizeDelete = mock(async () => {})
    const preDelete = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete,
        },
        gates: { preDelete },
      },
    })

    await service.batchDelete(['entity-1', 'missing'])

    expect(authorizeDelete).toHaveBeenCalledWith(actor, entity, {})
    expect(authorizeDelete).toHaveBeenCalledTimes(1)
    expect(preDelete).toHaveBeenCalledWith(entity, {})
    expect(preDelete).toHaveBeenCalledTimes(1)
    await expect(repository.findById('entity-1')).resolves.toBeUndefined()
  })

  test('count applies tenant and row access checks', async () => {
    const repository = createRepository<TestEntity>()
    const allowed = { id: 'entity-1', schoolId: 'school' }
    const denied = { id: 'entity-2', schoolId: 'school' }
    await repository.batchSave([allowed, denied])
    const checkAccess = mock(async (_actor: ActorMetadata, entities: readonly TestEntity[]) => {
      if (entities.some(entity => entity.id === denied.id))
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    })
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess,
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await expect(service.count()).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.count({ id: allowed.id })).resolves.toBe(1)
    expect(checkAccess).toHaveBeenCalled()
  })

  test('rejects entities whose tenant cannot be resolved', async () => {
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository: createRepository<TestEntity>(),
        tenant: { resolve: () => undefined },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await expect(service.save({ id: 'entity-1', schoolId: 'school' })).rejects.toBeInstanceOf(AuthorizationError)
  })
})

describe('BaseSchoolService managed entity wiring', () => {
  test('blocks deleting an academic year with class groups', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))

    await expect(app.base.academicYears.delete('year-1')).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('uses indirect tenant resolution for resource assignments', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.resourceRepository.save(new Resource({
      id: 'resource-1',
      schoolId: 'other-school',
      name: 'Room A',
      kind: ResourceKind.Location,
    }))

    await expect(app.base.resourceAssignments.save(new ResourceAssignment({
      id: 'assignment-1',
      resourceId: 'resource-1',
      classGroupId: 'class-1',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects orphan class subject progress before save', async () => {
    const { app } = createTestApp(actor)

    await expect(app.base.classSubjectProgress.save(new ClassSubjectProgress({
      id: 'progress-orphan',
      classSubjectMatterId: 'missing-matter',
      sessionId: 'missing-session',
      completedPercentage: 10,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('class subject progress direct save requires session access', async () => {
    const teacherActor = createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    })
    const { app, repositories } = createTestApp(teacherActor)
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'Math',
    }))
    await repositories.subjectMatterRepository.save(new SubjectMatter({
      id: 'subject-matter-1',
      subjectId: 'subject-1',
      name: 'Numbers',
      sequenceOrder: 1,
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.classSubjectMatterRepository.save(new ClassSubjectMatter({
      id: 'class-subject-matter-1',
      classSubjectId: 'class-subject-1',
      subjectMatterId: 'subject-matter-1',
      status: ClassSubjectMatterStatus.NotStarted,
      completedPercentage: 0,
    }))
    await repositories.sessionRepository.save(new Session({
      id: 'session-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      title: 'Math',
      kind: SessionKind.Course,
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))

    await expect(app.base.classSubjectProgress.save(new ClassSubjectProgress({
      id: 'progress-1',
      classSubjectMatterId: 'class-subject-matter-1',
      sessionId: 'session-1',
      completedPercentage: 10,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('student note direct save requires proposed student access', async () => {
    const teacherActor = createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    })
    const { app, repositories } = createTestApp(teacherActor)
    await repositories.studentRepository.save(new Student({
      id: 'student-unassigned',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-unassigned',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({
      id: 'enrollment-unassigned',
      studentId: 'student-unassigned',
      classGroupId: 'class-unassigned',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    }))

    await expect(app.base.studentNotes.save(new StudentNote({
      id: 'note-1',
      schoolId: 'school',
      studentId: 'student-unassigned',
      authorStaffId: 'teacher-1',
      body: 'Needs support',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('assessment config preSave rejects duplicate default grade scales', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.gradeScaleRepository.save(new GradeScale({
      id: 'scale-existing',
      schoolId: 'school',
      name: 'Default',
      minScore: 0,
      maxScore: 100,
      ranges: [{ letter: 'A', minScore: 0, maxScore: 100, isPassing: true }],
      isDefault: true,
    }))

    await expect(app.base.gradeScales.save(new GradeScale({
      id: 'scale-new',
      schoolId: 'school',
      name: 'Other default',
      minScore: 0,
      maxScore: 100,
      ranges: [{ letter: 'A', minScore: 0, maxScore: 100, isPassing: true }],
      isDefault: true,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('report-card definition preSave rejects invalid resources and duplicate defaults', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    }))
    await repositories.gradeLevelRepository.save(new GradeLevel({
      id: 'grade-1',
      schoolId: 'school',
      name: 'Grade 1',
      order: 1,
    }))
    await repositories.reportCardDefinitionRepository.save(new ReportCardDefinition({
      id: 'definition-existing',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Default',
      isDefault: true,
    }))

    await expect(app.base.definitions.save(new ReportCardDefinition({
      id: 'definition-missing-year',
      schoolId: 'school',
      academicYearId: 'missing-year',
      gradeLevelId: 'grade-1',
      name: 'Invalid',
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await expect(app.base.definitions.save(new ReportCardDefinition({
      id: 'definition-new',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Other default',
      isDefault: true,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('report-card section preSave rejects invalid parent relationships', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.reportCardDefinitionRepository.save(new ReportCardDefinition({
      id: 'definition-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Definition',
    }))

    await expect(app.base.sections.save(new ReportCardDefinitionSection({
      id: 'section-self',
      reportCardDefinitionId: 'definition-1',
      name: 'Self',
      order: 1,
      weight: 1,
      parentSectionId: 'section-self',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await repositories.reportCardDefinitionSectionRepository.save(new ReportCardDefinitionSection({
      id: 'section-subject-parent',
      reportCardDefinitionId: 'definition-1',
      kind: ReportCardDefinitionSectionKind.Subject,
      name: 'Math',
      order: 1,
      weight: 1,
      subjectId: 'subject-1',
    }))
    await expect(app.base.sections.save(new ReportCardDefinitionSection({
      id: 'section-child',
      reportCardDefinitionId: 'definition-1',
      name: 'Child',
      order: 2,
      weight: 1,
      parentSectionId: 'section-subject-parent',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const child = new ReportCardDefinitionSection({
      id: 'section-cycle-child',
      reportCardDefinitionId: 'definition-1',
      name: 'Cycle child',
      order: 3,
      weight: 1,
    })
    await repositories.reportCardDefinitionSectionRepository.save(child)
    await repositories.reportCardDefinitionSectionRepository.save(new ReportCardDefinitionSection({
      id: 'section-cycle-parent',
      reportCardDefinitionId: 'definition-1',
      name: 'Cycle parent',
      order: 4,
      weight: 1,
      parentSectionId: child.id,
    }))
    await expect(app.base.sections.save(child.copyWith({
      parentSectionId: 'section-cycle-parent',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assessment preSave rejects inconsistent class subject, period, and session references', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-2',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))
    await repositories.sessionRepository.save(new Session({
      id: 'session-1',
      classGroupId: 'class-1',
      title: 'Other subject',
      kind: SessionKind.Evaluation,
      startsAt: new Date('2026-02-01T08:00:00Z'),
      endsAt: new Date('2026-02-01T09:00:00Z'),
      classSubjectId: 'other-class-subject',
    }))

    await expect(app.base.assessments.save(new Assessment({
      id: 'assessment-bad-period',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      dueAt: new Date('2026-02-01T00:00:00Z'),
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-valid',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))

    await expect(app.base.assessments.save(new Assessment({
      id: 'assessment-bad-session',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-valid',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      sessionId: 'session-1',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('assessment preSave rejects completion after results are recorded', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))
    const assessment = new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      dueAt: new Date('2026-02-01T00:00:00Z'),
    })
    await repositories.assessmentRepository.save(assessment)
    await repositories.assessmentResultRepository.save(new AssessmentResult({
      id: 'assessment-result-1',
      studentId: 'student-1',
      assessmentId: assessment.id,
      score: 18,
    }))

    await expect(app.base.assessments.save(new Assessment({
      id: assessment.id,
      classGroupId: assessment.classGroupId,
      classSubjectId: assessment.classSubjectId,
      periodId: assessment.periodId,
      title: assessment.title,
      kind: assessment.kind,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      dueAt: assessment.dueAt,
      metAt: new Date('2026-02-02T00:00:00Z'),
      createdAt: assessment.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('enrollment preSave rejects closing an enrollment that is not current active', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({
      id: 'enrollment-current',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    }))
    const staleEnrollment = new StudentClassEnrollment({
      id: 'enrollment-stale',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 2,
    })
    await repositories.StudentClassEnrollmentRepository.save(staleEnrollment)

    await expect(app.base.enrollments.save(new StudentClassEnrollment({
      id: staleEnrollment.id,
      studentId: staleEnrollment.studentId,
      classGroupId: staleEnrollment.classGroupId,
      academicYearId: staleEnrollment.academicYearId,
      enrollmentIndex: staleEnrollment.enrollmentIndex,
      status: StudentClassEnrollmentStatus.Closed,
      enrolledAt: staleEnrollment.enrolledAt,
      endedAt: new Date('2026-06-30T00:00:00Z'),
      endReason: EnrollmentEndReason.Withdrawn,
      closedBy: 'system',
      createdAt: staleEnrollment.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('enrollment direct save rejects capacity bypass and active deletes', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-existing',
      schoolId: 'school',
      firstName: 'Existing',
      lastName: 'Student',
    }))
    await repositories.studentRepository.save(new Student({
      id: 'student-new',
      schoolId: 'school',
      firstName: 'New',
      lastName: 'Student',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-capacity',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
      capacity: 1,
    }))
    const existingEnrollment = new StudentClassEnrollment({
      id: 'enrollment-existing',
      studentId: 'student-existing',
      classGroupId: 'class-capacity',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    })
    await repositories.StudentClassEnrollmentRepository.save(existingEnrollment)

    await expect(app.base.enrollments.save(new StudentClassEnrollment({
      id: 'enrollment-new',
      studentId: 'student-new',
      classGroupId: 'class-capacity',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(app.base.enrollments.delete(existingEnrollment.id)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('attendance preSave rejects reviewing non-absent attendance', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.sessionRepository.save(new Session({
      id: 'session-1',
      classGroupId: 'class-1',
      title: 'Math',
      kind: SessionKind.Course,
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))
    const attendance = new AttendanceRecord({
      id: 'attendance-1',
      studentId: 'student-1',
      sessionId: 'session-1',
      date: new Date('2026-05-01T08:00:00Z'),
      status: AttendanceStatus.Late,
    })
    await repositories.attendanceRepository.save(attendance)

    await expect(app.base.attendance.save(attendance.copyWith({
      justificationStatus: AttendanceJustificationStatus.Excused,
      reason: 'Medical',
      justifiedAt: new Date('2026-05-02T08:00:00Z'),
      justifiedByStaffId: 'staff-1',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('student fee preSave rejects invalid adjustments and paid cancellation', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    const studentFee = new StudentFee({
      id: 'student-fee-1',
      studentId: 'student-1',
      feeId: 'fee-1',
      academicYearId: 'year-1',
      expectedAmount: 100,
      paidAmount: 80,
      currency: 'XAF',
      status: FeeStatus.Partial,
    })
    await repositories.studentFeeRepository.save(studentFee)

    await expect(app.base.studentFees.save(studentFee.copyWith({
      adjustmentAmount: 30,
      adjustmentReason: 'Discount',
      adjustedById: 'staff-1',
      adjustedAt: new Date('2026-05-01T00:00:00Z'),
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await expect(app.base.studentFees.save(studentFee.copyWith({
      status: FeeStatus.Cancelled,
      cancellationReason: 'Cancelled',
      cancelledById: 'staff-1',
      cancelledAt: new Date('2026-05-01T00:00:00Z'),
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('incident preSave rejects invalid scope and non-open resolution', async () => {
    const { app, repositories } = createTestApp(actor)
    await expect(app.base.incidents.save(new Incident({
      id: 'incident-invalid-scope',
      schoolId: 'school',
      title: 'Incident',
      description: 'Description',
      date: new Date('2026-05-01T00:00:00Z'),
      kind: IncidentKind.MinorInfraction,
      reporterId: 'staff-1',
      classGroupId: 'missing-class',
    }))).rejects.toBeInstanceOf(AuthorizationError)

    const cancelledIncident = new Incident({
      id: 'incident-cancelled',
      schoolId: 'school',
      title: 'Incident',
      description: 'Description',
      date: new Date('2026-05-01T00:00:00Z'),
      kind: IncidentKind.MinorInfraction,
      reporterId: 'staff-1',
      status: IncidentStatus.Cancelled,
    })
    await repositories.incidentRepository.save(cancelledIncident)

    await expect(app.base.incidents.save(new Incident({
      id: cancelledIncident.id,
      schoolId: cancelledIncident.schoolId,
      title: cancelledIncident.title,
      description: cancelledIncident.description,
      date: cancelledIncident.date,
      kind: cancelledIncident.kind,
      reporterId: cancelledIncident.reporterId,
      status: IncidentStatus.Resolved,
      resolvedAt: new Date('2026-05-02T00:00:00Z'),
      resolvedByStaffId: 'staff-1',
      createdAt: cancelledIncident.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('student disciplinary action preSave rejects terminal status changes', async () => {
    const { app, repositories } = createTestApp(actor)
    const completedAction = new StudentDisciplinaryAction({
      id: 'disciplinary-action-1',
      schoolId: 'school',
      incidentId: 'incident-1',
      studentId: 'student-1',
      disciplinaryActionId: 'catalog-1',
      assignedByStaffId: 'staff-1',
      status: StudentDisciplinaryActionStatus.Completed,
    })
    await repositories.studentDisciplinaryActionRepository.save(completedAction)

    await expect(app.base.studentDisciplinaryActions.save(new StudentDisciplinaryAction({
      id: completedAction.id,
      schoolId: completedAction.schoolId,
      incidentId: completedAction.incidentId,
      studentId: completedAction.studentId,
      disciplinaryActionId: completedAction.disciplinaryActionId,
      assignedByStaffId: completedAction.assignedByStaffId,
      status: StudentDisciplinaryActionStatus.Cancelled,
      createdAt: completedAction.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('setup preSave rejects staff self-deactivation through managed save', async () => {
    const staffActor = createStaffActorMetadata({
      subjectId: 'staff-user',
      staffMemberId: 'staff-1',
      schoolId: 'school',
      roles: [StaffRole.Admin],
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    })
    const { app, repositories } = createTestApp(staffActor)
    const staffMember = new StaffMember({
      id: 'staff-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Admin',
      roles: [StaffRole.Admin],
    })
    await repositories.staffMemberRepository.save(staffMember)

    await expect(app.base.staffMembers.save(new StaffMember({
      id: staffMember.id,
      schoolId: staffMember.schoolId,
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      roles: staffMember.roles,
      isActive: false,
      createdAt: staffMember.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('resource assignment preSave rejects overlapping session assignments', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.resourceRepository.save(new Resource({
      id: 'resource-1',
      schoolId: 'school',
      name: 'Room A',
      kind: ResourceKind.Location,
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.sessionRepository.save(new Session({
      id: 'session-1',
      classGroupId: 'class-1',
      title: 'Math',
      kind: SessionKind.Course,
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))
    await repositories.sessionRepository.save(new Session({
      id: 'session-2',
      classGroupId: 'class-1',
      title: 'Science',
      kind: SessionKind.Course,
      startsAt: new Date('2026-05-01T08:30:00Z'),
      endsAt: new Date('2026-05-01T09:30:00Z'),
    }))
    await repositories.resourceAssignmentRepository.save(new ResourceAssignment({
      id: 'assignment-existing',
      resourceId: 'resource-1',
      sessionId: 'session-1',
    }))

    await expect(app.base.resourceAssignments.save(new ResourceAssignment({
      id: 'assignment-new',
      resourceId: 'resource-1',
      sessionId: 'session-2',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assessment result preSave rejects writes after report card is published', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({
      id: 'enrollment-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))
    await repositories.assessmentRepository.save(new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      dueAt: new Date('2026-02-01T00:00:00Z'),
    }))
    await repositories.reportCardResultRepository.save(new ReportCardResult({
      id: 'report-card-1',
      reportCardDefinitionId: 'definition-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      periodId: 'period-1',
      sectionResults: [],
      attendanceSummary: new AttendanceSummary({ presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }),
      assessmentResultCount: 0,
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-03-31T00:00:00Z'),
    }))

    await expect(app.base.assessmentResults.save(new AssessmentResult({
      id: 'assessment-result-1',
      studentId: 'student-1',
      assessmentId: 'assessment-1',
      score: 18,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('published report cards and linked assessment results cannot be deleted directly', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))
    await repositories.reportCardDefinitionRepository.save(new ReportCardDefinition({
      id: 'definition-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Definition',
    }))
    await repositories.reportCardResultRepository.save(new ReportCardResult({
      id: 'report-card-1',
      reportCardDefinitionId: 'definition-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      periodId: 'period-1',
      sectionResults: [],
      attendanceSummary: new AttendanceSummary({
        presentCount: 0,
        absenceCount: 0,
        lateCount: 0,
      }),
      assessmentResultCount: 1,
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-04-01T00:00:00Z'),
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.assessmentRepository.save(new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: 'period-1',
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      dueAt: new Date('2026-02-01T00:00:00Z'),
    }))
    await repositories.assessmentResultRepository.save(new AssessmentResult({
      id: 'assessment-result-1',
      studentId: 'student-1',
      assessmentId: 'assessment-1',
      score: 18,
    }))

    await expect(app.base.results.delete('report-card-1')).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await expect(app.base.assessmentResults.delete('assessment-result-1')).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('announcement target preSave rejects targets outside announcement school', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.announcementRepository.save(new Announcement({
      id: 'announcement-1',
      schoolId: 'school',
      title: 'Notice',
      content: 'Hello',
      createdBy: 'system',
    }))
    await repositories.gradeLevelRepository.save(new GradeLevel({
      id: 'grade-other',
      schoolId: 'other-school',
      name: 'Other Grade',
      order: 1,
    }))

    await expect(app.base.announcementTargets.save(new AnnouncementTarget({
      id: 'target-1',
      announcementId: 'announcement-1',
      targetKind: AnnouncementTargetKind.GradeLevel,
      targetId: 'grade-other',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('academic period preDelete rejects dependent assessments and report cards', async () => {
    const { app, repositories } = createTestApp(actor)
    const period = new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    })
    await repositories.academicPeriodRepository.save(period)
    await repositories.assessmentRepository.save(new Assessment({
      id: 'assessment-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      periodId: period.id,
      title: 'Quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      dueAt: new Date('2026-02-01T00:00:00Z'),
    }))

    await expect(app.base.academicPeriods.delete(period.id)).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('fee preSave rejects academic years outside the fee school', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.schoolRepository.save(new School({
      id: 'school',
      name: 'School',
      timeZone: 'UTC',
    }))
    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-other',
      schoolId: 'other-school',
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    }))

    await expect(app.base.fees.save(new Fee({
      id: 'fee-1',
      schoolId: 'school',
      academicYearId: 'year-other',
      name: 'Tuition',
      defaultAmount: 1000,
      currency: 'USD',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('payment preSave rejects cancelled student fees and terminal payment transitions', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.studentFeeRepository.save(new StudentFee({
      id: 'student-fee-cancelled',
      studentId: 'student-1',
      feeId: 'fee-1',
      academicYearId: 'year-1',
      expectedAmount: 1000,
      currency: 'USD',
      status: FeeStatus.Cancelled,
      cancellationReason: 'waived',
      cancelledById: 'staff-1',
      cancelledAt: new Date('2026-02-01T00:00:00Z'),
    }))

    await expect(app.base.payments.save(new Payment({
      id: 'payment-new',
      studentFeeId: 'student-fee-cancelled',
      amount: 100,
      currency: 'USD',
      paymentDate: new Date('2026-02-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)

    await repositories.studentFeeRepository.save(new StudentFee({
      id: 'student-fee-active',
      studentId: 'student-1',
      feeId: 'fee-1',
      academicYearId: 'year-1',
      expectedAmount: 1000,
      currency: 'USD',
      status: FeeStatus.Pending,
    }))
    const reversed = new Payment({
      id: 'payment-reversed',
      studentFeeId: 'student-fee-active',
      amount: 100,
      currency: 'USD',
      paymentDate: new Date('2026-02-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      status: PaymentStatus.Reversed,
      reversedAt: new Date('2026-02-02T00:00:00Z'),
      reversedById: 'staff-1',
    })
    await repositories.paymentRepository.save(reversed)

    await expect(app.base.payments.save(new Payment({
      id: reversed.id,
      studentFeeId: reversed.studentFeeId,
      amount: reversed.amount.amount,
      currency: reversed.amount.currency,
      paymentDate: reversed.paymentDate,
      method: reversed.method,
      status: PaymentStatus.Cancelled,
      cancelledAt: new Date('2026-02-03T00:00:00Z'),
      cancelledById: 'staff-1',
      createdAt: reversed.createdAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('report-card result preSave rejects direct edits to published cards', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.academicPeriodRepository.save(new AcademicPeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-03-31T00:00:00Z'),
    }))
    await repositories.reportCardDefinitionRepository.save(new ReportCardDefinition({
      id: 'definition-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Definition',
    }))
    const published = new ReportCardResult({
      id: 'report-card-1',
      reportCardDefinitionId: 'definition-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      periodId: 'period-1',
      sectionResults: [],
      attendanceSummary: new AttendanceSummary({ presentCount: 0, absenceCount: 0, lateCount: 0 }),
      assessmentResultCount: 0,
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-03-31T00:00:00Z'),
    })
    await repositories.reportCardResultRepository.save(published)

    await expect(app.base.results.save(new ReportCardResult({
      id: published.id,
      reportCardDefinitionId: published.reportCardDefinitionId,
      studentId: published.studentId,
      classGroupId: published.classGroupId,
      periodId: published.periodId,
      sectionResults: published.sectionResults,
      attendanceSummary: published.attendanceSummary,
      assessmentResultCount: 1,
      status: ReportCardResultStatus.Published,
      generatedAt: published.generatedAt,
      publishedAt: published.publishedAt,
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

describe('SchoolService managed config entity access', () => {
  test('uses managed proposed-state authorization for subject matters', async () => {
    const { app, repositories } = createTestApp(actor)

    await expect(app.base.subjectMatters.save(new SubjectMatter({
      id: 'matter-1',
      subjectId: 'missing-subject',
      name: 'Algebra',
      sequenceOrder: 1,
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'Math',
    }))
    const subjectMatter = new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 1,
    })

    await app.base.subjectMatters.save(subjectMatter)

    await expect(repositories.subjectMatterRepository.findById('matter-1')).resolves.toEqual(subjectMatter)
  })
})
