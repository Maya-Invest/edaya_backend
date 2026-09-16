import type { CoreHttpRequestOptions } from '../transport/http/core-entity'
import { countPublishedPhotosFromPeople } from '@edaya/fixtures/meta/fixture-counts'
import { postEntityList } from '../transport/http/core-entity'

const PEOPLE_LIST_LIMIT = 500

export async function countPublishedProfilePhotos(options: CoreHttpRequestOptions): Promise<number> {
  const [students, staffMembers, guardians] = await Promise.all([
    postEntityList(options, 'students', { $limit: PEOPLE_LIST_LIMIT }),
    postEntityList(options, 'staffMembers', { $limit: PEOPLE_LIST_LIMIT }),
    postEntityList(options, 'guardians', { $limit: PEOPLE_LIST_LIMIT }),
  ])
  return countPublishedPhotosFromPeople(students, staffMembers, guardians)
}
