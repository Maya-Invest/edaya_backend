export class BusinessRuleViolationError extends Error {
  readonly code: string

  constructor(code: string, message: string, readonly details?: Record<string, unknown>) {
    super(message)
    this.name = 'BusinessRuleViolationError'
    this.code = code
  }
}
