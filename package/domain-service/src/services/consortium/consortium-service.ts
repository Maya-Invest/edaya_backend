import type { Consortium, ConsortiumSharedRules } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import {
  AttendanceStatus,
  BusinessRuleViolationError,
  Consortium as ConsortiumEntity,
  FeeStatus,
  IncidentStatus,
  PaymentStatus,
} from '@edaya/core'
import { randomUUID } from 'node:crypto'

type ConsortiumRepos = Pick<
  SchoolRepositories,
  'consortiums' | 'schools' | 'students' | 'staffMembers' | 'studentFees' | 'payments' | 'attendance' | 'incidents'
>

export interface CreateConsortiumInput {
  id?: string
  name: string
  country?: string
  ownerSubjectId: string
  sharedRules?: ConsortiumSharedRules
}

export async function createConsortium(
  repositories: Pick<SchoolRepositories, 'consortiums'>,
  input: CreateConsortiumInput,
): Promise<Consortium> {
  const existing = await repositories.consortiums.findOne({ ownerSubjectId: input.ownerSubjectId })
  if (existing) {
    throw new BusinessRuleViolationError(
      'CONSORTIUM_ALREADY_EXISTS',
      'This account already owns a school group',
    )
  }

  const consortium = new ConsortiumEntity({
    id: input.id ?? randomUUID(),
    name: input.name,
    ownerSubjectId: input.ownerSubjectId,
    ...(input.country ? { country: input.country } : {}),
    sharedRules: input.sharedRules ?? { structureTemplateIds: [] },
  })
  await repositories.consortiums.save(consortium)
  return consortium
}

export async function findConsortiumOwnedBySubject(
  repositories: Pick<SchoolRepositories, 'consortiums'>,
  subjectId: string,
): Promise<Consortium | undefined> {
  return repositories.consortiums.findOne({ ownerSubjectId: subjectId })
}

export async function assertConsortiumOwner(
  repositories: Pick<SchoolRepositories, 'consortiums'>,
  consortiumId: string,
  subjectId: string,
): Promise<Consortium> {
  const consortium = await repositories.consortiums.findById(consortiumId)
  if (!consortium) {
    throw new BusinessRuleViolationError('CONSORTIUM_NOT_FOUND', 'School group not found')
  }
  if (consortium.ownerSubjectId !== subjectId) {
    throw new BusinessRuleViolationError(
      'CONSORTIUM_ACCESS_DENIED',
      'Only the school group creator can manage this group',
    )
  }
  return consortium
}

export async function isConsortiumSuperAdminForSchool(
  repositories: Pick<SchoolRepositories, 'consortiums' | 'schools'>,
  subjectId: string,
  schoolId: string,
): Promise<boolean> {
  const school = await repositories.schools.findById(schoolId)
  if (!school?.consortiumId) {
    return false
  }
  const consortium = await repositories.consortiums.findById(school.consortiumId)
  return Boolean(consortium && consortium.ownerSubjectId === subjectId)
}

export async function listConsortiumSchools(
  repositories: Pick<SchoolRepositories, 'schools'>,
  consortiumId: string,
) {
  return repositories.schools.list({ consortiumId })
}

export interface ConsortiumSchoolStats {
  schoolId: string
  schoolName: string
  studentCount: number
  staffCount: number
  overdueFeeCount: number
  overdueFeeAmount: number
  recentPaymentAmount: number
  absencesToday: number
  openIncidentCount: number
  ownerSubjectId?: string
  ownerName?: string
  ownerEmail?: string
  ownerStatus: 'assigned' | 'pending_invite' | 'unassigned'
  assignableStaff: Array<{
    subjectId: string
    name: string
    email?: string
  }>
}

