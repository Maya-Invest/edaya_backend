import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import {
  CLASS_SUBJECT_READ_PERMISSIONS,
  CURRICULUM_READ_PERMISSIONS,
} from '../policy/resolvers/permission-sets'
import { defineOperationFamily } from './define-operation'

const curriculumTeacherRead = {
  anyOf: [
    { capability: TeachingCapability.ReadSubjectCurriculum, target: 'classSubject' as const },
    { capability: TeachingCapability.ReadSubjectRoster, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassRoster, target: 'classGroup' as const },
  ],
}

export const AcademicsOperations = defineOperationFamily({
  programRead: {
    id: 'academics.program.read',
    staff: {
      anyOf: CLASS_SUBJECT_READ_PERMISSIONS.map(permission => ({ permission })),
    },
    teacher: curriculumTeacherRead,
    guardian: { capability: GuardianCapability.ReadCurriculum },
    student: { capability: StudentCapability.ReadCurriculum },
  },
  programUpdate: {
    id: 'academics.program.update',
    global: true,
    staff: { permission: Permission.ACADEMIC_PROGRAM_UPDATE },
  },
  curriculumRead: {
    id: 'academics.curriculum.read',
    staff: {
      anyOf: CURRICULUM_READ_PERMISSIONS.map(permission => ({ permission })),
    },
    teacher: curriculumTeacherRead,
    guardian: { capability: GuardianCapability.ReadCurriculum },
    student: { capability: StudentCapability.ReadCurriculum },
  },
  curriculumReadScoped: {
    id: 'academics.curriculum.read-scoped',
    staff: { permission: Permission.QUERY_CLASS_CURRICULUM_READ },
    teacher: { capability: TeachingCapability.ReadSubjectCurriculum, target: 'classSubject' },
  },
  examConfigure: {
    id: 'academics.exam.configure',
    global: true,
    staff: { permission: Permission.EXAM_CONFIG_CONFIGURE },
  },
})
