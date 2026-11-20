import * as pglite from '@electric-sql/pglite'
import { mock } from 'bun:test'

function integrationOnly(): never {
  throw new Error('Database and listening-server fixtures require an .integration.test.ts file and test:integration')
}

// Fail on accidental database allocation even through a production composition helper.
const guarded = {
  ...pglite,
  PGlite: new Proxy(pglite.PGlite, {
    construct: integrationOnly,
    get(target, property, receiver) {
      return property === 'create' ? integrationOnly : Reflect.get(target, property, receiver)
    },
  }),
}
mock.module('@electric-sql/pglite', () => guarded)
Bun.serve = integrationOnly as typeof Bun.serve
