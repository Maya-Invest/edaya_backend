export interface SeedPortErrorOptions {
  cause?: unknown
  detail?: string
  status?: number
}

export class SeedPortError extends Error {
  readonly operation: string
  readonly status?: number
  readonly detail?: string

  constructor(operation: string, options: SeedPortErrorOptions = {}) {
    const suffix = options.detail ? `: ${options.detail}` : ''
    super(`Seed port operation failed (${operation})${suffix}`, { cause: options.cause })
    this.name = 'SeedPortError'
    this.operation = operation
    this.status = options.status
    this.detail = options.detail
  }
}

export async function withSeedPortError<T>(operation: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  }
  catch (error) {
    if (error instanceof SeedPortError) {
      throw error
    }
    throw new SeedPortError(operation, {
      cause: error,
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
