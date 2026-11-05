export async function humanFixture<T extends { id?: string }>(input: T) {
  const id = input.id ?? crypto.randomUUID()
  return { ...input, id, requestId: id }
}

export async function saveHumanFixture<T>(repository: { save: (entity: T) => Promise<void> }, entity: T): Promise<T> {
  await repository.save(entity)
  return entity
}
