import type { AuthContactResolverPort } from "@edaya/core";
import type { DirectoryClient } from "../../../identity/server/index";

export function createAuthContactResolver(directory: DirectoryClient): AuthContactResolverPort {
  return {
    resolveBySubjectId: subjectId => directory.resolveBySubjectId(subjectId),
    async hasAccountForEmail(email: string) {
      return (await directory.lookupByContact("email", email))?.exists === true;
    },
    async hasAccountForPhone(phone: string) {
      return (await directory.lookupByContact("phone", phone))?.exists === true;
    },
  };
}
