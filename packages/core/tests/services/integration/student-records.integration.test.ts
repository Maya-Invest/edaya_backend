import { describe, expect, it } from 'bun:test'
import {
  GuardianContactMethod,
  GuardianContactMethodType,
  StaffRole,
  StudentNoteVisibility,
  StudentStatus,
} from '../../../src/entities'
import {
  AuthorizationErrorCode,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
} from '../../../src/services/authorization'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('student record journey', () => {
  it('updates profile, health data, notes, and guardian communication preferences through public commands', async () => {
    const { app, forActor } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School', timeZone: 'UTC' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.setup.registerStaffMember({
      id: 'teacher',
      schoolId: 'school',
      firstName: 'Binta',
      lastName: 'Sow',
      roles: [StaffRole.Teacher],
    })
    await app.students.registerStudent({
      id: 'student',
      schoolId: 'school',
      firstName: 'Amira',
      lastName: 'Diallo',
    })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.setup.assignStaffToClass({
      id: 'teacher-class',
      staffId: 'teacher',
      classGroupId: 'class',
      role: StaffRole.Teacher,
    })
    await app.students.registerGuardian({
      id: 'guardian',
      schoolId: 'school',
      firstName: 'Nadia',
      lastName: 'Diallo',
      email: 'old@example.test',
    })
    await app.students.linkGuardianToStudent({
      id: 'guardian-link',
      guardianId: 'guardian',
      studentId: 'student',
      isPrimary: true,
    })

    const teacher = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'teacher-request',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const guardian = forActor(createGuardianActorMetadata({
      subjectId: 'guardian-user',
      guardianId: 'guardian',
      schoolId: 'school',
      requestId: 'guardian-request',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))
    const studentActor = forActor(createStudentActorMetadata({
      subjectId: 'student-user',
      studentId: 'student',
      schoolId: 'school',
      requestId: 'student-request',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    }))

    const updatedStudent = await app.students.updateStudentProfile({
      studentId: 'student',
      firstName: 'Amina',
      matricule: 'MAT-001',
      photoUrl: 'https://files.example.test/student.jpg',
      enrollmentDate: new Date('2026-09-01T00:00:00Z'),
    })
    expect(updatedStudent.firstName).toBe('Amina')
    expect(updatedStudent.status).toBe(StudentStatus.Active)
    await expect(teacher.students.updateStudentStatus({
      studentId: 'student',
      status: StudentStatus.Inactive,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    const health = await app.students.upsertStudentHealthProfile({
      id: 'health',
      studentId: 'student',
      allergies: 'Peanuts',
      emergencyProtocols: 'Carry epinephrine.',
      bloodType: 'O+',
      updatedAt: new Date('2026-09-02T00:00:00Z'),
    })
    expect(health.allergies).toBe('Peanuts')
    await expect(teacher.students.upsertStudentHealthProfile({
      id: 'health',
      studentId: 'student',
      allergies: 'Shellfish',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    await app.students.createStudentNote({
      id: 'admin-note',
      studentId: 'student',
      title: 'Counselor note',
      body: 'Admin-only context.',
      visibility: StudentNoteVisibility.AdminOnly,
      createdAt: new Date('2026-09-03T00:00:00Z'),
    })
    await teacher.students.createStudentNote({
      id: 'teacher-note',
      studentId: 'student',
      body: 'Staff classroom note.',
      visibility: StudentNoteVisibility.Staff,
      createdAt: new Date('2026-09-04T00:00:00Z'),
    })
    await expect(teacher.students.createStudentNote({
      id: 'blocked-note',
      studentId: 'student',
      body: 'Should not be admin-only.',
      visibility: StudentNoteVisibility.AdminOnly,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
    await app.students.updateStudentNote({
      noteId: 'teacher-note',
      body: 'Shareable family note.',
      visibility: StudentNoteVisibility.GuardianVisible,
      updatedAt: new Date('2026-09-05T00:00:00Z'),
    })

    const updatedGuardian = await app.students.updateGuardianContactMethods({
      guardianId: 'guardian',
      contactMethods: [
        new GuardianContactMethod({
          type: GuardianContactMethodType.Email,
          value: 'nadia@example.test',
          isPrimary: true,
        }),
        new GuardianContactMethod({
          type: GuardianContactMethodType.Whatsapp,
          value: '+237600000000',
          label: 'WhatsApp',
          allowsNotifications: false,
        }),
      ],
      premiumNotificationsEnabled: true,
    })
    expect(updatedGuardian.contactMethods).toHaveLength(2)
    expect(updatedGuardian.email).toBe('nadia@example.test')
    const updatedLink = await app.students.updateGuardianStudentLink({
      guardianId: 'guardian',
      studentId: 'student',
      relationship: 'mother',
      isBillingContact: true,
      legalGuardian: true,
      canPickup: true,
      emergencyContactPriority: 1,
      receivesAttendanceAlerts: false,
      contactRestrictions: 'Call before pickup.',
    })
    expect(updatedLink.isBillingContact).toBe(true)
    expect(updatedLink.receivesAttendanceAlerts).toBe(false)

    const adminDetail = await app.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(adminDetail.healthProfile?.bloodType).toBe('O+')
    expect(adminDetail.notes.map(note => note.id)).toEqual(['teacher-note', 'admin-note'])
    expect(adminDetail.guardians[0]?.link.contactRestrictions).toBe('Call before pickup.')

    const teacherDetail = await teacher.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(teacherDetail.healthProfile).toBeUndefined()
    expect(teacherDetail.notes.map(note => note.id)).toEqual(['teacher-note'])

    const guardianDetail = await guardian.queries.getStudentDetail({ schoolId: 'school', studentId: 'student' })
    expect(guardianDetail.healthProfile).toBeUndefined()
    expect(guardianDetail.notes.map(note => note.id)).toEqual(['teacher-note'])
    expect(guardianDetail.guardians.map(item => item.guardian.id)).toEqual(['guardian'])

    await expect(studentActor.students.createStudentNote({
      id: 'student-note',
      studentId: 'student',
      body: 'Student-authored note is not selected.',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })
})
