import { AuthorizationError, createGuardianActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { DomainValidationError, Incident, IncidentInvolvementRole, IncidentKind, IncidentStatus, noOpFileStorage, noOpNotificationGateway, StudentIncidentInvolvement } from '@edaya/core'
import { expect, setSystemTime, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'

const pool = usePooledDatabases()
test('pages authored incidents in date and ID order and resolves detail independently', async () => {
  const f = await pool.createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(f.db)
    const date = new Date('2026-05-02T12:00:00Z')
    setSystemTime(date)
    const identity = { schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'test', authenticatedAt: date }
    const ports = { repositories: f.repositories, atomicExecution: f.atomic, commandJournal: new PostgresCommandJournal(), notificationGateway: noOpNotificationGateway, fileStorage: noOpFileStorage }
    const teacher = new SchoolService({ ...ports, actor: createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }) })
    const guardian = new SchoolService({ ...ports, actor: createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }) })
    const classGroupId = 'class-a'
    for (let i = 0; i < 35; i++) {
      await f.repositories.incidents.save(new Incident({
        id: `row-${String(i).padStart(2, '0')}`,
        schoolId: 'school-a',
        classGroupId,
        date,
        title: 'Incident',
        description: 'Facts',
        kind: IncidentKind.MinorInfraction,
        reporterId: i === 34 ? 'other' : 'teacher-a',
        status: i === 3 ? IncidentStatus.Cancelled : IncidentStatus.Open,
      }))
    }
    await f.repositories.studentIncidentInvolvements.save(new StudentIncidentInvolvement({ id: 'involved', incidentId: 'row-01', studentId: 'student-a', role: IncidentInvolvementRole.Subject }))
    await f.db.exec(`insert into student_disciplinary_actions(id,school_id,incident_id,student_id,disciplinary_action_id,assigned_by_staff_id,status,created_at,updated_at)
      values ('consequence','school-a','row-09','student-a','action','staff-a','active',now(),now())`)
    await f.repositories.teacherCorrections.saveState({ schoolId: 'school-a', workflow: 'discipline', targetId: 'row-05', version: 1, locked: true, history: [], payload: {} })
    const first = await teacher.getTeacherIncidents({ classGroupId })
    expect(first.items).toHaveLength(30)
    const next = await teacher.getTeacherIncidents({ classGroupId, cursor: first.nextCursor! })
    expect(next.nextCursor).toBeNull()
    const rows = [...first.items, ...next.items]
    expect(rows.map(r => r.id)).toEqual(Array.from({ length: 34 }, (_, i) => `row-${String(33 - i).padStart(2, '0')}`))
    expect(rows.filter(r => r.locked).map(r => r.id)).toEqual(['row-09', 'row-05', 'row-03'])
    await f.db.exec(`update student_class_enrollments set status='closed', ended_at='2026-05-01',end_reason='withdrawn',closed_by='staff-a' where id='enrollment-a'`)
    const detail = await teacher.getTeacherIncidentDetail({ classGroupId, incidentId: 'row-01' })
    expect(detail.eligibility.context.students.map(s => s.id)).toEqual(['student-a'])
    expect(detail.eligibility.official).toMatchObject({ targetId: 'row-01', studentIds: ['student-a'] })
    await expect(teacher.getTeacherIncidentDetail({ classGroupId, incidentId: 'row-34' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(teacher.getTeacherIncidentDetail({ classGroupId: 'class-other', incidentId: 'row-01' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(teacher.getTeacherIncidents({ classGroupId, cursor: 'other-cursor' })).rejects.toBeInstanceOf(DomainValidationError)
    await expect(guardian.getTeacherIncidents({ classGroupId })).rejects.toBeInstanceOf(AuthorizationError)
    await f.repositories.teacherAssignments.delete('teaching')
    await expect(teacher.getTeacherIncidents({ classGroupId, cursor: first.nextCursor! })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(teacher.getTeacherIncidentDetail({ classGroupId, incidentId: 'row-01' })).rejects.toBeInstanceOf(AuthorizationError)
  }
  finally {
    setSystemTime()
    await pool.releaseDatabase(f.db)
  }
}, 30000)
