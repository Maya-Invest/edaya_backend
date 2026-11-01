import type { TermsDocument, TermsLocale, TermsPolicyPort } from "@edaya/account";
import type { Environment } from "./env";
import { createHash } from "node:crypto";
import { draftTerms } from "./terms-draft";

// Approved versions are append-only. Never publish a document containing placeholders.
const published: Record<string, Record<TermsLocale, Omit<TermsDocument, "documentHash">>> = {};

export function createTermsPolicy(env: Pick<Environment, "NODE_ENV" | "AUTH_TERMS_MODE" | "AUTH_TERMS_VERSION">): TermsPolicyPort {
  if (env.AUTH_TERMS_MODE === "off")
    return { current: () => ({ enforced: false, document: null }) };
  if (env.AUTH_TERMS_MODE === "preview" && env.NODE_ENV === "production")
    throw new Error("Draft terms cannot be enabled in production");
  const documents = env.AUTH_TERMS_MODE === "preview" ? draftTerms : published[env.AUTH_TERMS_VERSION ?? ""];
  if (!documents)
    throw new Error("Select an approved published AUTH_TERMS_VERSION before enforcing terms");
  if (env.AUTH_TERMS_MODE === "enforced" && Object.values(documents).some(document => document.status !== "published" || /\[[^\]]+\]/.test(JSON.stringify(document))))
    throw new Error("Published terms must not contain draft text or placeholders");
  return { current(locale) {
    const document = documents[locale];
    return { enforced: true, document: { ...document, documentHash: createHash("sha256").update(JSON.stringify(document)).digest("hex") } };
  } };
}
