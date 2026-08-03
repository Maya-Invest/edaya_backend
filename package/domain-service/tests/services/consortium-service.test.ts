import { createInMemoryTestApp } from '../support/create-test-app'
import {
  assertConsortiumOwner,
  buildConsortiumDashboard,
  createConsortium,
  isConsortiumSuperAdminForSchool,
} from '../../src/services/consortium/consortium-service'
import {
  AttendanceRecord,
  AttendanceStatus,
  BusinessRuleViolationError,
  FeeStatus,
  Incident,
  IncidentKind,
  IncidentStatus,
  School,
  StaffMember,
  Student,
  StudentFee,
} from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('consortium service', () => {
  test('creates a consortium and rejects a second for same owner', async () => {
    const app = createInMemoryTestApp()
    const created = await createConsortium(app.repositories, {
      name: 'Groupe Méthodiste',
      ownerSubjectId: 'subject-1',
      country: 'CI',
    })

    expect(created.name).toBe('Groupe Méthodiste')
    await expect(createConsortium(app.repositories, {
      name: 'Autre',
      ownerSubjectId: 'subject-1',
    })).rejects.toMatchObject({ code: 'CONSORTIUM_ALREADY_EXISTS' })
  })

  test('only owner can manage consortium', async () => {
    const app = createInMemoryTestApp()
    const consortium = await createConsortium(app.repositories, {
      id: 'cons-1',
      name: 'Groupe A',
      ownerSubjectId: 'owner',
    })
    await expect(assertConsortiumOwner(app.repositories, consortium.id, 'owner')).resolves.toBeTruthy()
    await expect(assertConsortiumOwner(app.repositories, consortium.id, 'other')).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('aggregates school stats for dashboard', async () => {
    const app = createInMemoryTestApp()
    const consortium = await createConsortium(app.repositories, {
      id: 'cons-1',
      name: 'Groupe A',
      ownerSubjectId: 'owner',
    })
    await app.repositories.schools.save(new School({
      id: 'sch-1',
      name: 'École Nord',
      timeZone: 'Africa/Abidjan',
      consortiumId: consortium.id,
    }))

    expect(await isConsortiumSuperAdminForSchool(app.repositories, 'owner', 'sch-1')).toBe(true)

    await app.repositories.students.save(new Student({
      id: 'stu-1',
      schoolId: 'sch-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await app.repositories.studentFees.save(new StudentFee({
      id: 'fee-1',
      studentId: 'stu-1',
      feeId: 'catalog-1',
      academicYearId: 'year-1',
      expectedAmount: 1000,
      paidAmount: 0,
      currency: 'XOF',
      status: FeeStatus.Overdue,
      dueDate: new Date('2020-01-01'),
    }))
    await app.repositories.attendance.save(new AttendanceRecord({
      id: 'att-1',
      studentId: 'stu-1',
      attendanceId: 'daily-1',
      date: new Date(),
      status: AttendanceStatus.Absent,
    }))
    await app.repositories.incidents.save(new Incident({
      id: 'inc-1',
      schoolId: 'sch-1',
      kind: IncidentKind.MinorInfraction,
      status: IncidentStatus.Open,
      title: 'Incident',
      description: 'Desc',
      date: new Date(),
      reporterId: 'staff-1',
    }))

    const dashboard = await buildConsortiumDashboard(app.repositories, consortium.id)
    expect(dashboard.schoolCount).toBe(1)
    expect(dashboard.totals.studentCount).toBe(1)
    expect(dashboard.totals.overdueFeeCount).toBe(1)
    expect(dashboard.totals.absencesToday).toBe(1)
    expect(dashboard.totals.openIncidentCount).toBe(1)
    expect(dashboard.schools[0]?.ownerStatus).toBe('unassigned')
  })

  test('dashboard reports assigned and pending owner statuses', async () => {
    const app = createInMemoryTestApp()
    const consortium = await createConsortium(app.repositories, {
      id: 'cons-owner',
      name: 'Groupe Owner',
      ownerSubjectId: 'owner',
    })

    await app.repositories.schools.save(new School({
      id: 'sch-assigned',
      name: 'Assigned School',
      timeZone: 'Africa/Abidjan',
      consortiumId: consortium.id,
      ownerSubjectId: 'school-owner-1',
    }))
    await app.repositories.staffMembers.save(new StaffMember({
      id: 'staff-owner-1',
      schoolId: 'sch-assigned',
      firstName: 'Awa',
      lastName: 'Kone',
      email: 'awa@school.edu',
      subjectId: 'school-owner-1',
      isActive: true,
    }))

    await app.repositories.schools.save(new School({
      id: 'sch-pending',
      name: 'Pending School',
      timeZone: 'Africa/Abidjan',
      consortiumId: consortium.id,
      pendingOwnerStaffId: 'staff-pending-1',
    }))
    await app.repositories.staffMembers.save(new StaffMember({
      id: 'staff-pending-1',
      schoolId: 'sch-pending',
      firstName: 'Pending',
      lastName: 'Owner',
      email: 'pending@school.edu',
      isActive: true,
    }))

    const dashboard = await buildConsortiumDashboard(app.repositories, consortium.id)
    const assigned = dashboard.schools.find(row => row.schoolId === 'sch-assigned')
    const pending = dashboard.schools.find(row => row.schoolId === 'sch-pending')

    expect(assigned?.ownerStatus).toBe('assigned')
    expect(assigned?.ownerName).toBe('Awa Kone')
    expect(assigned?.ownerEmail).toBe('awa@school.edu')
    expect(assigned?.assignableStaff).toEqual([
      { subjectId: 'school-owner-1', name: 'Awa Kone', email: 'awa@school.edu' },
    ])

    expect(pending?.ownerStatus).toBe('pending_invite')
    expect(pending?.ownerEmail).toBe('pending@school.edu')
  })
})
