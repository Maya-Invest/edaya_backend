import { PostgresSchoolRepositories } from '@edaya/adaptor-postgres'

export function createFixtureRepositories(db: ConstructorParameters<typeof PostgresSchoolRepositories>[0]): PostgresSchoolRepositories {
  return new PostgresSchoolRepositories(db)
}
