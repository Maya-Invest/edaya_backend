import type { AcademicYear } from '../../entities'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '../../authorization'
import { AcademicYear as AcademicYearEntity } from '../../entities'
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
    await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'setup.manage')
    await requireSchool(this.base.repositories.schools, schoolId)

    return this.base.atomicExecution.execute(async () => {
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
      await this.base.academicYears.save(academicYear, { moduleChecked: true })
      return academicYear
    })
  }

  async activateAcademicYear({ academicYearId }: ActivateAcademicYearInput): Promise<AcademicYear> {
    const academicYear = await this.base.repositories.academicYears.findById(academicYearId)
    if (!academicYear) {
      denyResourceAccess()
    }
    this.checkActorSchool(academicYear.schoolId)
    await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'setup.manage_lifecycle')

    return this.base.atomicExecution.execute(async () => {
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
      await this.base.academicYears.save(activated, { moduleChecked: true })
      return activated
    })
  }

  private async deactivateOtherAcademicYears(schoolId: string, activeAcademicYearId: string): Promise<void> {
    const activeAcademicYears = await this.base.repositories.academicYears.list({ schoolId, isActive: true })
    for (const academicYear of activeAcademicYears) {
      if (academicYear.id === activeAcademicYearId) {
        continue
      }
      await this.base.academicYears.save(new AcademicYearEntity({
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
