const retired = new Set(["IDENTITY_DIRECTORY_SECRET", "IDENTITY_DIRECTORY_URL", "IDENTITY_ISSUER", "ACCOUNT_POLICY_URL"]);
/** Merge validated release inputs without disclosing credential contents. */
export function mergeWorkerSecrets(api, identity) {
  const result = {};
  for (const payload of [api, identity]) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Worker secrets: expected JSON objects");
    for (const [field, value] of Object.entries(payload)) {
      if (retired.has(field)) continue;
      if (typeof value !== "string" || !value.trim()) throw new Error(`Worker secrets.${field}: expected nonempty string`);
      if (field in result && result[field] !== value) throw new Error(`Worker secrets.${field}: conflicting duplicate field`);
      result[field] = value;
    }
  }
  return result;
}
