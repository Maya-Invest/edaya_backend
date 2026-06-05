import type { AcademicYear } from '../../entities'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, Permission } from '../../authorization'
import { AcademicYear as AcademicYearEntity } from '../../entities'
import { permissionAction } from '../../shared'
import { requireSchool } from '../../shared/require-school'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface CreateAcademicYearInput {
  id: string
  schoolId: string
  name: string
  startDate: Date
  endDate: Date
  createdAt?: Date
}

export interface ActivateAcademicYearInput {
  academicYearId: string
}

export class SetupServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async createAcademicYear({
    id,
    schoolId,
    name,
    startDate,
    endDate,
    createdAt,
  }: CreateAcademicYearInput): Promise<AcademicYear> {
    this.checkActorSchool(schoolId)
    await permissionAction(this.baseService.authorizationPolicy, Permission.SCHOOL_STRUCTURE_CONFIGURE)(this.baseService.actor)
    await requireSchool(this.baseService.repositories.schools, schoolId)

    return this.baseService.atomicExecution.execute(async () => {
      const academicYear = new AcademicYearEntity({
        id,
        schoolId,
        name,
        startDate,
        endDate,
        isActive: true,
        createdAt,
      })
      await this.deactivateOtherAcademicYears(schoolId, academicYear.id)
      await this.baseService.academicYears.save(academicYear, { moduleChecked: true })
      return academicYear
    })
  }

  async activateAcademicYear({ academicYearId }: ActivateAcademicYearInput): Promise<AcademicYear> {
    const academicYear = await this.baseService.repositories.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    this.checkActorSchool(academicYear.schoolId)
    await permissionAction(this.baseService.authorizationPolicy, Permission.SCHOOL_LIFECYCLE_MANAGE)(this.baseService.actor)

    return this.baseService.atomicExecution.execute(async () => {
      await this.deactivateOtherAcademicYears(academicYear.schoolId, academicYear.id)
      const activated = new AcademicYearEntity({
        id: academicYear.id,
        schoolId: academicYear.schoolId,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: true,
        createdAt: academicYear.createdAt,
      })
      await this.baseService.academicYears.save(activated, { moduleChecked: true })
      return activated
    })
  }

  private async deactivateOtherAcademicYears(schoolId: string, activeAcademicYearId: string): Promise<void> {
    const activeAcademicYears = await this.baseService.repositories.academicYears.list({ schoolId, isActive: true })
    for (const academicYear of activeAcademicYears) {
      if (academicYear.id === activeAcademicYearId) {
        continue
      }
      await this.baseService.academicYears.save(new AcademicYearEntity({
        id: academicYear.id,
        schoolId: academicYear.schoolId,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: false,
        createdAt: academicYear.createdAt,
      }), { moduleChecked: true })
    }
  }
}
