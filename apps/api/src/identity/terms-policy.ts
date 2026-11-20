import type { TermsDocument, TermsLocale, TermsPolicyPort } from "@edaya/account";
import type { Environment } from "./env";
import { createHash } from "node:crypto";
import { AuthError } from "@edaya/account";
import { extractTermsContent } from "./terms-content";

const SOURCES = {
  fr: "https://edayaplus.com/conditions-utilisation/",
  en: "https://edayaplus.com/en/terms/",
} as const;
const MAX_BYTES = 512 * 1024;
const CACHE_MS = 5 * 60 * 1000;

type FetchTerms = (url: string, init: RequestInit) => Promise<Response>;
interface Options { fetch?: FetchTerms; now?: () => number }
// Worker identity runtimes are request-scoped; reuse only the public-content policy.
let sharedLivePolicy: TermsPolicyPort | undefined;

/** Bound memory use even when the upstream omits Content-Length. */
async function readPage(response: Response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || !response.body)
    throw new Error("Terms source unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_BYTES)
        throw new Error("Terms source too large");
      text += decoder.decode(value, { stream: true });
    }
  }
  finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

/** The cache contains only public documents, never account or request data. */
export function createTermsPolicy(env: Pick<Environment, "NODE_ENV" | "AUTH_TERMS_MODE" | "AUTH_TERMS_VERSION">, options?: Options): TermsPolicyPort {
  if (env.AUTH_TERMS_MODE === "off")
    return { current: () => ({ enforced: false, document: null }) };
  if (!options && sharedLivePolicy)
    return sharedLivePolicy;
  const fetchPage = options?.fetch ?? fetch;
  const now = options?.now ?? Date.now;
  let cache: { expiresAt: number; documents: Record<TermsLocale, TermsDocument> } | undefined;
  let pending: Promise<Record<TermsLocale, TermsDocument>> | undefined;

  async function refresh() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const [fr, en] = await Promise.all((["fr", "en"] as const).map(async (locale) => {
        const response = await fetchPage(SOURCES[locale], { signal: controller.signal, redirect: "manual", headers: { accept: "text/html" } });
        return extractTermsContent(await readPage(response), locale, SOURCES[locale]);
      }));
      const version = `live-${createHash("sha256").update(`${fr.documentHash}:${en.documentHash}`).digest("hex")}`;
      const documents = { fr: { ...fr, version }, en: { ...en, version } };
      cache = { documents, expiresAt: now() + CACHE_MS };
      return documents;
    }
    catch {
      throw new AuthError("terms_unavailable", 503);
    }
    finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }

  const policy: TermsPolicyPort = { async current(locale) {
    if (cache && now() < cache.expiresAt)
      return { enforced: true, document: structuredClone(cache.documents[locale]) };
    pending ??= refresh().finally(() => {
      pending = undefined;
    });
    const documents = await pending;
    return { enforced: true, document: structuredClone(documents[locale]) };
  } };
  if (!options)
    sharedLivePolicy = policy;
  return policy;
}
