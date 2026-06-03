import { createStore } from '../../support/create-test-app'
import { runBaseRepositoryContract } from './base-repository-contract'

runBaseRepositoryContract(
  'in-memory repository base contract',
  () => createStore<{ id: string, value: string }>(),
  (id, value) => ({ id, value }),
)
