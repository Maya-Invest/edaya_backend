import { describe, expect, test } from "bun:test";
import { parseRuntimeEnv } from "@/runtime/shared/env/schema";
import { parseEnv } from "../env";
import { extractTermsContent } from "../terms-content";
import { createTermsPolicy } from "../terms-policy";

const page = (label = "Terms", content = "Use responsibly.") => `<html><head><script>tracking()</script></head><body><nav>Navigation</nav><main class="legal"><div class="legal-wrap"><a class="legal-back" href="/">Home</a><h1>${label}</h1><p>Published October 26</p><section><h2>Account</h2><p>${content}</p><ul><li>First rule</li><li>Second rule</li></ul><p>Read <a href="/privacy">privacy</a>.</p></section></div></main><footer>Footer</footer></body></html>`;
const response = (body = page()) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
const live = { NODE_ENV: "production", AUTH_TERMS_MODE: "live" } as const;

describe("live legal content", () => {
  test("extracts complete bilingual content and safe links for iframe and section clients", () => {
    for (const locale of ["fr", "en"] as const) {
      const document = extractTermsContent(page(locale), locale, "https://edayaplus.com/en/terms/");
      expect(document).toMatchObject({ locale, title: locale, status: "published" });
      expect(document.html).not.toMatch(/Navigation|Footer|tracking|Home/);
      expect(document.html).toContain("<a href=\"https://edayaplus.com/privacy\" target=\"_blank\" rel=\"noopener noreferrer\">privacy</a>");
      expect(document.sections).toEqual([
        { heading: locale, paragraphs: ["Published October 26"] },
        { heading: "Account", paragraphs: ["Use responsibly.", "First rule", "Second rule", "Read privacy (https://edayaplus.com/privacy)."] },
      ]);
    }
  });
  test("removes executable markup, unsafe URLs and attributes without losing visible text", () => {
    const document = extractTermsContent(page("Terms", "<img src=x onerror=\"attack()\"><script>attack()</script><style>body{display:none}</style><svg><script>attack()</script></svg><iframe src=\"https://evil.test\"></iframe><a href=\"javascript:attack()\" onclick=\"attack()\">Unsafe link</a> <strong style=\"color:red\">Visible</strong>"), "en", "https://edayaplus.com/en/terms/");
    expect(document.html).not.toMatch(/attack|javascript|onerror|onclick|style=|<script|<svg|<iframe|<img/);
    expect(document.html).toContain("Unsafe link <strong>Visible</strong>");
  });
  test("ignores styling, formatting whitespace and page chrome but hashes legal edits and links", () => {
    const hash = (html: string) => extractTermsContent(html, "en", "https://edayaplus.com/en/terms/").documentHash;
    const original = page();
    expect(hash(original.replaceAll("><", ">\n  <").replace("legal-wrap", "new-design").replace("<h2>", "<h2 style=\"color:red\">").replace("Navigation", "New navigation"))).toBe(hash(original));
    expect(hash(page("Terms", "Use <strong>responsibly.</strong>"))).toBe(hash(original));
    expect(hash(page("Terms", "New rule."))).not.toBe(hash(original));
    expect(hash(original.replace("href=\"/privacy\"", "href=\"/new-privacy\""))).not.toBe(hash(original));
  });
  test("rejects missing and incomplete legal documents", () => {
    for (const html of ["<h1>Error</h1>", "<main class=\"legal\"><h1>Terms</h1></main>", page().replace("<h1>Terms</h1>", ""), page().split("</main>")[0]!, page().replace("<html>", "<html lang=\"fr\">")])
      expect(() => extractTermsContent(html, "en", "https://edayaplus.com/en/terms/")).toThrow();
  });
});

