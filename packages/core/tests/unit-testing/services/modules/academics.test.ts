import type { AtomicExecutionPort } from '../../../../src/ports/atomic-execution'
import type { SchoolRepositories } from '../../../../src/ports/school-repositories'
import type { ActorMetadata } from '../../../../src/services/authorization/actor-metadata'
import type { AuthorizationPolicy } from '../../../../src/services/authorization/authorization-policy'
import { describe, expect, mock, test } from 'bun:test'
import { AcademicsService } from '../../../../src/services/modules/academics'

describe('AcademicsService uncovered methods', () => {
  const mockRepos = {
    classSubjectMatters: {
      findById: mock(async () => ({ id: 'csm1', classSubjectId: 'cs1', subjectMatterId: 'sm1', completedPercentage: 0 })),
      list: mock(async () => [{ id: 'csm1', completedPercentage: 50 }]),
      save: mock(async () => {}),
    },
    classSubjects: {
      findById: mock(async () => ({ id: 'cs1', classGroupId: 'cg1', subjectId: 'subj1', coefficient: 1, createdAt: new Date() })),
      save: mock(async () => {}),
    },
    classGroups: {
      findById: mock(async () => ({ id: 'cg1', schoolId: 'sch1' })),
    },
    sessions: {
      findById: mock(async () => ({ id: 'sess1', classSubjectId: 'cs1', classGroupId: 'cg1' })),
    },
    classSubjectProgress: {
      findOne: mock(async () => undefined),
      save: mock(async () => {}),
      list: mock(async () => [{ id: 'csp1' }]),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = {
    requirePermission: mock(async () => {}),
  } as unknown as AuthorizationPolicy

  const mockAtomic: AtomicExecutionPort = {
    execute: mock(async (operation: () => Promise<any>) => operation()),
  }

  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'sch1',
    requestId: 'req1',
    reason: 'test',
  }

  const service = new AcademicsService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
  })

  test('listMatterProgress lists progress', async () => {
    const result = await service.listMatterProgress('csm1')
    expect(mockRepos.classSubjectProgress.list).toHaveBeenCalledWith({ classSubjectMatterId: 'csm1' })
    expect(result).toEqual([{ id: 'csp1' }] as any)
  })

  test('recordSessionProgress updates class subject aggregate correctly', async () => {
    const result = await service.recordSessionProgress({
      id: 'csp1',
      classSubjectMatterId: 'csm1',
      sessionId: 'sess1',
      completedPercentage: 100,
    })

    expect(result.id).toBe('csp1')
    expect(result.completedPercentage).toBe(100)
    expect(mockRepos.classSubjectProgress.save).toHaveBeenCalled()
    expect(mockRepos.classSubjectMatters.save).toHaveBeenCalled()
    expect(mockRepos.classSubjects.save).toHaveBeenCalled()
  })
})
