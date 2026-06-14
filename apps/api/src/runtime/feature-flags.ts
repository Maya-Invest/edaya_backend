import type { Environment } from "@/runtime/env/schema";

export function shouldAllowPublicSchoolRegistration(env: Environment): boolean {
  if (env.ALLOW_PUBLIC_SCHOOL_REGISTRATION === true) {
    return true;
  }
  if (env.ALLOW_PUBLIC_SCHOOL_REGISTRATION === false) {
    return false;
  }
  return env.NODE_ENV === "development";
}
