import type { SeedApplication } from '../../../support/types'
import type { TeachersSeedPort } from '../port'
import { Teacher, TeacherAssignment } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessTeachersSeedPort(
  application: SeedApplication,
): TeachersSeedPort {
  const service = createInProcessSeedService(application, 'dev-teachers-seed')

  return {
    saveTeacher: record => withSeedPortError('teachers.saveTeacher', async () => {
      await service.baseService.entities.teachers.save(new Teacher({
        id: record.id,
        schoolId: record.schoolId,
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        subjectId: record.subjectId,
        isActive: true,
      }))
    }),
    saveTeacherAssignment: record => withSeedPortError('teachers.saveTeacherAssignment', async () => {
      await service.baseService.entities.teacherAssignments.save(new TeacherAssignment(record))
    }),
  }
}
