import type { AcademicPeriod, ClassGroup, Student } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, AuthorizationErrorCode, denyResourceAccess, requireActorSchoolId } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'

export class BaseServiceWorkflow {
  constructor(
    readonly baseService: BaseSchoolService,
  ) {}

  protected checkActorSchool(schoolId: string): void {
    if (schoolId !== requireActorSchoolId(this.baseService.actor))
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  protected async requireStudent(studentId: string): Promise<Student> {
    const student = await this.baseService.repositories.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  protected async requirePeriod(periodId: string): Promise<AcademicPeriod> {
    const period = await this.baseService.repositories.academicPeriods.findById(periodId)
    if (!period) {
      throw new BusinessRuleViolationError('UNKNOWN_PERIOD', `Unknown period: ${periodId}`)
    }
    return period
  }

  protected async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.baseService.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }
}
