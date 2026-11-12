import type { CoreEntityRepositories, GradeLevel } from '@edaya/core'
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

export interface EdayaSparkResolvedGuardian {
  schoolId: string
  displayName: string
  children: EdayaSparkResolvedChild[]
}

export const EMPTY_EDAYA_SPARK_GUARDIAN: EdayaSparkResolvedGuardian = {
  schoolId: '',
  displayName: '',
  children: [],
}

type ResolveGuardianRepositories = Pick<
  CoreEntityRepositories,
  'guardians' | 'guardianLinks' | 'students' | 'enrollments' | 'classGroups' | 'gradeLevels'
>

interface ClassPlacement {
  classLabel: string
  gradeLevel?: EdayaSparkGradeLevel
}

export async function resolveGuardianForEdayaSpark(
  repositories: ResolveGuardianRepositories,
  subjectId: string,
): Promise<EdayaSparkResolvedGuardian> {
  const trimmed = subjectId.trim()
  if (!trimmed) {
    return EMPTY_EDAYA_SPARK_GUARDIAN
  }

  const guardian = await repositories.guardians.findOne({ subjectId: trimmed })
  if (!guardian?.hasAccess) {
    return EMPTY_EDAYA_SPARK_GUARDIAN
  }

  const links = await repositories.guardianLinks.list({
    schoolId: guardian.schoolId,
    guardianId: guardian.id,
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
    resolveClassPlacements(repositories, guardian.schoolId, studentIds),
  ])
  const byId = new Map(students.map(student => [student.id, student]))
  const children: EdayaSparkResolvedChild[] = []
  for (const studentId of studentIds) {
    const student = byId.get(studentId)
    if (!student || student.schoolId !== guardian.schoolId) {
      continue
    }
    const placement = placements.get(studentId)
    children.push({
      studentId: student.id,
      schoolId: guardian.schoolId,
      firstName: student.firstName,
      lastName: student.lastName,
      ...(placement?.classLabel ? { classLabel: placement.classLabel } : {}),
      ...(placement?.gradeLevel ? { gradeLevel: placement.gradeLevel } : {}),
    })
  }

  return {
    schoolId: guardian.schoolId,
    displayName: guardian.fullName,
    children,
  }
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
