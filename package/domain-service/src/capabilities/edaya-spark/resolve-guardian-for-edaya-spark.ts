import type { CoreEntityRepositories, GradeLevel, Guardian } from '@edaya/core'
import { StudentClassEnrollmentStatus } from '@edaya/core'

export const EDAYA_SPARK_RESOLVE_SECRET_HEADER = 'x-edaya-spark-resolve-secret'

export interface EdayaSparkGradeLevel {
  id: string
  name: string
  label: string
  order: number
  cycle?: string
}

export interface EdayaSparkResolvedChild {
  studentId: string
  schoolId: string
  firstName: string
  lastName: string
  classLabel?: string
  gradeLevel?: EdayaSparkGradeLevel
}

export interface EdayaSparkResolvedSchool {
  schoolId: string
  schoolName: string
  children: EdayaSparkResolvedChild[]
}

export interface EdayaSparkResolvedGuardian {
  schoolId: string
  displayName: string
  children: EdayaSparkResolvedChild[]
  schools: EdayaSparkResolvedSchool[]
}

export const EMPTY_EDAYA_SPARK_GUARDIAN: EdayaSparkResolvedGuardian = {
  schoolId: '',
  displayName: '',
  children: [],
  schools: [],
}

type ResolveGuardianRepositories = Pick<
  CoreEntityRepositories,
  'guardians' | 'guardianLinks' | 'students' | 'enrollments' | 'classGroups' | 'gradeLevels' | 'schools'
>

interface ClassPlacement {
  classLabel: string
  gradeLevel?: EdayaSparkGradeLevel
}

export async function resolveGuardianForEdayaSpark(
  repositories: ResolveGuardianRepositories,
  subjectId: string,
  email?: string,
): Promise<EdayaSparkResolvedGuardian> {
  const trimmed = subjectId.trim()
  const normalizedEmail = email?.trim().toLowerCase() ?? ''
  if (!trimmed && !normalizedEmail) {
    return EMPTY_EDAYA_SPARK_GUARDIAN
  }

  const guardiansById = new Map<string, Guardian>()
  if (trimmed) {
    const linked = await repositories.guardians.list({ subjectId: trimmed })
    for (const guardian of linked) {
      if (guardian.hasAccess) {
        guardiansById.set(guardian.id, guardian)
      }
    }
  }
  if (normalizedEmail) {
    const byEmail = await repositories.guardians.list({ email: normalizedEmail })
    for (const guardian of byEmail) {
      if (guardian.hasAccess) {
        guardiansById.set(guardian.id, guardian)
      }
    }
  }
  const guardians = [...guardiansById.values()].sort((left, right) => left.id.localeCompare(right.id))
  if (guardians.length === 0) {
    return EMPTY_EDAYA_SPARK_GUARDIAN
  }

  const schoolIds = [...new Set(guardians.map(guardian => guardian.schoolId))]
  const schoolRows = await repositories.schools.findByIds(schoolIds)
  const schoolNameById = new Map(schoolRows.map(school => [school.id, school.name]))
  const schoolsById = new Map<string, EdayaSparkResolvedSchool>()
  for (const guardian of guardians) {
    const children = await loadGuardianChildren(repositories, guardian.schoolId, guardian.id)
    const existing = schoolsById.get(guardian.schoolId)
    if (!existing) {
      schoolsById.set(guardian.schoolId, {
        schoolId: guardian.schoolId,
        schoolName: schoolNameById.get(guardian.schoolId) || guardian.schoolId,
        children,
      })
      continue
    }
    const seen = new Set(existing.children.map(child => child.studentId))
    for (const child of children) {
      if (seen.has(child.studentId)) {
        continue
      }
      seen.add(child.studentId)
      existing.children.push(child)
    }
  }

  const schools = [...schoolsById.values()].sort((left, right) => {
    const byName = left.schoolName.localeCompare(right.schoolName, 'fr')
    return byName === 0 ? left.schoolId.localeCompare(right.schoolId) : byName
  })
  const named = guardians.find(guardian => guardian.subjectId === trimmed && guardian.fullName)
    ?? guardians.find(guardian => guardian.fullName)
  return {
    schoolId: schools[0]?.schoolId ?? '',
    displayName: named?.fullName ?? '',
    children: schools.flatMap(school => school.children),
    schools,
  }
}

