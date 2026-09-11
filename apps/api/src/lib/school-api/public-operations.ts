/** Explicit transport policy; domain authorization still runs for every request. */
export interface PublicEntityOperations {
  readonly create: boolean;
  readonly update: boolean;
  readonly delete: boolean;
  readonly batchCreate: boolean;
  readonly batchUpdate: boolean;
  readonly batchDelete: boolean;
}

export const PUBLIC_CRUD: PublicEntityOperations = Object.freeze({
  create: true,
  update: true,
  delete: true,
  batchCreate: true,
  batchUpdate: true,
  batchDelete: true,
});
export const COMMAND_ONLY: PublicEntityOperations = Object.freeze({
  create: false,
  update: false,
  delete: false,
  batchCreate: false,
  batchUpdate: false,
  batchDelete: false,
});
export const PUBLIC_DELETE: PublicEntityOperations = Object.freeze({
  ...COMMAND_ONLY,
  delete: true,
  batchDelete: true,
});

/**
 * A generic save is an upsert, so both create and update must be permitted.
 * Create-only or update-only workflows require a named domain command.
 */
export function permitsPublicSave(operations: PublicEntityOperations, batch = false): boolean {
  return batch ? operations.batchCreate && operations.batchUpdate : operations.create && operations.update;
}
