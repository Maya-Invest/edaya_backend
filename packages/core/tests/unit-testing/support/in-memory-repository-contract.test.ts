import { runBaseRepositoryContract } from '../../support/base-repository-contract'
import { createStore } from '../../support/in-memory-school-headless-app'

runBaseRepositoryContract(
  'in-memory repository base contract',
  () => createStore<{ id: string, value: string }>(),
  (id, value) => ({ id, value }),
)
