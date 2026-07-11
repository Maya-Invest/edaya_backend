import type { SchoolClient } from '@edaya/api-client'
import type { HttpSeedClient } from './client'
import type { SeedTransportOptions } from './seed-transport'
import { createSchoolClient } from '@edaya/api-client'
import { createSeedTransport } from './seed-transport'

type SeedSchemas = Record<string, unknown>

export type SeedSchoolClient = SchoolClient<SeedSchemas>

export function createSeedSchoolClient(
  client: HttpSeedClient,
  options: SeedTransportOptions = {},
): SeedSchoolClient {
  return createSchoolClient<SeedSchemas>(createSeedTransport(client, options))
}
