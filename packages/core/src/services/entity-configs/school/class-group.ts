import type { ClassGroup } from '../../../entities/school/class-group'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared/common'
import { denyResourceAccess } from '../../../authorization'
import { StudentClassEnrollmentStatus } from '../../../entities'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { directEntityConfig, readByIds } from '../../../shared/common'

export const classGroupConfig: EntityConfigFactory<ClassGroup> = (input) => {
  const config = directEntityConfig(
    input,
    input.repositories.classGroups,
    'queries.read_class_directory',
    'setup.manage',
    readByIds((actor, ids) => input.policy.checkClassGroupAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateClassGroupSave,
    },
  }
}

export async function validateClassGroupSave(
  classGroup: ClassGroup,
  existing: ClassGroup | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [academicYear, gradeLevel, homeroomStaff] = await Promise.all([
    repositories.academicYears.findById(classGroup.academicYearId),
    repositories.gradeLevels.findById(classGroup.gradeLevelId),
    classGroup.homeroomStaffId ? repositories.staffMembers.findById(classGroup.homeroomStaffId) : Promise.resolve(undefined),
  ])
  if (!academicYear || academicYear.schoolId !== classGroup.schoolId) {
    denyResourceAccess()
  }
  if (!gradeLevel || gradeLevel.schoolId !== classGroup.schoolId) {
    denyResourceAccess()
  }
  if (classGroup.homeroomStaffId && (!homeroomStaff || homeroomStaff.schoolId !== classGroup.schoolId)) {
    denyResourceAccess()
  }
  if (existing && classGroup.capacity !== undefined) {
    const activeEnrollmentCount = await repositories.enrollments.count({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (classGroup.capacity < activeEnrollmentCount) {
      throw new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_BELOW_ENROLLMENTS', `Class group ${classGroup.id} capacity cannot be below current active enrollment count`)
    }
  }
}
