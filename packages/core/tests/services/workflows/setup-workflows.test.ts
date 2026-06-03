import {
  describe,
  expect,
  test,
} from 'bun:test'
import {
  actor,
  createSetupContext,
} from './workflow-test-context'

describe('SchoolService setup workflows', () => {
  test('createAcademicYear creates an active year and deactivates existing active years through managed service', async () => {
    const { academicYears, mockAtomic, mockPolicy, mockRepos, service } = createSetupContext()

    const result = await service.createAcademicYear({
      id: 'ay-new',
      schoolId: 'sch1',
      name: '2027-2028',
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2028-06-30T00:00:00Z'),
      createdAt: new Date('2027-01-01T00:00:00Z'),
    })

    expect(result.id).toBe('ay-new')
    expect(result.isActive).toBe(true)
    expect(academicYears.get('ay-current')?.isActive).toBe(false)
    expect(academicYears.get('ay-new')?.isActive).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage')
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ay-current',
      isActive: false,
    }))
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(result)
  })

  test('activateAcademicYear activates an existing year and deactivates other active years through managed service', async () => {
    const { academicYears, mockAtomic, mockPolicy, mockRepos, service } = createSetupContext()

    const result = await service.activateAcademicYear({
      academicYearId: 'ay-next',
    })

    expect(result.id).toBe('ay-next')
    expect(result.isActive).toBe(true)
    expect(academicYears.get('ay-current')?.isActive).toBe(false)
    expect(academicYears.get('ay-next')?.isActive).toBe(true)
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkGlobalAction).toHaveBeenCalledWith(actor, 'setup.manage_lifecycle')
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ay-current',
      isActive: false,
    }))
    expect(mockRepos.academicYears.save).toHaveBeenCalledWith(result)
  })

})
