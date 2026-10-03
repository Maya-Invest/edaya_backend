/** Checked before runtime construction: maintenance must never open the database. */
export function stagingSwitch(bindings: Record<string, unknown>, key: "STAGING_MAINTENANCE" | "STAGING_PAUSE_JOBS"): boolean {
  const value = bindings[key];
  if (value === undefined || value === "false" || value === false) {
    return false;
  }
  if ((value !== "true" && value !== true) || bindings.API_ORIGIN !== "https://staging.api.edayaplus.com") {
    throw new Error(`${key} requires a boolean and the exact staging origin`);
  }
  return true;
}
export function maintenanceResponse(): Response {
  return Response.json({ message: "Staging maintenance in progress" }, {
    status: 503,
    headers: { "retry-after": "60", "cache-control": "no-store" },
  });
}
