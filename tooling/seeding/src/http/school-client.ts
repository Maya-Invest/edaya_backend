import { createSchoolClient, type SchoolClient } from '../generated/api-client'
import type { HttpSeedClient } from './client'
import { createSeedTransport, type SeedTransportOptions } from './seed-transport'

type SeedSchemas = Record<string, unknown>

export type SeedSchoolClient = SchoolClient<SeedSchemas>

export function createSeedSchoolClient(
  client: HttpSeedClient,
  options: SeedTransportOptions = {},
): SeedSchoolClient {
  return createSchoolClient<SeedSchemas>(createSeedTransport(client, options))
}