async function loadGuardianChildren(
  repositories: ResolveGuardianRepositories,
  schoolId: string,
  guardianId: string,
): Promise<EdayaSparkResolvedChild[]> {
  const links = await repositories.guardianLinks.list({
    schoolId,
    guardianId,
  })
  const studentIds: string[] = []
  const seen = new Set<string>()
  for (const link of links) {
    if (seen.has(link.studentId)) {
      continue
    }
    seen.add(link.studentId)
    studentIds.push(link.studentId)
  }
  const [students, placements] = await Promise.all([
    repositories.students.findByIds(studentIds),
    resolveClassPlacements(repositories, schoolId, studentIds),
  ])
  const byId = new Map(students.map(student => [student.id, student]))
  const children: EdayaSparkResolvedChild[] = []
  for (const studentId of studentIds) {
    const student = byId.get(studentId)
    if (!student || student.schoolId !== schoolId) {
      continue
    }
    const placement = placements.get(studentId)
    children.push({
      studentId: student.id,
      schoolId,
      firstName: student.firstName,
      lastName: student.lastName,
      ...(placement?.classLabel ? { classLabel: placement.classLabel } : {}),
      ...(placement?.gradeLevel ? { gradeLevel: placement.gradeLevel } : {}),
    })
  }
  return children
}

async function resolveClassPlacements(
  repositories: ResolveGuardianRepositories,
  schoolId: string,
  studentIds: readonly string[],
): Promise<Map<string, ClassPlacement>> {
  const placements = new Map<string, ClassPlacement>()
  if (studentIds.length === 0) {
    return placements
  }

  const enrollments = await repositories.enrollments.list({
    studentId: { $in: [...studentIds] },
    status: StudentClassEnrollmentStatus.Active,
  })
  if (enrollments.length === 0) {
    return placements
  }

  const classGroupIds = [...new Set(enrollments.map(enrollment => enrollment.classGroupId))]
  const classGroups = await repositories.classGroups.findByIds(classGroupIds)
  const classGroupById = new Map(classGroups.map(classGroup => [classGroup.id, classGroup]))
  const schoolClassGroups = classGroups.filter(classGroup => classGroup.schoolId === schoolId)
  const gradeLevelIds = [...new Set(schoolClassGroups.map(classGroup => classGroup.gradeLevelId))]
  const gradeLevels = gradeLevelIds.length === 0
    ? []
    : await repositories.gradeLevels.findByIds(gradeLevelIds)
  const gradeLevelById = new Map(gradeLevels.map(gradeLevel => [gradeLevel.id, gradeLevel]))

  for (const enrollment of enrollments) {
    const classGroup = classGroupById.get(enrollment.classGroupId)
    if (!classGroup || classGroup.schoolId !== schoolId) {
      continue
    }
    placements.set(enrollment.studentId, {
      classLabel: classGroup.name,
      gradeLevel: copyGradeLevel(gradeLevelById.get(classGroup.gradeLevelId)),
    })
  }

  return placements
}

function copyGradeLevel(gradeLevel: GradeLevel | undefined): EdayaSparkGradeLevel | undefined {
  if (!gradeLevel) {
    return undefined
  }
  return {
    id: gradeLevel.id,
    name: gradeLevel.name,
    label: gradeLevel.shortName ?? gradeLevel.name,
    order: gradeLevel.order,
    ...(gradeLevel.cycle ? { cycle: gradeLevel.cycle } : {}),
  }
}
