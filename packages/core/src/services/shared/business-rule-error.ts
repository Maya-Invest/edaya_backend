export class BusinessRuleViolationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'BusinessRuleViolationError'
    this.code = code
  }
}
