export function isNovuSubscriberNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("statusCode" in error && error.statusCode === 404) {
    return true;
  }

  return "message" in error
    && typeof error.message === "string"
    && error.message.includes("Subscriber was not found");
}
