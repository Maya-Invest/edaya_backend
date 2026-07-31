import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { issueDocsServiceToken } from "@/lib/documents/issue-docs-service-token";

function decodeBase64UrlJson(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("issueDocsServiceToken", () => {
  test("issues an HS256 JWT accepted by edaya_docs claim shape", () => {
    const secret = "test-docs-secret";
    const token = issueDocsServiceToken({
      schoolId: "sch-1",
      secret,
      expiresInSeconds: 600,
    });

    const [headerPart, payloadPart, signaturePart] = token.split(".");
    expect(headerPart && payloadPart && signaturePart).toBeTruthy();

    const data = `${headerPart}.${payloadPart}`;
    const expected = createHmac("sha256", secret).update(data).digest("base64url");
    expect(signaturePart).toBe(expected);

    const header = decodeBase64UrlJson(headerPart!);
    const payload = decodeBase64UrlJson(payloadPart!);
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(payload.iss).toBe("edaya-school-api");
    expect(payload.sub).toBe("service:document-renderer");
    expect(payload.schoolId).toBe("sch-1");
    expect(payload.allowedTemplates).toEqual(["report-card.v1"]);
    expect(payload.allowedFormats).toEqual(["pdf"]);
    expect(typeof payload.exp).toBe("number");
    expect((payload.exp as number) * 1000).toBeGreaterThan(Date.now());
  });
});
