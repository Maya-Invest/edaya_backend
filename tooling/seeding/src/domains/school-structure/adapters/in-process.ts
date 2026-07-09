import type { SeedApplication } from '../../../support/types'
import type { SchoolStructureSeedPort } from '../port'
import { GradeLevel, PeriodDefinition } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessSchoolStructureSeedPort(
  application: SeedApplication,
): SchoolStructureSeedPort {
  const service = createInProcessSeedService(application, 'dev-school-structure-seed')

  return {
    inspectSeedState: demoSchoolId => withSeedPortError('schoolStructure.inspectSeedState', async () => {
      const schools = await application.repositories.schools.list()
      const studentCount = schools.some(school => school.id === demoSchoolId)
        ? (await application.repositories.students.list()).length
        : 0
      return {
        schoolIds: schools.map(school => school.id),
        studentCount,
      }
    }),
    registerSchool: record => withSeedPortError('schoolStructure.registerSchool', async () => {
      await service.setupWorkflow.registerSchool(record)
    }),
    saveGradeLevel: record => withSeedPortError('schoolStructure.saveGradeLevel', async () => {
      await service.baseService.entities.gradeLevels.save(new GradeLevel(record), { moduleChecked: true })
    }),
    createAcademicYear: record => withSeedPortError('schoolStructure.createAcademicYear', async () => {
      await service.setupWorkflow.createAcademicYear({
        ...record,
        startDate: new Date(record.startDate),
        endDate: new Date(record.endDate),
      })
    }),
    createAcademicPeriod: record => withSeedPortError('schoolStructure.createAcademicPeriod', async () => {
      await service.setupWorkflow.createAcademicPeriod({
        ...record,
        startDate: new Date(record.startDate),
        endDate: new Date(record.endDate),
      })
    }),
    publishAcademicPeriod: academicPeriodId => withSeedPortError('schoolStructure.publishAcademicPeriod', async () => {
      await service.setupWorkflow.publishAcademicPeriod({ academicPeriodId })
    }),
    savePeriodDefinition: record => withSeedPortError('schoolStructure.savePeriodDefinition', async () => {
      await service.baseService.entities.periodDefinitions.save(new PeriodDefinition(record), { moduleChecked: true })
    }),
    staffMemberExists: staffId => withSeedPortError('schoolStructure.staffMemberExists', async () =>
      Boolean(await application.repositories.staffMembers.findById(staffId))),
    registerStaffMember: record => withSeedPortError('schoolStructure.registerStaffMember', async () => {
      await service.setupWorkflow.registerStaffMember(record)
    }),
    createClassGroup: record => withSeedPortError('schoolStructure.createClassGroup', async () => {
      await service.setupWorkflow.createClassGroup(record)
    }),
  }
}
