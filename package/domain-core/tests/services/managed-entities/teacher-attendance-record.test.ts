import { describe, expect, test } from 'bun:test'
import { AuthorizationError, createTeacherActorMetadata } from '../../../src/capabilities/authorization'
import {
  AttendanceStatus,
  ClassGroup,
  ClassSubject,
  LessonSession,
  Student,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
  Subject,
} from '../../../src/domain'
import { createTestApp } from '../../support/create-test-app'

const startsAt = new Date('2026-06-01T09:00:00.000Z')
const endsAt = new Date('2026-06-01T10:00:00.000Z')

describe('Teacher lesson attendance save', () => {
  test('allows assigned subject teachers to record lesson session attendance', async () => {
    const teacherActor = createTeacherActorMetadata({
      subjectId: 'teacher-user',
      teacherId: 'teacher-1',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-06-01T00:00:00.000Z'),
      teacherScope: {
        teaching: { classSubjectIds: ['cs-1'] },
        homeroom: { classGroupIds: [] },
      },
    })
    const { app, repositories } = createTestApp(teacherActor)

    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({
      id: 'enrollment-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
      status: StudentClassEnrollmentStatus.Active,
    }))
    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'Math',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'cs-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'cs-1',
      displayLabel: 'Math',
      startsAt,
      endsAt,
    }))

    const record = await app.schedulingWorkflow.recordAttendance({
      id: 'student-1-session-1',
      studentId: 'student-1',
      lessonSessionId: 'session-1',
      status: AttendanceStatus.Present,
    })

    expect(record.status).toBe(AttendanceStatus.Present)
    expect(record.lessonSessionId).toBe('session-1')
  })

  test('denies homeroom teachers from recording subject lesson attendance', async () => {
    const teacherActor = createTeacherActorMetadata({
      subjectId: 'teacher-user',
      teacherId: 'teacher-1',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-06-01T00:00:00.000Z'),
      teacherScope: {
        teaching: { classSubjectIds: [] },
        homeroom: { classGroupIds: ['class-1'] },
      },
    })
    const { app, repositories } = createTestApp(teacherActor)

    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.studentRepository.save(new Student({
      id: 'student-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await repositories.StudentClassEnrollmentRepository.save(new StudentClassEnrollment({
      id: 'enrollment-1',
      studentId: 'student-1',
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      enrollmentIndex: 1,
      status: StudentClassEnrollmentStatus.Active,
    }))
    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'Math',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'cs-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    await repositories.lessonSessionRepository.save(new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'cs-1',
      displayLabel: 'Math',
      startsAt,
      endsAt,
    }))

    await expect(app.schedulingWorkflow.recordAttendance({
      id: 'student-1-session-1',
      studentId: 'student-1',
      lessonSessionId: 'session-1',
      status: AttendanceStatus.Present,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
