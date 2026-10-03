import { candidateCommits } from "./staging-candidate.mjs";
export function reusableApks(saved, candidate, hash) {
  // Older schemas, separate auth URLs or unversioned provenance is a cache miss, never a trusted retry.
  if (saved?.schemaVersion !== 3 || !saved.candidate?.repositories) return false;
  try { candidateCommits(Object.fromEntries(Object.entries(saved.candidate.repositories).map(([name, sha]) => [name, { sha }]))); } catch { return false; }
  if (JSON.stringify(saved.candidate) !== JSON.stringify(candidate)) return false;
  for (const app of ["guardian", "teacher"]) {
    if (!/^[a-f0-9]{64}$/.test(saved.apks?.[app] ?? "") || hash(app) !== saved.apks[app]) throw new Error("Previous APK artifact checksum mismatch");
  }
  // Restored APKs must still pass verify-staging-apks against the current keystore.
  return true;
}
