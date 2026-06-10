export enum AuthorizationErrorCode {
  Forbidden = 'forbidden',
}

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode

  constructor(code: AuthorizationErrorCode, message = 'Operation is not permitted') {
    super(message)
    this.name = 'AuthorizationError'
    this.code = code
  }
}

export function denyResourceAccess(): never {
  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
