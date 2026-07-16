import { describe, expect, mock, test } from 'bun:test'
import { withTenantLookupCache } from '../../../src/services/entities/tenant-lookup-cache'

describe('withTenantLookupCache', () => {
  test('dedupes repeated findById lookups across tenant resolution', async () => {
    const findById = mock(async (id: string) => ({ id, schoolId: 'school-1' }))
    const repositories = {
      classGroups: {
        findById,
        findOne: mock(async () => undefined),
        findByIds: mock(async () => []),
        list: mock(async () => []),
        count: mock(async () => 0),
        save: mock(async () => {}),
        delete: mock(async () => {}),
        batchSave: mock(async () => []),
        batchDelete: mock(async () => {}),
      },
    }

    const cached = withTenantLookupCache(repositories as never)
    await cached.classGroups.findById('class-1')
    await cached.classGroups.findById('class-1')
    await cached.classGroups.findById('class-2')

    expect(findById).toHaveBeenCalledTimes(2)
  })
})
