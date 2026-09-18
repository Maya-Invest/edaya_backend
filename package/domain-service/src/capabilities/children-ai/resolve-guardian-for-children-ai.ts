import { StudentClassEnrollmentStatus, type CoreEntityRepositories, type GradeLevel } from '@edaya/core'

export const CHILDREN_AI_RESOLVE_SECRET_HEADER = 'x-children-ai-resolve-secret'

export type ChildrenAiGradeId = '6e' | '5e' | '4e' | '3e'

export interface ChildrenAiResolvedChild {
  studentId: string
  schoolId: string
  firstName: string
  lastName: string
  classLabel?: string
  grade?: ChildrenAiGradeId
}

export interface ChildrenAiResolvedGuardian {
  schoolId: string
  displayName: string
  children: ChildrenAiResolvedChild[]
}

export const EMPTY_CHILDREN_AI_GUARDIAN: ChildrenAiResolvedGuardian = {
  schoolId: '',
  displayName: '',
  children: [],
}

type ResolveGuardianRepositories = Pick<
  CoreEntityRepositories,
  'guardians' | 'guardianLinks' | 'students' | 'enrollments' | 'classGroups' | 'gradeLevels'
>

type ClassPlacement = {
  classLabel: string
  grade?: ChildrenAiGradeId
}

export async function resolveGuardianForChildrenAi(
  repositories: ResolveGuardianRepositories,
  subjectId: string,
): Promise<ChildrenAiResolvedGuardian> {
  const trimmed = subjectId.trim()
  if (!trimmed) {
    return EMPTY_CHILDREN_AI_GUARDIAN
  }

  const guardian = await repositories.guardians.findOne({ subjectId: trimmed })
  if (!guardian?.hasAccess) {
    return EMPTY_CHILDREN_AI_GUARDIAN
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
  const children: ChildrenAiResolvedChild[] = []
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
      ...(placement?.grade ? { grade: placement.grade } : {}),
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
      grade: mapCollegeGrade(gradeLevelById.get(classGroup.gradeLevelId)),
    })
  }

  return placements
}

function mapCollegeGrade(gradeLevel: GradeLevel | undefined): ChildrenAiGradeId | undefined {
  if (!gradeLevel) {
    return undefined
  }
  const haystack = `${gradeLevel.label} ${gradeLevel.name}`.toLowerCase()
  if (haystack.includes('3e') || haystack.includes('3ème') || haystack.includes('troisi')) {
    return '3e'
  }
  if (haystack.includes('4e') || haystack.includes('4ème') || haystack.includes('quatr')) {
    return '4e'
  }
  if (haystack.includes('5e') || haystack.includes('5ème') || haystack.includes('cinq')) {
    return '5e'
  }
  if (haystack.includes('6e') || haystack.includes('6ème') || haystack.includes('sixi')) {
    return '6e'
  }
  return undefined
}