export interface ConsortiumDashboard {
  consortium: {
    id: string
    name: string
    country?: string
    sharedRules: ConsortiumSharedRules
  }
  schoolCount: number
  totals: {
    studentCount: number
    staffCount: number
    overdueFeeCount: number
    overdueFeeAmount: number
    recentPaymentAmount: number
    absencesToday: number
    openIncidentCount: number
  }
  schools: ConsortiumSchoolStats[]
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

export async function buildConsortiumDashboard(
  repositories: ConsortiumRepos,
  consortiumId: string,
  options?: { referenceDate?: Date },
): Promise<ConsortiumDashboard> {
  const consortium = await repositories.consortiums.findById(consortiumId)
  if (!consortium) {
    throw new BusinessRuleViolationError('CONSORTIUM_NOT_FOUND', 'School group not found')
  }

  const referenceDate = options?.referenceDate ?? new Date()
  const schools = await repositories.schools.list({ consortiumId })
  const schoolStats: ConsortiumSchoolStats[] = []

  for (const school of schools) {
    const [students, staff, allFees, allPayments, allAttendance, incidents] = await Promise.all([
      repositories.students.list({ schoolId: school.id }),
      repositories.staffMembers.list({ schoolId: school.id }),
      repositories.studentFees.list(),
      repositories.payments.list(),
      repositories.attendance.list(),
      repositories.incidents.list({ schoolId: school.id }),
    ])

    const studentIds = new Set(students.map(student => student.id))
    const schoolFees = allFees.filter(fee => studentIds.has(fee.studentId))
    const overdueFees = schoolFees.filter(fee => fee.status === FeeStatus.Overdue)
    const overdueFeeAmount = overdueFees.reduce((sum, fee) => sum + fee.balanceDue.amount, 0)

    const feeIds = new Set(schoolFees.map(fee => fee.id))
    const recentPaymentAmount = allPayments
      .filter(payment => feeIds.has(payment.studentFeeId) && payment.status === PaymentStatus.Recorded)
      .reduce((sum, payment) => sum + payment.amount.amount, 0)

    const absencesToday = allAttendance.filter(record =>
      studentIds.has(record.studentId)
      && isSameDay(record.date, referenceDate)
      && record.status === AttendanceStatus.Absent,
    ).length

    const openIncidentCount = incidents.filter(incident => incident.status === IncidentStatus.Open).length

    let ownerSubjectId: string | undefined
    let ownerName: string | undefined
    let ownerEmail: string | undefined
    let ownerStatus: ConsortiumSchoolStats['ownerStatus'] = 'unassigned'

    if (school.ownerSubjectId) {
      ownerSubjectId = school.ownerSubjectId
      ownerStatus = 'assigned'
      const ownerStaff = staff.find(member => member.subjectId === school.ownerSubjectId)
      if (ownerStaff) {
        ownerName = `${ownerStaff.firstName} ${ownerStaff.lastName}`.trim()
        ownerEmail = ownerStaff.email
      }
    }
    else if (school.pendingOwnerStaffId) {
      ownerStatus = 'pending_invite'
      const pendingStaff = staff.find(member => member.id === school.pendingOwnerStaffId)
        ?? await repositories.staffMembers.findById(school.pendingOwnerStaffId)
      if (pendingStaff) {
        ownerName = `${pendingStaff.firstName} ${pendingStaff.lastName}`.trim()
        ownerEmail = pendingStaff.email
      }
    }

    const assignableStaff = staff
      .filter(member => member.isActive && member.subjectId)
      .map(member => ({
        subjectId: member.subjectId!,
        name: `${member.firstName} ${member.lastName}`.trim(),
        ...(member.email ? { email: member.email } : {}),
      }))

    schoolStats.push({
      schoolId: school.id,
      schoolName: school.name,
      studentCount: students.length,
      staffCount: staff.filter(member => member.isActive).length,
      overdueFeeCount: overdueFees.length,
      overdueFeeAmount,
      recentPaymentAmount,
      absencesToday,
      openIncidentCount,
      ...(ownerSubjectId ? { ownerSubjectId } : {}),
      ...(ownerName ? { ownerName } : {}),
      ...(ownerEmail ? { ownerEmail } : {}),
      ownerStatus,
      assignableStaff,
    })
  }

  const totals = schoolStats.reduce(
    (acc, row) => ({
      studentCount: acc.studentCount + row.studentCount,
      staffCount: acc.staffCount + row.staffCount,
      overdueFeeCount: acc.overdueFeeCount + row.overdueFeeCount,
      overdueFeeAmount: acc.overdueFeeAmount + row.overdueFeeAmount,
      recentPaymentAmount: acc.recentPaymentAmount + row.recentPaymentAmount,
      absencesToday: acc.absencesToday + row.absencesToday,
      openIncidentCount: acc.openIncidentCount + row.openIncidentCount,
    }),
    {
      studentCount: 0,
      staffCount: 0,
      overdueFeeCount: 0,
      overdueFeeAmount: 0,
      recentPaymentAmount: 0,
      absencesToday: 0,
      openIncidentCount: 0,
    },
  )

  return {
    consortium: {
      id: consortium.id,
      name: consortium.name,
      ...(consortium.country ? { country: consortium.country } : {}),
      sharedRules: consortium.sharedRules,
    },
    schoolCount: schools.length,
    totals,
    schools: schoolStats,
  }
}

export async function updateConsortiumSharedRules(
  repositories: Pick<SchoolRepositories, 'consortiums'>,
  consortiumId: string,
  subjectId: string,
  sharedRules: ConsortiumSharedRules,
): Promise<Consortium> {
  const consortium = await assertConsortiumOwner(repositories, consortiumId, subjectId)
  const updated = new ConsortiumEntity({
    ...consortium.data,
    sharedRules,
  })
  await repositories.consortiums.save(updated)
  return updated
}
