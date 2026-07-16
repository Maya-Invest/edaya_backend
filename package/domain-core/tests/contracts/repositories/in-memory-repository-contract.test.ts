import { createStore } from '../../support/in-memory-store'
import { runBaseRepositoryContract } from './base-repository-contract'

runBaseRepositoryContract(
  'in-memory repository base contract',
  () => createStore<{ id: string, value: string }>(),
  (id, value) => ({ id, value }),
)
