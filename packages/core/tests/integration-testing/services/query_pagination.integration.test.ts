import { describe, expect, it } from 'bun:test'
import {
  AnnouncementTargetKind,
  IncidentInvolvementRole,
  IncidentKind,
  StaffRole,
} from '../../../src/entities'
import { createStaffActorMetadata } from '../../../src/services/authorization'
import { createTestApp } from '../../support/in-memory-school-headless-app'

async function createPaginationFixture() {
  const { app, repositories, forActor } = createTestApp()

  await app.setup.registerSchool({ id: 'school', name: 'Pagination Academy', timeZone: 'UTC' })
  await app.setup.createAcademicYear({
    id: 'year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
  await app.setup.createClassGroup({
    id: 'class',
    schoolId: 'school',
    academicYearId: 'year',
    gradeLevelId: 'level',
    name: 'Grade 6 A',
  })

  // Register multiple students for pagination testing
  const studentIds = ['student-1', 'student-2', 'student-3', 'student-4', 'student-5']
  let index = 1
  for (const id of studentIds) {
    await app.students.registerStudent({
      id,
      schoolId: 'school',
      firstName: `First${index}`,
      lastName: `Last${index}`,
    })
    await app.students.enrollStudent({
      id: `enrollment-${id}`,
      studentId: id,
      classGroupId: 'class',
    })
    index++
  }

  // Register multiple announcements
  for (let i = 0; i < 5; i++) {
    const id = `announcement-${i + 1}`
    await app.communications.createAnnouncement({
      id,
      schoolId: 'school',
      title: `Notice ${i + 1}`,
      content: `Notice body ${i + 1}`,
      createdAt: new Date(`2026-09-0${i + 1}T12:00:00Z`),
    })
    await app.communications.addTarget({
      id: `target-${id}`,
      announcementId: id,
      targetKind: AnnouncementTargetKind.School,
    })
    await app.communications.publishAnnouncement({ announcementId: id })
  }

  // Register staff member to report incidents
  await app.setup.registerStaffMember({
    id: 'teacher',
    schoolId: 'school',
    firstName: 'Binta',
    lastName: 'Sow',
    roles: [StaffRole.Teacher],
  })

  await app.setup.assignStaffToClass({
    id: 'teacher-class-assignment',
    staffId: 'teacher',
    classGroupId: 'class',
    role: StaffRole.Teacher,
  })

  const teacherApp = forActor(createStaffActorMetadata({
    subjectId: 'teacher-user',
    staffMemberId: 'teacher',
    schoolId: 'school',
    roles: [StaffRole.Teacher],
    requestId: 'teacher-req',
    authenticatedAt: new Date(),
  }))

  // Register multiple incidents for student-1
  for (let i = 0; i < 5; i++) {
    const incidentId = `incident-${i + 1}`
    const incident = await teacherApp.behavior.recordIncident({
      id: incidentId,
      schoolId: 'school',
      classGroupId: 'class',
      title: `Incident ${i + 1}`,
      description: `Description ${i + 1}`,
      date: new Date(`2026-09-0${i + 1}T08:00:00Z`),
      kind: IncidentKind.MinorInfraction,
    })
    await teacherApp.behavior.addStudentInvolvement({
      id: `involvement-${incidentId}`,
      incidentId: incident.id,
      studentId: 'student-1',
      role: IncidentInvolvementRole.Subject,
    })
  }

  return { app, repositories, forActor, teacherApp }
}

describe('Query facade pagination slicing', () => {
  it('correctly handles limits and offsets for students directory', async () => {
    const { app } = await createPaginationFixture()

    // 1. Fetch all
    const allResult = await app.queries.listStudents({ schoolId: 'school', academicYearId: 'year' })
    expect(allResult.rows).toHaveLength(5)
    const sortedStudentIds = allResult.rows.map(row => row.student.id)

    // 2. Fetch limit 2
    const limitResult = await app.queries.listStudents({
      schoolId: 'school',
      academicYearId: 'year',
      pagination: { limit: 2 },
    })
    expect(limitResult.rows).toHaveLength(2)
    expect(limitResult.rows.map(row => row.student.id)).toEqual([sortedStudentIds[0]!, sortedStudentIds[1]!])

    // 3. Fetch offset 2
    const offsetResult = await app.queries.listStudents({
      schoolId: 'school',
      academicYearId: 'year',
      pagination: { offset: 2 },
    })
    expect(offsetResult.rows).toHaveLength(3)
    expect(offsetResult.rows.map(row => row.student.id)).toEqual([
      sortedStudentIds[2]!,
      sortedStudentIds[3]!,
      sortedStudentIds[4]!,
    ])

    // 4. Fetch limit 2, offset 2
    const limitOffsetResult = await app.queries.listStudents({
      schoolId: 'school',
      academicYearId: 'year',
      pagination: { limit: 2, offset: 2 },
    })
    expect(limitOffsetResult.rows).toHaveLength(2)
    expect(limitOffsetResult.rows.map(row => row.student.id)).toEqual([sortedStudentIds[2]!, sortedStudentIds[3]!])
  })

  it('correctly handles limits and offsets for announcements directory', async () => {
    const { app } = await createPaginationFixture()

    // 1. Fetch all
    const allResult = await app.queries.listAnnouncements({ schoolId: 'school' })
    expect(allResult.rows).toHaveLength(5)
    const sortedAnnouncementIds = allResult.rows.map(row => row.announcement.id)

    // 2. Fetch limit 2
    const limitResult = await app.queries.listAnnouncements({
      schoolId: 'school',
      pagination: { limit: 2 },
    })
    expect(limitResult.rows).toHaveLength(2)
    expect(limitResult.rows.map(row => row.announcement.id)).toEqual([sortedAnnouncementIds[0]!, sortedAnnouncementIds[1]!])

    // 3. Fetch offset 3
    const offsetResult = await app.queries.listAnnouncements({
      schoolId: 'school',
      pagination: { offset: 3 },
    })
    expect(offsetResult.rows).toHaveLength(2)
    expect(offsetResult.rows.map(row => row.announcement.id)).toEqual([sortedAnnouncementIds[3]!, sortedAnnouncementIds[4]!])
  })

  it('correctly handles limits and offsets for student incidents', async () => {
    const { teacherApp } = await createPaginationFixture()

    // 1. Fetch all
    const allResult = await teacherApp.queries.listStudentIncidents({ schoolId: 'school', studentId: 'student-1' })
    expect(allResult.rows).toHaveLength(5)
    const sortedIncidentIds = allResult.rows.map(row => row.incident.id)

    // 2. Fetch limit 3
    const limitResult = await teacherApp.queries.listStudentIncidents({
      schoolId: 'school',
      studentId: 'student-1',
      pagination: { limit: 3 },
    })
    expect(limitResult.rows).toHaveLength(3)
    expect(limitResult.rows.map(row => row.incident.id)).toEqual([
      sortedIncidentIds[0]!,
      sortedIncidentIds[1]!,
      sortedIncidentIds[2]!,
    ])

    // 3. Fetch limit 2, offset 2
    const limitOffsetResult = await teacherApp.queries.listStudentIncidents({
      schoolId: 'school',
      studentId: 'student-1',
      pagination: { limit: 2, offset: 2 },
    })
    expect(limitOffsetResult.rows).toHaveLength(2)
    expect(limitOffsetResult.rows.map(row => row.incident.id)).toEqual([sortedIncidentIds[2]!, sortedIncidentIds[3]!])
  })
})
