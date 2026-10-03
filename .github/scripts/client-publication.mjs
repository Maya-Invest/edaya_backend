export function clientName(packageName) {
  const name = { "@maya-invest/edaya-api-client": "api" }[packageName];
  if (!name) throw new Error("Unsupported release client package");
  return name;
}
export function publicationStatus(published, sha) {
  if (published === undefined) return "published";
  if (published !== sha) throw new Error("Published version does not match the candidate commit");
  return "reused";
}
export function candidatePublicationRecord(saved, sha) {
  const version = `0.0.0-staging.${sha}`;
  if (saved === undefined) return { api: { version, sourceSha: sha, status: "unverified", verifiedAt: null } };
  const record = saved?.api;
  if (Object.keys(saved || {}).join() !== "api" || record?.sourceSha !== sha || record?.version !== version
    || !["published", "reused"].includes(record?.status)) {
    throw new Error("Client publication record must match the unified backend candidate");
  }
  return { api: record };
}
