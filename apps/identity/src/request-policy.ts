import type { Environment } from "./env";
import { AuthError } from "@edaya/account";

export function authCookieName(env: Environment) {
  return new URL(env.BETTER_AUTH_URL).protocol === "https:" ? "__Host-edaya_session" : "edaya_session";
}
export function authCredential(request: Request, env: Environment) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([\w-]+)$/)?.[1];
  if (bearer)
    return bearer;
  const name = authCookieName(env);
  return request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
export function assertAuthRequest(request: Request, env: Environment, json = true) {
  const origin = request.headers.get("origin");
  const trusted = env.TRUSTED_ORIGINS.split(",").map(value => value.trim());
  if (origin && origin !== new URL(env.BETTER_AUTH_URL).origin && !trusted.includes(origin))
    throw new AuthError("untrusted_origin", 403);
  if (!origin && request.headers.has("cookie"))
    throw new AuthError("origin_required", 403);
  if (json && !request.headers.get("content-type")?.startsWith("application/json"))
    throw new AuthError("json_required", 415);
}
