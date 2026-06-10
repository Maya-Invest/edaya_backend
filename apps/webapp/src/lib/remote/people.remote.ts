import type { components } from '$lib/api/schema'
import type { Student } from '$lib/data/school'
import { query } from '$app/server'
import { apiFetch } from '$lib/server/api-client'
import { fetchStaffMembers } from '$lib/server/staff-data'

export const getSchoolStudentsData = query(async () => {
  const [
    studentsRaw,
    enrollmentsRaw,
    guardiansRaw,
    linksRaw,
  ] = await Promise.all([
    apiFetch<components['schemas']['Student'][]>('/api/core/entities/students/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['StudentClassEnrollment'][]>('/api/core/entities/enrollments/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['Guardian'][]>('/api/core/entities/guardians/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    apiFetch<components['schemas']['GuardianStudentLink'][]>('/api/core/entities/guardian-links/list', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  ])

  const mappedStudents: Student[] = (studentsRaw ?? []).map((s) => {
    const activeEnr = (enrollmentsRaw ?? []).find(
      e => e.studentId === s.id && e.status === 'active',
    )
    const classId = activeEnr?.classGroupId ?? ''

    const link = (linksRaw ?? []).find(l => l.studentId === s.id)
    const guardianObj = link
      ? (guardiansRaw ?? []).find(g => g.id === link.guardianId)
      : null
    const guardian = guardianObj
      ? `${guardianObj.firstName} ${guardianObj.lastName}`
      : 'Non renseigné'

    return {
      id: s.id,
      classId,
      name: `${s.firstName} ${s.lastName}`,
      initials: `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`,
      email: `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}@school.edu`,
      birthdate: typeof s.birthDate === 'string' ? s.birthDate : String(s.birthDate || ''),
      guardian,
      attendance: 98,
      average: 14.5,
      status: 'active',
    }
  })

  return mappedStudents
})

export const getSchoolStaffData = query(async () => fetchStaffMembers())
