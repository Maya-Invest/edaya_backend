import { describe, expect, it } from 'bun:test'
import {
  AttachmentOwnerKind,
  ResourceKind,
  SessionKind,
} from '../../../src/entities'
import { createTestApp } from '../../support/in-memory-school-headless-app'

describe('attachment and resource journey', () => {
  it('registers attachments and assigns resources with session conflict validation', async () => {
    const { app, repositories } = createTestApp()
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
    await app.setup.createClassGroup({
      id: 'other-class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 B',
    })
    await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    const firstSession = await app.scheduling.createSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class',
      title: 'Math',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-10T08:00:00Z'),
      endsAt: new Date('2026-09-10T09:00:00Z'),
    })
    const overlappingSession = await app.scheduling.createSession({
      id: 'session-2',
      schoolId: 'school',
      classGroupId: 'class',
      title: 'Science',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-10T08:30:00Z'),
      endsAt: new Date('2026-09-10T09:30:00Z'),
    })
    const laterSession = await app.scheduling.createSession({
      id: 'session-3',
      schoolId: 'school',
      classGroupId: 'class',
      title: 'Reading',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-10T10:00:00Z'),
      endsAt: new Date('2026-09-10T11:00:00Z'),
    })

    await app.setup.createResource({
      id: 'room-101',
      schoolId: 'school',
      name: 'Room 101',
      kind: ResourceKind.Location,
      capacity: 30,
    })
    await app.setup.createResource({
      id: 'projector',
      schoolId: 'school',
      name: 'Projector',
      kind: ResourceKind.Equipment,
    })
    await app.setup.assignResourceToClass({
      id: 'room-class-assignment',
      resourceId: 'room-101',
      classGroupId: 'class',
    })
    await expect(app.setup.assignResourceToClass({
      id: 'room-other-class-assignment',
      resourceId: 'room-101',
      classGroupId: 'other-class',
    })).rejects.toThrow('already assigned to class class')
    await app.setup.assignResourceToSession({
      id: 'projector-session-1',
      resourceId: 'projector',
      sessionId: firstSession.id,
    })
    await expect(app.setup.assignResourceToSession({
      id: 'projector-session-2',
      resourceId: 'projector',
      sessionId: overlappingSession.id,
    })).rejects.toThrow('overlapping session session-1')
    await app.setup.assignResourceToSession({
      id: 'projector-session-3',
      resourceId: 'projector',
      sessionId: laterSession.id,
    })

    const attachment = await app.setup.registerAttachment({
      id: 'student-photo',
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student',
      fileName: 'student-photo.jpg',
      fileUrl: 'https://files.example.test/student-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1200,
      createdAt: new Date('2026-09-10T12:00:00Z'),
    })
    expect(attachment.uploadedById).toBe('admin')
    await expect(app.setup.registerAttachment({
      id: 'unsupported',
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Other,
      ownerId: 'legacy-owner',
      fileName: 'legacy.txt',
      fileUrl: 'https://files.example.test/legacy.txt',
    })).rejects.toThrow('owner kind other is not supported')

    const resources = await app.queries.listResources({ schoolId: 'school' })
    expect(resources.resources.map(resource => resource.id)).toEqual(['projector', 'room-101'])
    expect(resources.assignments.map(detail => detail.assignment.id).sort()).toEqual([
      'projector-session-1',
      'projector-session-3',
      'room-class-assignment',
    ])
    expect(resources.assignments.find(detail => detail.assignment.id === 'projector-session-1')?.session?.id).toBe(firstSession.id)

    const attachments = await app.queries.listAttachments({
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student',
    })
    expect(attachments.attachments.map(item => item.id)).toEqual(['student-photo'])
    await app.setup.removeAttachment({ attachmentId: 'student-photo' })
    expect(await repositories.attachmentRepository.list({ ownerId: 'student' })).toHaveLength(0)
  })
})
