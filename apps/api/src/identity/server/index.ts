import type { JSONWebKeySet } from "jose";
import type { DirectoryContact, DirectoryContactChannel, DirectoryLookupResult, IdentityClaims } from "./claims";

export * from "./claims";
export { verifyIdentityToken } from "./verify";
export interface DirectoryClient {
  lookupByContact: (channel: DirectoryContactChannel, value: string) => Promise<DirectoryLookupResult | undefined>;
  resolveBySubjectId: (subjectId: string) => Promise<DirectoryContact | undefined>;
  fetchJwks?: () => Promise<JSONWebKeySet>;
}
export interface IdentityClient {
  directory: DirectoryClient;
  verifyAccessToken: (token: string) => Promise<IdentityClaims>;
}