describe("live policy", () => {
  test("coalesces bilingual fetches, caches for five minutes, and versions both translations together", async () => {
    let now = 0;
    let calls = 0;
    let french = "French rules";
    const policy = createTermsPolicy(live, { now: () => now, fetch: async (url) => {
      calls++;
      return response(page(url.includes("/en/") ? "Terms" : "Conditions", url.includes("/en/") ? "English rules" : french));
    } });
    const [fr, en] = await Promise.all([policy.current("fr"), policy.current("en")]);
    expect(calls).toBe(2);
    expect(fr.document?.version).toBe(en.document?.version);
    expect(fr.document?.documentHash).not.toBe(en.document?.documentHash);
    now = 299999;
    await policy.current("en");
    expect(calls).toBe(2);
    now = 300000;
    french = "Updated French rules";
    const next = await policy.current("en");
    expect(calls).toBe(4);
    expect(next.document?.version).not.toBe(en.document?.version);
    expect(next.document?.documentHash).toBe(en.document?.documentHash);
  });
  test("fails closed after cache expiry and retries without publishing a partial translation pair", async () => {
    let now = 0;
    let failed = false;
    const policy = createTermsPolicy(live, { now: () => now, fetch: async url => failed && url.includes("/en/") ? new Response("unavailable", { status: 503 }) : response() });
    const first = await policy.current("fr");
    now = 300000;
    failed = true;
    await expect(policy.current("fr")).rejects.toMatchObject({ code: "terms_unavailable", status: 503 });
    failed = false;
    expect((await policy.current("fr")).document?.version).toBe(first.document?.version);
  });
  test("uses Worker-compatible manual redirects and rejects redirected agreements", async () => {
    const redirects: RequestInit["redirect"][] = [];
    const policy = createTermsPolicy(live, { fetch: async (_url, init) => {
      redirects.push(init.redirect);
      return Response.redirect("https://example.org/other-agreement", 302);
    } });
    await expect(policy.current("en")).rejects.toMatchObject({ code: "terms_unavailable", status: 503 });
    expect(redirects).toEqual(["manual", "manual"]);
  });
  test("rejects malformed pages and oversized responses", async () => {
    for (const body of ["<html>Unavailable</html>", "x".repeat(512 * 1024 + 1)]) {
      const policy = createTermsPolicy(live, { fetch: async () => response(body) });
      await expect(policy.current("en")).rejects.toMatchObject({ code: "terms_unavailable" });
    }
  });
  test("aborts an unavailable upstream after five seconds", async () => {
    let aborted = 0;
    const policy = createTermsPolicy(live, { fetch: (_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        aborted++;
        reject(new Error("timeout"));
      });
    }) });
    await expect(policy.current("en")).rejects.toMatchObject({ code: "terms_unavailable" });
    expect(aborted).toBe(2);
  }, 7000);
  test("legacy modes use live content and off performs no fetch", async () => {
    for (const mode of ["off", "preview", "enforced"] as const) {
      let calls = 0;
      const policy = createTermsPolicy({ ...live, AUTH_TERMS_MODE: mode, AUTH_TERMS_VERSION: "obsolete-version" }, { fetch: async () => {
        calls++;
        return response();
      } });
      const result = await policy.current("en");
      expect(result.enforced).toBe(mode !== "off");
      expect(calls).toBe(mode === "off" ? 0 : 2);
      if (result.document)
        expect(result.document.status).toBe("published");
    }
  });
});

describe("environment defaults", () => {
  test("staging and production default to live in both parsing paths and respect explicit overrides", () => {
    for (const origin of ["https://staging.api.edayaplus.com", "https://api.edayaplus.com"]) {
      for (const mode of [undefined, "off", "preview", "enforced", "live"] as const) {
        const source = { NODE_ENV: "production", DATABASE_URL: "pglite:memory", API_ORIGIN: origin, AUTH_TERMS_MODE: mode, BETTER_AUTH_SECRET: "test-only-key-with-more-than-32-characters", BETTER_AUTH_URL: origin, FIRST_PARTY_API_ORIGINS: origin };
        const runtime = parseRuntimeEnv(source);
        expect(runtime.AUTH_TERMS_MODE).toBe(mode ?? "live");
        expect(parseEnv(source, "worker").AUTH_TERMS_MODE).toBe(mode ?? "live");
        expect(parseEnv({ ...source, ...runtime }, "worker").AUTH_TERMS_MODE).toBe(mode ?? "live");
      }
    }
  });
  test("development and tests default to off", () => {
    for (const nodeEnv of ["development", "test"]) {
      const source = { NODE_ENV: nodeEnv, DATABASE_URL: "pglite:memory", BETTER_AUTH_SECRET: "test-only-key-with-more-than-32-characters", BETTER_AUTH_URL: "http://localhost:9999", FIRST_PARTY_API_ORIGINS: "http://localhost:9999" };
      expect(parseRuntimeEnv(source).AUTH_TERMS_MODE).toBe("off");
      expect(parseEnv(source, "local").AUTH_TERMS_MODE).toBe("off");
    }
  });
});
