import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, it } from 'bun:test'
import { noOpNotificationGateway } from '../../../src/adapters'
import { SchoolService } from '../../../src/application'
import {
  ClassGroup,
  GradeLevel,
  Subject,
  SubjectCategory,
  SubjectColor,
  SubjectMatter,
} from '../../../src/domain'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'
import { testFileStorage } from '../../support/test-file-storage'

const actor = createElevatedTestStaffActor('sch1', 'user1')

function createAcademicsTestService(repositories: SchoolRepositories) {
  return new SchoolService({
    repositories,
    authorizationPolicy: {
      checkClassGroupAccess: async () => {},
    } as never,
    actor,
    atomicExecution: { execute: async operation => operation() },
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })
}

describe('grade level subject inheritance', () => {
  it('mirrors grade level subjects to every class in the grade and new classes', async () => {
    const gradeLevels = new Map<string, GradeLevel>()
    const classGroups = new Map<string, ClassGroup>()
    const subjects = new Map<string, Subject>()
    const subjectMatters = new Map<string, SubjectMatter>()
    const gradeLevelSubjects = new Map<string, import('../../../src/domain').GradeLevelSubject>()
    const gradeLevelSubjectMatters = new Map<string, import('../../../src/domain').GradeLevelSubjectMatter>()
    const classSubjects = new Map<string, import('../../../src/domain').ClassSubject>()
    const classSubjectMatters = new Map<string, import('../../../src/domain').ClassSubjectMatter>()

    const repositories = {
      gradeLevels: {
        findById: async (id: string) => gradeLevels.get(id),
        list: async () => [...gradeLevels.values()],
        save: async (entity: GradeLevel) => { gradeLevels.set(entity.id, entity) },
      },
      academicYears: {
        findById: async () => ({ id: 'ay1', schoolId: 'sch1' }),
      },
      subjects: {
        findById: async (id: string) => subjects.get(id),
        list: async () => [...subjects.values()],
        save: async (entity: Subject) => { subjects.set(entity.id, entity) },
      },
      subjectMatters: {
        findById: async (id: string) => subjectMatters.get(id),
        list: async () => [...subjectMatters.values()],
        save: async (entity: SubjectMatter) => { subjectMatters.set(entity.id, entity) },
      },
      classGroups: {
        findById: async (id: string) => classGroups.get(id),
        list: async (filter: { gradeLevelId?: string, academicYearId?: string } = {}) =>
          [...classGroups.values()].filter(group =>
            (!filter.gradeLevelId || group.gradeLevelId === filter.gradeLevelId)
            && (!filter.academicYearId || group.academicYearId === filter.academicYearId)),
        save: async (entity: ClassGroup) => { classGroups.set(entity.id, entity) },
      },
      gradeLevelSubjects: {
        findById: async (id: string) => gradeLevelSubjects.get(id),
        list: async (filter: { gradeLevelId?: string, academicYearId?: string } = {}) =>
          [...gradeLevelSubjects.values()].filter(entry =>
            (!filter.gradeLevelId || entry.gradeLevelId === filter.gradeLevelId)
            && (!filter.academicYearId || entry.academicYearId === filter.academicYearId)),
        save: async (entity: import('../../../src/domain').GradeLevelSubject) => {
          gradeLevelSubjects.set(entity.id, entity)
        },
      },
      gradeLevelSubjectMatters: {
        findById: async (id: string) => gradeLevelSubjectMatters.get(id),
        list: async (filter: { gradeLevelSubjectId?: string } = {}) =>
          [...gradeLevelSubjectMatters.values()].filter(entry =>
            !filter.gradeLevelSubjectId || entry.gradeLevelSubjectId === filter.gradeLevelSubjectId),
        save: async (entity: import('../../../src/domain').GradeLevelSubjectMatter) => {
          gradeLevelSubjectMatters.set(entity.id, entity)
        },
        delete: async (id: string) => { gradeLevelSubjectMatters.delete(id) },
      },
      classSubjects: {
        findById: async (id: string) => classSubjects.get(id),
        findOne: async (filter: { classGroupId?: string, gradeLevelSubjectId?: string, subjectId?: string }) =>
          [...classSubjects.values()].find(entry =>
            (!filter.classGroupId || entry.classGroupId === filter.classGroupId)
            && (!filter.gradeLevelSubjectId || entry.gradeLevelSubjectId === filter.gradeLevelSubjectId)
            && (!filter.subjectId || entry.subjectId === filter.subjectId)),
        list: async (filter: { gradeLevelSubjectId?: string, classGroupId?: string } = {}) =>
          [...classSubjects.values()].filter(entry =>
            (!filter.gradeLevelSubjectId || entry.gradeLevelSubjectId === filter.gradeLevelSubjectId)
            && (!filter.classGroupId || entry.classGroupId === filter.classGroupId)),
        save: async (entity: import('../../../src/domain').ClassSubject) => {
          classSubjects.set(entity.id, entity)
        },
        delete: async (id: string) => { classSubjects.delete(id) },
      },
      classSubjectMatters: {
        findOne: async (filter: { classSubjectId?: string, subjectMatterId?: string }) =>
          [...classSubjectMatters.values()].find(entry =>
            (!filter.classSubjectId || entry.classSubjectId === filter.classSubjectId)
            && (!filter.subjectMatterId || entry.subjectMatterId === filter.subjectMatterId)),
        list: async (filter: { classSubjectId?: string } = {}) =>
          [...classSubjectMatters.values()].filter(entry =>
            !filter.classSubjectId || entry.classSubjectId === filter.classSubjectId),
        save: async (entity: import('../../../src/domain').ClassSubjectMatter) => {
          classSubjectMatters.set(entity.id, entity)
        },
        delete: async (id: string) => { classSubjectMatters.delete(id) },
      },
      assessments: { list: async () => [] },
      sessions: { list: async () => [] },
      staffAssignments: { list: async () => [] },
    } as unknown as SchoolRepositories

    const service = createAcademicsTestService(repositories)

    await repositories.gradeLevels.save(new GradeLevel({
      id: 'gl-6',
      schoolId: 'sch1',
      name: '6ème',
      order: 1,
    }))
    await repositories.subjects.save(new Subject({
      id: 'subj-math',
      schoolId: 'sch1',
      name: 'Math',
      category: SubjectCategory.Scientific,
      color: SubjectColor.Mint,
    }))
    await repositories.subjectMatters.save(new SubjectMatter({
      id: 'sm-math',
      subjectId: 'subj-math',
      name: 'Core',
      sequenceOrder: 1,
    }))
    await repositories.classGroups.save(new ClassGroup({
      id: '6a',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6A',
    }))
    await repositories.classGroups.save(new ClassGroup({
      id: '6b',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6B',
    }))

    const gradeLevelSubject = await service.academicsWorkflow.offerSubjectToGradeLevel({
      id: 'gls-math',
      gradeLevelId: 'gl-6',
      academicYearId: 'ay1',
      subjectId: 'subj-math',
      coefficient: 3,
      classSubjectIdsByClassGroupId: {
        '6a': 'cs-6a-math',
        '6b': 'cs-6b-math',
      },
    })

    await service.academicsWorkflow.assignMatterToGradeLevelSubject({
      id: 'glsm-math',
      gradeLevelSubjectId: gradeLevelSubject.id,
      subjectMatterId: 'sm-math',
      classSubjectMatterIdsByClassGroupId: {
        '6a': 'csm-6a-math',
        '6b': 'csm-6b-math',
      },
    })

    expect([...classSubjects.values()]).toHaveLength(2)
    expect([...classSubjects.values()].every(entry => entry.gradeLevelSubjectId === 'gls-math')).toBe(true)
    expect([...classSubjectMatters.values()]).toHaveLength(2)

    await repositories.classGroups.save(new ClassGroup({
      id: '6c',
      schoolId: 'sch1',
      academicYearId: 'ay1',
      gradeLevelId: 'gl-6',
      name: '6C',
    }))
    await service.academicsWorkflow.syncGradeLevelSubjectsToClassGroup('6c')

    expect([...classSubjects.values()]).toHaveLength(3)
    expect(classSubjects.get('cs-6a-math')?.coefficient).toBe(3)
  })

  it('mirrors the same subjectId in every class for report card section resolution', async () => {
    const gradeLevels = new Map<string, GradeLevel>()
    const classGroups = new Map<string, ClassGroup>()
    const subjects = new Map<string, Subject>()
    const gradeLevelSubjects = new Map<string, import('../../../src/domain').GradeLevelSubject>()
    const classSubjects = new Map<string, import('../../../src/domain').ClassSubject>()

    const repositories = {
      gradeLevels: {
        findById: async (id: string) => gradeLevels.get(id),
        list: async () => [...gradeLevels.values()],
        save: async (entity: GradeLevel) => { gradeLevels.set(entity.id, entity) },
      },
      academicYears: {
        findById: async () => ({ id: 'ay1', schoolId: 'sch1' }),
      },
      subjects: {
        findById: async (id: string) => subjects.get(id),
        list: async () => [...subjects.values()],
        save: async (entity: Subject) => { subjects.set(entity.id, entity) },
      },
      subjectMatters: {
        findById: async () => undefined,
        list: async () => [],
        save: async () => {},
      },
      classGroups: {
        findById: async (id: string) => classGroups.get(id),
        list: async (filter: { gradeLevelId?: string, academicYearId?: string } = {}) =>
          [...classGroups.values()].filter(group =>
            (!filter.gradeLevelId || group.gradeLevelId === filter.gradeLevelId)
            && (!filter.academicYearId || group.academicYearId === filter.academicYearId)),
        save: async (entity: ClassGroup) => { classGroups.set(entity.id, entity) },
      },
      gradeLevelSubjects: {
        findById: async (id: string) => gradeLevelSubjects.get(id),
        list: async (filter: { gradeLevelId?: string, academicYearId?: string } = {}) =>
          [...gradeLevelSubjects.values()].filter(entry =>
            (!filter.gradeLevelId || entry.gradeLevelId === filter.gradeLevelId)
            && (!filter.academicYearId || entry.academicYearId === filter.academicYearId)),
        save: async (entity: import('../../../src/domain').GradeLevelSubject) => {
          gradeLevelSubjects.set(entity.id, entity)
        },
      },
      gradeLevelSubjectMatters: {
        findById: async () => undefined,
        list: async () => [],
        save: async () => {},
        delete: async () => {},
      },
      classSubjects: {
        findById: async (id: string) => classSubjects.get(id),
        findOne: async (filter: { classGroupId?: string, gradeLevelSubjectId?: string, subjectId?: string }) =>
          [...classSubjects.values()].find(entry =>
            (!filter.classGroupId || entry.classGroupId === filter.classGroupId)
            && (!filter.gradeLevelSubjectId || entry.gradeLevelSubjectId === filter.gradeLevelSubjectId)
            && (!filter.subjectId || entry.subjectId === filter.subjectId)),
        list: async (filter: { classGroupId?: string } = {}) =>
          [...classSubjects.values()].filter(entry =>
            !filter.classGroupId || entry.classGroupId === filter.classGroupId),
        save: async (entity: import('../../../src/domain').ClassSubject) => {
          classSubjects.set(entity.id, entity)
        },
        delete: async (id: string) => { classSubjects.delete(id) },
      },
      classSubjectMatters: {
        findOne: async () => undefined,
        list: async () => [],
        save: async () => {},
        delete: async () => {},
      },
      assessments: { list: async () => [] },
      sessions: { list: async () => [] },
      staffAssignments: { list: async () => [] },
    } as unknown as SchoolRepositories

    const service = createAcademicsTestService(repositories)

    await repositories.gradeLevels.save(new GradeLevel({
      id: 'gl-6',
      schoolId: 'sch1',
      name: '6ème',
      order: 1,
    }))
    await repositories.subjects.save(new Subject({
      id: 'subj-math',
      schoolId: 'sch1',
      name: 'Math',
      category: SubjectCategory.Scientific,
      color: SubjectColor.Mint,
    }))
    for (const classId of ['6a', '6b']) {
      await repositories.classGroups.save(new ClassGroup({
        id: classId,
        schoolId: 'sch1',
        academicYearId: 'ay1',
        gradeLevelId: 'gl-6',
        name: classId.toUpperCase(),
      }))
    }

    await service.academicsWorkflow.offerSubjectToGradeLevel({
      id: 'gls-math',
      gradeLevelId: 'gl-6',
      academicYearId: 'ay1',
      subjectId: 'subj-math',
      coefficient: 3,
    })

    for (const classId of ['6a', '6b']) {
      const mirrored = [...classSubjects.values()].filter(entry => entry.classGroupId === classId)
      const bySubjectId = new Map(mirrored.map(entry => [entry.subjectId, entry]))
      expect(bySubjectId.get('subj-math')?.gradeLevelSubjectId).toBe('gls-math')
    }
  })
})
