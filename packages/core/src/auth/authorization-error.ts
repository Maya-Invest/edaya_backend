export enum AuthorizationErrorCode {
  AuthenticationRequired = 'authentication_required',
  Forbidden = 'forbidden',
  SchoolAccessForbidden = 'school_access_forbidden',
  StaffActorRequired = 'staff_actor_required',
  GuardianActorRequired = 'guardian_actor_required',
  StudentActorRequired = 'student_actor_required',
}

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode

  constructor(code: AuthorizationErrorCode, message = 'Operation is not permitted') {
    super(message)
    this.name = 'AuthorizationError'
    this.code = code
  }
}
