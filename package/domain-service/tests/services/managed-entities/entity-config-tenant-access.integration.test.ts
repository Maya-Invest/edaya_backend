import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, ClassSubjectProgress, GradeLevel, LessonSession, Permission, Resource, ResourceAssignment, ResourceKind, StaffPermissionAssignment, Student, StudentClassEnrollment, StudentNote, Subject, SubjectMatter } from '@edaya/core'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import { createCurriculumTestApp as createTestApp } from '../../support/create-test-app'
import { actor } from './managed-entity-test-context'

describe('Entity config tenant and access gates', () => {
  test('uses indirect tenant resolution for resource assignments', async () => {
    const { app, repositories } = await createTestApp(actor, { owner: true })
    await repositories.resourceRepository.save(new Resource({
      id: 'resource-1',
      schoolId: 'other-school',
      name: 'Room A',
      kind: ResourceKind.Location,
    }))

    await expect(app.baseService.entities.resourceAssignments.save(new ResourceAssignment({
      id: 'assignment-1',
      resourceId: 'resource-1',
      classGroupId: 'class-1',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('class subject progress direct save requires lesson session access', async () => {
    const teacherActor = createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    })
    const { app, repositories } = await createTestApp(teacherActor)
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-unassigned-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.subjectRepository.save(new Subject({ categoryId: 'test-category', gradeLevelId: 'grade-1', academicYearId: 'year-1', id: 'subject-1', schoolId: 'school', name: 'Math' }))
    await repositories.subjectMatterRepository.save(new SubjectMatter({
      id: 'subject-matter-unassigned-1',
      subjectId: 'subject-1',
      name: 'Numbers',
      sequenceOrder: 1,
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'class-subject-unassigned-1',
      classGroupId: 'class-unassigned-1',
      subjectId: 'subject-1',
    }))
    await repositories.classSubjectMatterRepository.save(new ClassSubjectMatter({
      id: 'class-subject-matter-unassigned-1',
      classSubjectId: 'class-subject-unassigned-1',
      subjectMatterId: 'subject-matter-unassigned-1',
      status: ClassSubjectMatterStatus.NotStarted,
      completedPercentage: 0,
    }))
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-unassigned-1',
      schoolId: 'school',
      classGroupId: 'class-unassigned-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'class-subject-unassigned-1',
      displayLabel: 'Math',
      startsAt: new Date('2026-05-01T08:00:00Z'),
      endsAt: new Date('2026-05-01T09:00:00Z'),
    }))

    await expect(app.baseService.entities.classSubjectProgress.save(new ClassSubjectProgress({
      id: 'progress-unassigned-1',
      classSubjectMatterId: 'class-subject-matter-unassigned-1',
      lessonSessionId: 'session-unassigned-1',
      completedPercentage: 10,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('student note direct save requires proposed student access', async () => {
    const teacherActor = createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Standard,
    })
    const { app, repositories } = await createTestApp(teacherActor)
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

    await expect(app.baseService.entities.studentNotes.save(new StudentNote({
      id: 'note-1',
      schoolId: 'school',
      studentId: 'student-unassigned',
      authorStaffId: 'teacher-1',
      body: 'Needs support',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('uses managed proposed-state authorization for subject matters', async () => {
    const { app, repositories } = await createTestApp(actor, { owner: true })

    await expect(app.baseService.entities.subjectMatters.save(new SubjectMatter({
      id: 'matter-1',
      subjectId: 'missing-subject',
      name: 'Algebra',
      sequenceOrder: 1,
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await repositories.gradeLevelRepository.save(new GradeLevel({ id: 'grade-1', schoolId: 'school', name: '6ème', label: '6ème', order: 1 }))
    await repositories.academicYearRepository.save(new AcademicYear({ id: 'year-1', schoolId: 'school', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
    await repositories.subjectRepository.save(new Subject({ categoryId: 'test-category', gradeLevelId: 'grade-1', academicYearId: 'year-1', id: 'subject-1', schoolId: 'school', name: 'Math' }))
    const subjectMatter = new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 1,
    })

    await app.baseService.entities.subjectMatters.save(subjectMatter)

    await expect(repositories.subjectMatterRepository.findById('matter-1')).resolves.toEqual(subjectMatter)
  })

  test('allows creating class groups with school structure configure permission on a new id', async () => {
    const configureActor = createStaffActorMetadata({
      subjectId: 'configure-user',
      staffMemberId: 'staff-configure',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-05-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Verified,
    })
    const { app, repositories, schoolRepositories } = await createTestApp(configureActor)

    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
      status: 'published',
    }))
    await repositories.gradeLevelRepository.save(new GradeLevel({
      id: 'grade-1',
      schoolId: 'school',
      name: 'Grade 6',
      label: '6ème',
      order: 1,
    }))

    await schoolRepositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'configure', schoolId: 'school', academicYearId: 'year-1', staffId: configureActor.staffMemberId, permission: Permission.SCHOOL_CONFIGURE, scopes: [{ kind: 'school' }] }))

    const classGroup = new ClassGroup({
      id: 'class-new',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: '6A',
    })

    await app.baseService.entities.classGroups.save(classGroup)
    await expect(repositories.classGroupRepository.findById('class-new')).resolves.toEqual(classGroup)
  })
})
