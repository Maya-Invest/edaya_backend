import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";

export interface IssueDocsServiceTokenInput {
  schoolId: string;
  secret: string;
  /** Token lifetime in seconds. Default 900 (15 min). */
  expiresInSeconds?: number;
  allowedTemplates?: string[];
  allowedFormats?: Array<"pdf" | "xlsx">;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signJwtSegment(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Issues an HS256 JWT accepted by edaya_docs `verifyServiceToken`. */
export function issueDocsServiceToken(input: IssueDocsServiceTokenInput): string {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const expiresAt = Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? 900);
  const payload = encodeBase64Url(JSON.stringify({
    iss: "edaya-school-api",
    sub: "service:document-renderer",
    schoolId: input.schoolId,
    allowedTemplates: input.allowedTemplates ?? ["report-card.v1"],
    allowedFormats: input.allowedFormats ?? ["pdf"],
    exp: expiresAt,
  }));
  const data = `${header}.${payload}`;
  const signature = signJwtSegment(data, input.secret);
  return `${data}.${signature}`;
}
