export class NotifySendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotifySendError";
  }
}

export function isNotifySendError(error: unknown): error is NotifySendError {
  return error instanceof NotifySendError;
}
