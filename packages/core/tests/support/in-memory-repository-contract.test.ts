import { runBaseRepositoryContract } from './base-repository-contract'
import { createStore } from './in-memory-school-headless-app'

runBaseRepositoryContract(
  'in-memory repository base contract',
  () => createStore<{ id: string, value: string }>(),
  (id, value) => ({ id, value }),
)
